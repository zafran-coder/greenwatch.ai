import { runOrchestrator } from "./orchestrator.js";

/**
 * Coordinate the GreenWatch AI Agent Pipeline:
 * Citizen Report → Triage Agent → Evidence Agent → Duplicate Detection Agent → Priority Agent → Department Routing Agent → Work Order Creator (→ Follow-up Agent on review)
 *
 * Each step is saved as an AgentRun and an ActivityLog entry (actor AI, neutral wording).
 * Each agent has Zod-validated output, a timeout, 2 retries with backoff, and a rule-based fallback.
 */
export async function runReportPipeline({
  reportId,
  description = "",
  location = {},
  photos = [],
  photoBuffers = [],
  existingReports = [],
  workOrderRef,
  geminiClient = null,
  llmClient = null,
  persist = false,
}) {
  return runOrchestrator({
    reportId,
    description,
    location,
    photos,
    photoBuffers,
    existingReports,
    workOrderRef,
    llmClient: llmClient || geminiClient,
    persist,
  });
}
