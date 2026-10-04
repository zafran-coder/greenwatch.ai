import { runOrchestrator } from "./orchestrator.js";
import { db } from "../db/client.js";

function sanitizeAgentRuns(runs = []) {
  if (!Array.isArray(runs)) return [];
  return runs.map((r) => {
    const { provider, fallbackReason, fallback_reason, ...safeRun } = r;
    return safeRun;
  });
}

/**
 * In-Process Pipeline Execution Queue.
 * Enables reports to be saved immediately as "New" while the 6-agent
 * pipeline runs asynchronously in the background and enriches the record.
 *
 * Tracks live progress so GET /api/reports/:id/pipeline returns step-by-step
 * status for visual AgentStepper displays.
 */
class PipelineQueue {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Enqueue a report for asynchronous AI pipeline execution.
   * @param {Object} jobData
   * @param {string} jobData.reportId
   * @param {string} jobData.description
   * @param {Object} jobData.location
   * @param {Array<string>} [jobData.photos=[]]
   * @param {Array<Object>} [jobData.photoBuffers=[]]
   * @param {Array<Object>} [jobData.existingReports=[]]
   * @param {string} jobData.workOrderRef
   * @param {Object} [jobData.llmClient=null]
   * @returns {Object} job metadata with execution promise
   */
  enqueue(jobData) {
    const { reportId } = jobData;

    const initialSteps = [
      { key: "triage", label: "Triage Agent", status: "pending", detail: "Waiting to analyze category and confidence..." },
      { key: "evidence", label: "Evidence Agent", status: "pending", detail: "Waiting to verify visual photographic proof..." },
      { key: "duplicates", label: "Duplicate Detection", status: "pending", detail: "Waiting to scan ~150m geographic radius..." },
      { key: "priority", label: "Priority Agent", status: "pending", detail: "Waiting to evaluate health risk and POI proximity..." },
      { key: "routing", label: "Department Routing", status: "pending", detail: "Waiting to assign responsible department..." },
      { key: "workorder", label: "Work Order Created", status: "pending", detail: "Waiting to generate work order reference and SLA..." },
    ];

    const job = {
      id: `job-${reportId}`,
      reportId,
      status: "pending", // "pending" | "running" | "completed" | "failed"
      startedAt: null,
      completedAt: null,
      steps: initialSteps,
      agentRuns: [],
      result: null,
      error: null,
    };

    const taskPromise = (async () => {
      job.status = "running";
      job.startedAt = new Date().toISOString();

      try {
        const result = await runOrchestrator({
          reportId: jobData.reportId,
          description: jobData.description,
          location: jobData.location,
          photos: jobData.photos,
          photoBuffers: jobData.photoBuffers,
          existingReports: jobData.existingReports,
          workOrderRef: jobData.workOrderRef,
          llmClient: jobData.llmClient,
          persist: true,
        });


        job.status = "completed";
        job.completedAt = new Date().toISOString();
        job.result = result;
        job.steps = result.steps;
        job.agentRuns = sanitizeAgentRuns(result.agentRuns);

        return result;
      } catch (err) {
        job.status = "failed";
        job.completedAt = new Date().toISOString();
        job.error = err.message;
        console.error(`[PipelineQueue] Job for report ${reportId} failed:`, err);
        throw err;
      }
    })();

    job.promise = taskPromise;
    this.jobs.set(reportId, job);

    return job;
  }

  /**
   * Retrieve active or completed job by reportId.
   * If not in in-memory queue, attempts to reconstruct from AgentRuns in DB.
   * @param {string} reportId
   * @returns {Promise<Object|null>}
   */
  async getJob(reportId) {
    if (this.jobs.has(reportId)) {
      const j = this.jobs.get(reportId);
      return {
        reportId: j.reportId,
        status: j.status,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        steps: j.steps,
        agentRuns: sanitizeAgentRuns(j.agentRuns),
        error: j.error,
        result: j.result,
      };
    }

    // Reconstruct from DB AgentRuns
    if (db.findAgentRunsByReportId) {
      const runs = await db.findAgentRunsByReportId(reportId);
      if (runs && runs.length > 0) {
        const steps = runs.map((r) => ({
          key: r.agentName,
          label: `${r.agentName.charAt(0).toUpperCase() + r.agentName.slice(1)} Agent`,
          status: r.status,
          durationMs: r.durationMs,
          output: r.output,
          error: r.error,
        }));

        return {
          reportId,
          status: "completed",
          startedAt: runs[0].createdAt,
          completedAt: runs[runs.length - 1].createdAt,
          steps,
          agentRuns: sanitizeAgentRuns(runs),
          error: null,
        };
      }
    }

    return null;
  }

  /**
   * Await job completion with a configurable timeout.
   * @param {string} reportId
   * @param {number} [timeoutMs=15000]
   * @returns {Promise<Object>}
   */
  async waitForJob(reportId, timeoutMs = 15000) {
    const job = this.jobs.get(reportId);
    if (!job) {
      throw new Error(`Job for report ${reportId} not found in pipeline queue.`);
    }

    if (job.status === "completed" && job.result) {
      return job.result;
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for pipeline job ${reportId}`)), timeoutMs)
    );

    return Promise.race([job.promise, timeout]);
  }
}

export const pipelineQueue = new PipelineQueue();
