import { runTriageAgent, runDeterministicTriage } from "./triageAgent.js";
import { runEvidenceAgent, runDeterministicEvidence } from "./evidenceAgent.js";
import { runDuplicateAgent } from "./duplicateAgent.js";
import { runPriorityAgent } from "./priorityAgent.js";
import { runRoutingAgent, runDeterministicRouting } from "./routingAgent.js";
import { runWorkOrderAgent } from "./workOrderAgent.js";
import { getLlmClient } from "./llmClient.js";
import { db } from "../db/client.js";

/**
 * Execute an individual agent step with:
 * - Timeout enforcement
 * - Up to 2 retries with exponential backoff
 * - Rule-based fallback if all attempts fail
 * - Saving AgentRun and ActivityLog
 * - Recording provider ('gemini' or 'fallback') and fallbackReason
 *
 * @param {Object} params
 * @param {string} params.reportId
 * @param {string} params.agentName
 * @param {Function} params.executeFn - Async function executing agent logic
 * @param {Function} params.fallbackFn - Synchronous or async rule-based fallback
 * @param {Object} [params.inputData={}]
 * @param {number} [params.timeoutMs=5000]
 * @param {number} [params.maxRetries=2]
 * @param {Object} [params.llmClient=null]
 * @returns {Promise<{ output: any, status: "completed" | "fallback", provider: "gemini" | "fallback", fallbackReason: string | null, durationMs: number }>}
 */
