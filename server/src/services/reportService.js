import { db } from "../db/client.js";
import { runReportPipeline } from "../agents/pipeline.js";
import { evaluateFollowUp } from "../agents/followUpAgent.js";
import { NotFoundError } from "../lib/errors.js";

export const reportService = {
  async createReport({ description, location, photos = [] }) {
    const { items: existingReports } = await db.findReports({ take: 100 });

    const ref = db.nextRef();
    const workOrderRef = db.nextWorkOrder();

    // Execute the 7-stage AI agent pipeline
    const pipelineResult = await runReportPipeline({
      description,
      location,
      photos,
      existingReports,
      workOrderRef,
    });

    const now = new Date().toISOString();

    const reportData = {
      ref,
      category: pipelineResult.category,
      description: description.trim(),
      location: {
        address: location.address.trim(),
        area: location.area || "Reported via app",
        lat: location.lat || null,
        lng: location.lng || null,
      },
      photos: photos || [],
      priority: pipelineResult.priority,
      status: "Assigned",
      department: pipelineResult.department,
      assignee: null,
      dueDate: pipelineResult.dueDate,
      resolvedAt: null,
      workOrder: pipelineResult.workOrder,
      ai: pipelineResult.ai,
      activity: pipelineResult.activity,
      createdAt: now,
      updatedAt: now,
    };

    const created = await db.createReport(reportData);

    return {
      report: created,
      steps: pipelineResult.steps,
    };
  },

  async getReports(filters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const { items, total } = await db.findReports({
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      department: filters.department,
      q: filters.q,
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getReportByIdOrRef(idOrRef) {
    let report = await db.findReportById(idOrRef);
    if (!report) {
      report = await db.findReportByRef(idOrRef);
    }
    if (!report) {
      throw new NotFoundError(`Report with identifier “${idOrRef}” not found`);
    }
    return report;
  },

  async updateReport(id, patch, user = null) {
    const current = await this.getReportByIdOrRef(id);

    let activityEntry = patch.activityEntry || null;
    const authorName = user ? user.name || "Official" : "Official";

    if (patch.note && !activityEntry) {
      activityEntry = {
        kind: "human",
        who: authorName,
        text: `Note: “${patch.note}”`,
      };
    } else if (patch.status && patch.status !== current.status && !activityEntry) {
      activityEntry = {
        kind: "human",
        who: authorName,
        text: `Status changed from ${current.status} to ${patch.status}.`,
      };
    }

    const updated = await db.updateReport(current.id, patch, activityEntry);

    // If marked as Resolved, Follow-up Agent automatically schedules citizen confirmation
    if (patch.status === "Resolved" && current.status !== "Resolved") {
      await db.addActivity(current.id, {
        kind: "agent",
        who: "Follow-up Agent",
        text: "Citizen notified and asked to confirm the fix.",
      });
    }

    return db.findReportById(current.id);
  },

  async addActivity(id, { kind = "human", who, text }) {
    const report = await this.getReportByIdOrRef(id);
    const updated = await db.addActivity(report.id, { kind, who, text });
    return updated;
  },

  async triggerFollowUp(id) {
    const report = await this.getReportByIdOrRef(id);
    const evaluation = evaluateFollowUp(report);

    if (evaluation.action !== "none") {
      await db.addActivity(report.id, {
        kind: "agent",
        who: "Follow-up Agent",
        text: evaluation.message,
      });
    }

    const updated = await db.findReportById(report.id);
    return {
      evaluation,
      report: updated,
    };
  },
};
