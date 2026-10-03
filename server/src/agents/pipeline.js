import { runTriageAgent } from "./triageAgent.js";
import { runEvidenceAgent } from "./evidenceAgent.js";
import { runDuplicateAgent } from "./duplicateAgent.js";
import { runPriorityAgent } from "./priorityAgent.js";
import { runRoutingAgent } from "./routingAgent.js";
import { runWorkOrderAgent } from "./workOrderAgent.js";

/**
 * Coordinate the 7-stage GreenWatch AI Pipeline:
 * Citizen Report → Triage Agent → Evidence Agent → Duplicate Detection Agent → Priority Agent → Department Routing Agent → Work Order (→ Follow-up Agent on review)
 *
 * Rule 5: All AI output is untrusted and strictly schema-validated.
 * Deterministic fallback ensures 100% availability.
 */
export async function runReportPipeline({
  description,
  location,
  photos = [],
  existingReports = [],
  workOrderRef,
  geminiClient = null,
}) {
  const now = new Date().toISOString();
  const photoCount = Array.isArray(photos) ? photos.length : 0;

  // 1. Triage Agent
  const triage = await runTriageAgent(description, photoCount, geminiClient);

  // 2. Evidence Agent
  const evidence = runEvidenceAgent(description, photos);

  // 3. Duplicate Detection Agent
  const duplicates = runDuplicateAgent(triage.category, location, existingReports);

  // 4. Priority Agent
  const priority = runPriorityAgent(triage.category, description);

  // 5. Department Routing Agent
  const routing = runRoutingAgent(triage.category, description);

  // 6. Work Order Agent
  const workOrder = runWorkOrderAgent(workOrderRef, priority.dueDays);

  // Unified AI metadata shape matching frontend expectations
  const ai = {
    severity: priority.priority,
    reason: priority.reason,
    evidence: evidence.evidence,
    confidence: triage.confidence,
    similar: {
      count: duplicates.similarCount,
      ids: duplicates.similarIds,
    },
  };

  // Activity audit log entries from agents
  const activity = [
    {
      kind: "agent",
      who: "Triage Agent",
      text: `Classified as ${triage.categoryLabel} (${triage.confidence}% confidence).`,
      at: now,
    },
    {
      kind: "agent",
      who: "Evidence Agent",
      text: evidence.summary,
      at: now,
    },
    ...(duplicates.similarCount > 0
      ? [
          {
            kind: "agent",
            who: "Duplicate Detection",
            text: duplicates.summary,
            at: now,
          },
        ]
      : []),
    {
      kind: "agent",
      who: "Priority Agent",
      text: priority.summary,
      at: now,
    },
    {
      kind: "agent",
      who: "Routing Agent",
      text: `Routed to ${routing.department}. Work order ${workOrder.workOrderRef} created.`,
      at: now,
    },
  ];

  // Visual stepper steps for frontend UI (matches buildAgentSteps shape)
  const steps = [
    {
      key: "triage",
      label: "Triage Agent",
      detail: `Classified as ${triage.categoryLabel} · ${triage.confidence}% confident`,
    },
    {
      key: "evidence",
      label: "Evidence Agent",
      detail: evidence.summary,
    },
    {
      key: "duplicates",
      label: "Duplicate Detection",
      detail:
        duplicates.similarCount > 0
          ? `Scanned recent reports · ${duplicates.similarCount} similar found nearby`
          : "Scanned recent reports · no duplicates nearby",
    },
    {
      key: "priority",
      label: "Priority Agent",
      detail: `Marked ${priority.priority} — ${priority.reason}`,
    },
    {
      key: "routing",
      label: "Department Routing",
      detail: `Routed to ${routing.department}`,
    },
    {
      key: "workorder",
      label: "Work Order Created",
      detail: `${workOrder.workOrderRef} created and sent to the ${routing.department} queue`,
    },
  ];

  return {
    category: triage.category,
    categoryLabel: triage.categoryLabel,
    priority: priority.priority,
    department: routing.department,
    dueDate: workOrder.dueDate,
    workOrder: workOrder.workOrderRef,
    ai,
    activity,
    steps,
  };
}