export async function executeAgentStepWithResilience({
  reportId,
  agentName,
  executeFn,
  fallbackFn,
  inputData = {},
  timeoutMs = 8000,
  maxRetries = 2,
  llmClient = null,
}) {
  const startTime = Date.now();
  let lastError = null;
  let attempt = 0;

  const client = llmClient || getLlmClient();
  const isGemini = client && client.name === "GeminiProvider" && client.isConfigured;
  const isMock = client && client.name === "MockProvider";

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const stepPromise = executeFn({ signal: controller.signal });
      const timeoutPromise = new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Agent ${agentName} timed out after ${timeoutMs}ms (Attempt ${attempt})`));
        });
      });

      const output = await Promise.race([stepPromise, timeoutPromise]);
      clearTimeout(timer);

      const durationMs = Date.now() - startTime;
      const provider = isGemini || isMock ? "gemini" : "fallback";
      const fallbackReason = null;

      // Server logging
      console.log(`[AgentRun:${agentName}] Provider: ${provider} | Duration: ${durationMs}ms`);

      // Record successful AgentRun in DB
      if (reportId && db.createAgentRun) {
        await db.createAgentRun({
          reportId,
          agentName,
          status: "completed",
          provider,
          fallbackReason,
          durationMs,
          input: inputData,
          output,
          error: null,
        }).catch(() => {});
      }

      return { output, status: "completed", provider, fallbackReason, durationMs };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      // Exponential backoff before next attempt: 100ms, 200ms
      if (attempt <= maxRetries) {
        const backoffMs = attempt * 100;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  // All retries failed -> Run Rule-Based Fallback
  const fallbackReason = lastError?.message || "All retries failed; fallback executed.";
  const provider = "fallback";

  console.warn(
    `[AgentRun:${agentName}] Provider: fallback | Reason: ${fallbackReason} | Duration: ${Date.now() - startTime}ms`
  );

  let fallbackOutput;
  try {
    fallbackOutput = await fallbackFn(lastError);
  } catch (fallbackErr) {
    throw new Error(`Agent ${agentName} fallback failed: ${fallbackErr.message}`);
  }

  const durationMs = Date.now() - startTime;

  // Record fallback AgentRun in DB
  if (reportId && db.createAgentRun) {
    await db.createAgentRun({
      reportId,
      agentName,
      status: "fallback",
      provider,
      fallbackReason,
      durationMs,
      input: inputData,
      output: fallbackOutput,
      error: fallbackReason,
    }).catch(() => {});
  }

  return { output: fallbackOutput, status: "fallback", provider, fallbackReason, durationMs };
}

/**
 * Orchestrator: Runs the 6 GreenWatch AI agents in order.
 * Each step is saved as an AgentRun and an ActivityLog entry
 * (actor AI, neutral wording such as "AI Triage Agent classified the report").
 *
 * @param {Object} params
 * @param {string} params.reportId
 * @param {string} params.description
 * @param {Object} params.location
 * @param {Array<string>} [params.photos=[]]
 * @param {Array<Object>} [params.photoBuffers=[]]
 * @param {Array<Object>} [params.existingReports=[]]
 * @param {string} params.workOrderRef
 * @param {Object} [params.llmClient=null]
 * @param {boolean} [params.persist=true] - Update report & add activity log in DB
 * @returns {Promise<Object>}
 */
export async function runOrchestrator({
  reportId,
  description = "",
  location = {},
  photos = [],
  photoBuffers = [],
  existingReports = [],
  workOrderRef,
  llmClient = null,
  persist = true,
}) {
  const now = new Date().toISOString();
  const photoCount = Math.max(
    Array.isArray(photos) ? photos.length : 0,
    Array.isArray(photoBuffers) ? photoBuffers.length : 0
  );

  const activityEntries = [];
  const agentRuns = [];

  // =========================================================================
  // 1. Triage Agent
  // =========================================================================
  const triageResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "triage",
    executeFn: () => runTriageAgent(description, photoCount, { llmClient, timeoutMs: 5000, rethrow: true }),
    fallbackFn: () => runDeterministicTriage(description, photoCount),
    inputData: { description, photoCount },
    llmClient,
  });
  const triage = triageResult.output;
  agentRuns.push({ agentName: "triage", ...triageResult });

  const triageLog = {
    kind: "agent",
    who: "AI",
    text: `AI Triage Agent classified the report as ${triage.categoryLabel} (${Math.round(
      triage.confidence * 100
    )}% confidence).`,
    at: now,
  };
  activityEntries.push(triageLog);
  if (persist && reportId) {
    await db.addActivity(reportId, triageLog).catch(() => {});
  }

  // =========================================================================
  // 2. Evidence Agent
  // =========================================================================
  const evidenceResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "evidence",
    executeFn: () => runEvidenceAgent(description, photos, photoBuffers, { llmClient, timeoutMs: 5000, rethrow: true }),
    fallbackFn: () => runDeterministicEvidence(description, photos, photoBuffers),
    inputData: { photoCount, textLength: description.length },
    llmClient,
  });
  const evidence = evidenceResult.output;
  agentRuns.push({ agentName: "evidence", ...evidenceResult });

  const evidenceLog = {
    kind: "agent",
    who: "AI",
    text: `AI Evidence Agent evaluated photo and text evidence. ${evidence.summary}`,
    at: now,
  };
  activityEntries.push(evidenceLog);
  if (persist && reportId) {
    await db.addActivity(reportId, evidenceLog).catch(() => {});
  }

  // =========================================================================
  // 3. Duplicate Detection Agent
  // =========================================================================
  const duplicateResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "duplicates",
    executeFn: async () => runDuplicateAgent(triage.category, location, description, existingReports),
    fallbackFn: () => runDuplicateAgent(triage.category, location, description, []),
    inputData: { category: triage.category, location },
    llmClient,
  });
  const duplicates = duplicateResult.output;
  agentRuns.push({ agentName: "duplicates", ...duplicateResult });

  // Record DuplicateLink rows in DB
  if (persist && reportId && duplicates.scores && duplicates.scores.length > 0 && db.createDuplicateLink) {
    for (const match of duplicates.scores) {
      await db.createDuplicateLink({
        reportId,
        targetReportId: match.id,
        similarityScore: match.combinedScore,
        distanceMeters: match.distanceMeters,
      }).catch(() => {});
    }
  }

  const dupLog = {
    kind: "agent",
    who: "AI",
    text: `AI Duplicate Detection Agent scanned nearby reports within 150m (${duplicates.count} similar found).`,
    at: now,
  };
  activityEntries.push(dupLog);
  if (persist && reportId) {
    await db.addActivity(reportId, dupLog).catch(() => {});
  }

  // =========================================================================
  // 4. Priority Agent
  // =========================================================================
  const priorityResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "priority",
    executeFn: async () =>
      runPriorityAgent(triage.category, description, {
        location,
        duplicateCount: duplicates.count,
        evidenceScore: evidence.evidenceScore,
      }),
    fallbackFn: () =>
      runPriorityAgent(triage.category, description, {
        location,
        duplicateCount: 0,
        evidenceScore: 70,
      }),
    inputData: { category: triage.category, duplicateCount: duplicates.count },
    llmClient,
  });
  const priority = priorityResult.output;
  agentRuns.push({ agentName: "priority", ...priorityResult });

  const priorityLog = {
    kind: "agent",
    who: "AI",
    text: `AI Priority Agent set priority to ${priority.priority} (${priority.reason}).`,
    at: now,
  };
  activityEntries.push(priorityLog);
  if (persist && reportId) {
    await db.addActivity(reportId, priorityLog).catch(() => {});
  }

  // =========================================================================
  // 5. Department Routing Agent
  // =========================================================================
  const routingResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "routing",
    executeFn: () => runRoutingAgent(triage.category, description, { llmClient }),
    fallbackFn: () => runDeterministicRouting(triage.category, description),
    inputData: { category: triage.category },
    llmClient,
  });
  const routing = routingResult.output;
  agentRuns.push({ agentName: "routing", ...routingResult });

  const routingLog = {
    kind: "agent",
    who: "AI",
    text: `AI Department Routing Agent assigned report to ${routing.department}.`,
    at: now,
  };
  activityEntries.push(routingLog);
  if (persist && reportId) {
    await db.addActivity(reportId, routingLog).catch(() => {});
  }

  // =========================================================================
  // 6. Work Order Creator Agent
  // =========================================================================
  const workOrderResult = await executeAgentStepWithResilience({
    reportId,
    agentName: "workorder",
    executeFn: async () =>
      runWorkOrderAgent(workOrderRef, {
        priority: priority.priority,
        confidence: triage.confidence,
        needsReview: triage.needsReview,
      }),
    fallbackFn: () =>
      runWorkOrderAgent(workOrderRef, {
        priority: priority.priority,
        confidence: 0.85,
        needsReview: false,
      }),
    inputData: { workOrderRef, priority: priority.priority, confidence: triage.confidence },
    llmClient,
  });
  const workOrder = workOrderResult.output;
  agentRuns.push({ agentName: "workorder", ...workOrderResult });

  const workOrderLog = {
    kind: "agent",
    who: "AI",
    text: `AI Work Order Agent created work order ${workOrder.workOrderRef} (${workOrder.slaHours}h SLA). Status set to ${workOrder.status}.`,
    at: now,
  };
  activityEntries.push(workOrderLog);
  if (persist && reportId) {
    await db.addActivity(reportId, workOrderLog).catch(() => {});
  }

  // =========================================================================
  // Unified AI Metadata
  // =========================================================================
  const ai = {
    severity: priority.priority,
    reason: priority.reason,
    evidence: evidence.quality || evidence.evidence || "Good",
    confidence: Math.round(triage.confidence * 100),
    confidenceFloat: triage.confidence,
    extractedLocation: triage.extractedLocation,
    needsReview: workOrder.needsReview,
    evidenceScore: evidence.evidenceScore,
    missingEvidence: evidence.missingEvidence,
    similar: {
      count: duplicates.count,
      ids: duplicates.ids,
      scores: duplicates.scores,
    },
  };

  // Visual Stepper steps for AgentStepper UI
  const steps = [
    {
      key: "triage",
      label: "Triage Agent",
      status: triageResult.status,
      durationMs: triageResult.durationMs,
      detail: `Classified as ${triage.categoryLabel} · ${Math.round(triage.confidence * 100)}% confident`,
      output: triage,
    },
    {
      key: "evidence",
      label: "Evidence Agent",
      status: evidenceResult.status,
      durationMs: evidenceResult.durationMs,
      detail: evidence.summary,
      output: evidence,
    },
    {
      key: "duplicates",
      label: "Duplicate Detection",
      status: duplicateResult.status,
      durationMs: duplicateResult.durationMs,
      detail:
        duplicates.count > 0
          ? `Scanned recent reports · ${duplicates.count} similar found nearby`
          : "Scanned recent reports · no duplicates nearby",
      output: duplicates,
    },
    {
      key: "priority",
      label: "Priority Agent",
      status: priorityResult.status,
      durationMs: priorityResult.durationMs,
      detail: `Marked ${priority.priority} — ${priority.reason}`,
      output: priority,
    },
    {
      key: "routing",
      label: "Department Routing",
      status: routingResult.status,
      durationMs: routingResult.durationMs,
      detail: `Routed to ${routing.department}`,
      output: routing,
    },
    {
      key: "workorder",
      label: "Work Order Created",
      status: workOrderResult.status,
      durationMs: workOrderResult.durationMs,
      detail: `${workOrder.workOrderRef} created (${workOrder.slaHours}h SLA) · Status: ${workOrder.status}`,
      output: workOrder,
    },
  ];

  // Update report in DB if persist is true
  if (persist && reportId) {
    await db.updateReport(reportId, {
      category: triage.category,
      priority: priority.priority,
      department: routing.department,
      workOrder: workOrder.workOrderRef,
      dueDate: workOrder.dueDate,
      slaDueAt: workOrder.dueDate,
      status: workOrder.status,
      ai,
    }).catch((err) => {
      console.warn(`[Orchestrator] Failed updating report ${reportId} in DB:`, err.message);
    });
  }

  return {
    category: triage.category,
    categoryLabel: triage.categoryLabel,
    priority: priority.priority,
    department: routing.department,
    status: workOrder.status,
    dueDate: workOrder.dueDate,
    slaDueAt: workOrder.dueDate,
    workOrder: workOrder.workOrderRef,
    ai,
    activity: activityEntries,
    steps,
    agentRuns,
  };
}
