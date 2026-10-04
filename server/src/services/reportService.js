import { db } from "../db/client.js";
import { runReportPipeline } from "../agents/pipeline.js";
import { evaluateFollowUp } from "../agents/followUpAgent.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";
import { validateStatusTransition } from "../lib/stateMachine.js";
import { storage, resolvePhotoUrl, resolvePhotoUrls } from "./storage/index.js";
import { processEvidenceImage } from "../lib/imageProcessor.js";
import { registerImageBuffer, analyzePhotoEvidence } from "../agents/evidenceAgent.js";
import { pipelineQueue } from "../agents/queue.js";

export const reportService = {
  async createReport({ description, location, photos = [], uploadedFiles = [] }) {
    const { items: existingReports } = await db.findReports({ take: 100 });

    const ref = db.nextRef();
    const workOrderRef = db.nextWorkOrder();
    const reportId = `r${Date.now().toString(36)}`;

    const processedPhotoItems = [];
    const photoBuffers = [];
    const photoUrls = Array.isArray(photos) ? [...photos] : [];

    // Process any multipart photo files attached during report creation
    if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      if (uploadedFiles.length > 4) {
        throw new BadRequestError("Maximum 4 photos allowed per upload.");
      }

      for (const file of uploadedFiles) {
        const processed = await processEvidenceImage(file.buffer, { reportId });
        registerImageBuffer(processed.main.path, processed.main.buffer);

        const mainUpload = await storage.upload({
          path: processed.main.path,
          buffer: processed.main.buffer,
          contentType: "image/webp",
        });

        const thumbUpload = await storage.upload({
          path: processed.thumbnail.path,
          buffer: processed.thumbnail.buffer,
          contentType: "image/webp",
        });

        const evidenceAnalysis = await analyzePhotoEvidence({
          buffer: processed.main.buffer,
          width: processed.main.width,
          height: processed.main.height,
          size: processed.main.size,
          gpsLocation: processed.gpsLocation,
          description,
        });

        processedPhotoItems.push({
          processed,
          mainUpload,
          thumbUpload,
          evidenceAnalysis,
        });

        photoUrls.push(mainUpload.url);
        photoBuffers.push({
          buffer: processed.main.buffer,
          width: processed.main.width,
          height: processed.main.height,
          size: processed.main.size,
          gpsLocation: processed.gpsLocation,
        });

        // Use EXIF GPS as location hint if citizen didn't provide coordinates
        if ((!location.lat || !location.lng) && processed.gpsLocation) {
          location.lat = processed.gpsLocation.lat;
          location.lng = processed.gpsLocation.lng;
        }
      }
    }

    const now = new Date().toISOString();

    // Step 1: Report is saved immediately as "New"
    const initialReportData = {
      id: reportId,
      ref,
      category: "garbage", // baseline until triage completes
      description: description.trim(),
      location: {
        address: location.address.trim(),
        area: location.area || "Reported via app",
        lat: location.lat || null,
        lng: location.lng || null,
      },
      photos: photoUrls,
      priority: "Medium",
      status: "New",
      department: "Sanitation",
      assignee: null,
      dueDate: null,
      slaDueAt: null,
      resolvedAt: null,
      workOrder: workOrderRef,
      ai: null,
      activity: [
        {
          kind: "human",
          who: "Citizen",
          text: "Citizen submitted report.",
          at: now,
          isInternal: false,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const created = await db.createReport(initialReportData);

    // Save individual photo records to the Photo table in Postgres
    const savedPhotos = [];
    for (const item of processedPhotoItems) {
      const photoRow = await db.createPhoto({
        reportId: created.id,
        path: item.processed.main.path,
        url: item.mainUpload.url,
        thumbnailPath: item.processed.thumbnail.path,
        thumbnailUrl: item.thumbUpload.url,
        size: item.processed.main.size,
        width: item.processed.main.width,
        height: item.processed.main.height,
        evidenceAnalysis: item.evidenceAnalysis,
        createdAt: now,
      });
      savedPhotos.push(photoRow);
    }

    // Step 2: Enqueue into in-process queue and execute agent pipeline asynchronously
    const job = pipelineQueue.enqueue({
      reportId: created.id,
      description,
      location,
      photos: photoUrls,
      photoBuffers,
      existingReports,
      workOrderRef,
    });

    // Await completion for synchronous clients & API test suites
    let enriched = created;
    try {
      const pipelineResult = await pipelineQueue.waitForJob(created.id, 10000);
      enriched = (await db.findReportById(created.id)) || created;
      return {
        report: enriched,
        photos: savedPhotos,
        steps: pipelineResult.steps || job.steps,
      };
    } catch (err) {
      console.warn(`[ReportService] Pipeline awaiting timed out, returning initial:`, err.message);
      return {
        report: enriched,
        photos: savedPhotos,
        steps: job.steps,
      };
    }
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
      sortBy: filters.sortBy || "createdAt",
      sortOrder: filters.sortOrder || "desc",
      skip,
      take: limit,
    });

    const itemsWithSignedPhotos = await Promise.all(
      items.map(async (item) => ({
        ...item,
        photos: await resolvePhotoUrls(item.photos),
      }))
    );

    return {
      items: itemsWithSignedPhotos,
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
    report.photos = await resolvePhotoUrls(report.photos);
    return report;
  },

  /**
   * Citizen-safe tracking view.
   * Strips internal notes (isInternal: true) and contact info.
   * Returns short-lived signed URLs for evidence photos.
   */
  async getTrackReport(ref) {
    const report = await this.getReportByIdOrRef(ref);

    // Build timeline milestones
    const timeline = [
      { status: "New", at: report.createdAt },
    ];
    if (report.status !== "New") {
      timeline.push({ status: "Assigned", at: report.updatedAt });
    }
    if (report.status === "In Progress" || report.status === "Resolved") {
      timeline.push({ status: "In Progress", at: report.updatedAt });
    }
    if (report.status === "Resolved") {
      timeline.push({ status: "Resolved", at: report.resolvedAt || report.updatedAt });
    }

    // Filter activity: NEVER leak internal notes
    const publicActivity = (report.activity || []).filter(
      (a) => !a.isInternal && a.kind !== "internal"
    );

    // Ensure citizen gets fresh signed URLs
    const resolvedPhotos = await resolvePhotoUrls(report.photos || []);

    return {
      ref: report.ref,
      category: report.category,
      description: report.description,
      status: report.status,
      priority: report.priority,
      department: report.department,
      location: {
        address: report.location?.address || "",
        area: report.location?.area || "",
      },
      photos: resolvedPhotos,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      dueDate: report.dueDate,
      slaDueAt: report.slaDueAt || report.dueDate,
      resolvedAt: report.resolvedAt,
      timeline,
      activity: publicActivity,
    };
  },

  /**
   * Updates report with state machine enforcement and atomic activity logging.
   */
  async updateReport(id, patch, user = null) {
    const current = await this.getReportByIdOrRef(id);
    const authorName = user ? user.name || "Official" : "Official";

    // 1. Enforce State Machine if status change requested
    if (patch.status && patch.status !== current.status) {
      validateStatusTransition(current.status, patch.status);
    }

    // 2. Auto-promote to Assigned if assigning official to New/Verified report
    if (
      patch.assignee &&
      !patch.status &&
      (current.status === "New" || current.status === "Verified")
    ) {
      patch.status = "Assigned";
    }

    // 3. Sync SLA fields
    if (patch.dueDate || patch.slaDueAt) {
      const targetSla = patch.dueDate || patch.slaDueAt;
      patch.dueDate = targetSla;
      patch.slaDueAt = targetSla;
    }

    // 4. Construct audit activity entry in the same transaction
    let activityEntry = patch.activityEntry || null;
    if (!activityEntry) {
      if (patch.note) {
        activityEntry = {
          kind: "human",
          who: authorName,
          text: `Note: “${patch.note}”`,
          isInternal: patch.isInternal !== undefined ? Boolean(patch.isInternal) : true,
        };
      } else if (patch.assignee && patch.assignee !== current.assignee) {
        activityEntry = {
          kind: "human",
          who: authorName,
          text: `Assigned to ${patch.assignee}.${patch.status === "Assigned" ? " Status moved to Assigned." : ""}`,
          isInternal: false,
        };
      } else if (patch.status && patch.status !== current.status) {
        activityEntry = {
          kind: "human",
          who: authorName,
          text: `Status changed from ${current.status} to ${patch.status}.`,
          isInternal: false,
        };
      } else if (patch.dueDate && patch.dueDate !== current.dueDate) {
        activityEntry = {
          kind: "human",
          who: authorName,
          text: `SLA due date updated to ${patch.dueDate}.`,
          isInternal: false,
        };
      }
    }

    await db.updateReport(current.id, patch, activityEntry);

    // 5. Follow-up hook when status transitions to Resolved
    if (patch.status === "Resolved" && current.status !== "Resolved") {
      await db.addActivity(current.id, {
        kind: "agent",
        who: "Follow-up Agent",
        text: "Citizen notified and asked to confirm the fix.",
        isInternal: false,
      });
    }

    return db.findReportById(current.id);
  },

  /**
   * Modify work order assignment and/or SLA date.
   */
  async updateWorkOrder(id, { assignee, assignedUserId, dueDate, slaDueAt, note }, user = null) {
    const patch = {};
    if (assignee !== undefined) patch.assignee = assignee;
    if (assignedUserId !== undefined) patch.assignedUserId = assignedUserId;
    if (dueDate !== undefined) patch.dueDate = dueDate;
    if (slaDueAt !== undefined) patch.slaDueAt = slaDueAt;
    if (note) patch.note = note;

    return this.updateReport(id, patch, user);
  },

  /**
   * Append manual internal official note or audit activity.
   */
  async addActivity(id, { kind = "human", who, text, isInternal = true }) {
    const report = await this.getReportByIdOrRef(id);
    const updated = await db.addActivity(report.id, {
      kind,
      who,
      text,
      isInternal: Boolean(isInternal),
    });
    return updated;
  },

  /**
   * Retrieve activity logs for a report.
   * If unauthenticated, internal notes are excluded.
   */
  async getActivities(id, user = null) {
    const report = await this.getReportByIdOrRef(id);
    if (!user) {
      return (report.activity || []).filter((a) => !a.isInternal && a.kind !== "internal");
    }
    return report.activity || [];
  },

  async triggerFollowUp(id) {
    const report = await this.getReportByIdOrRef(id);
    const evaluation = evaluateFollowUp(report);

    if (evaluation.action !== "none") {
      await db.addActivity(report.id, {
        kind: "agent",
        who: "Follow-up Agent",
        text: evaluation.message,
        isInternal: false,
      });
    }

    const updated = await db.findReportById(report.id);
    return {
      evaluation,
      report: updated,
    };
  },

  /**
   * PROGRESS API: Retrieve real progress and output for each agent in the pipeline.
   */
  async getPipelineProgress(idOrRef) {
    const report = await this.getReportByIdOrRef(idOrRef);
    const job = await pipelineQueue.getJob(report.id);

    const sanitizeRuns = (runs = []) => {
      if (!Array.isArray(runs)) return [];
      return runs.map((r) => {
        const { provider, fallbackReason, fallback_reason, ...safeRun } = r;
        return safeRun;
      });
    };

    if (job) {
      return {
        reportId: report.id,
        ref: report.ref,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        steps: job.steps,
        agentRuns: sanitizeRuns(job.agentRuns),
      };
    }

    // If job was completed before server reboot, reconstruct from DB report state
    const agentRuns = db.findAgentRunsByReportId ? await db.findAgentRunsByReportId(report.id) : [];
    return {
      reportId: report.id,
      ref: report.ref,
      status: "completed",
      steps: [
        { key: "triage", label: "Triage Agent", status: "completed", detail: `Classified as ${report.category}` },
        { key: "evidence", label: "Evidence Agent", status: "completed", detail: `Evidence: ${report.ai?.evidence || "Good"}` },
        { key: "duplicates", label: "Duplicate Detection", status: "completed", detail: `Similar found: ${report.ai?.similar?.count || 0}` },
        { key: "priority", label: "Priority Agent", status: "completed", detail: `Priority: ${report.priority}` },
        { key: "routing", label: "Department Routing", status: "completed", detail: `Routed to ${report.department}` },
        { key: "workorder", label: "Work Order Created", status: "completed", detail: `Work Order: ${report.workOrder || report.workOrderRef}` },
      ],
      agentRuns: sanitizeRuns(agentRuns),
    };
  },

  /**
   * HUMAN IN THE LOOP: Official override of AI decisions.
   * Lets an official accept or override category/priority/department;
   * the override is logged with the old AI value.
   */
  async overrideAiDecision(idOrRef, { category, priority, department, reason = "" }, user = null) {
    const current = await this.getReportByIdOrRef(idOrRef);
    const authorName = user ? user.name || "Official" : "Official";

    const changes = [];
    const patch = {};

    if (category && category !== current.category) {
      changes.push(`category from “${current.category}” to “${category}”`);
      patch.category = category;
    }
    if (priority && priority !== current.priority) {
      changes.push(`priority from “${current.priority}” to “${priority}”`);
      patch.priority = priority;
    }
    if (department && department !== current.department) {
      changes.push(`department from “${current.department}” to “${department}”`);
      patch.department = department;
    }

    const reasonNote = reason && reason.trim().length > 0 ? ` (Reason: “${reason.trim()}”)` : "";
    const logText =
      changes.length > 0
        ? `Official ${authorName} overridden AI decision: changed ${changes.join(", ")}${reasonNote}`
        : `Official ${authorName} confirmed AI classification${reasonNote}`;

    const activityEntry = {
      kind: "human",
      who: authorName,
      text: logText,
      isInternal: false,
    };

    await db.updateReport(current.id, patch, activityEntry);
    return db.findReportById(current.id);
  },

  /**
   * Upload evidence photos to an existing report.
   * Processes each image with sharp, stores in storage driver,
   * creates rows in the Photo table, and updates report.photos and activity log.
   */
  async addPhotosToReport(idOrRef, uploadedFiles) {
    const report = await this.getReportByIdOrRef(idOrRef);

    if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
      throw new BadRequestError("No photos provided in upload request.");
    }

    if (uploadedFiles.length > 4) {
      throw new BadRequestError("Maximum 4 photos allowed per upload.");
    }

    const createdPhotos = [];
    const newUrls = [];

    for (const file of uploadedFiles) {
      const processed = await processEvidenceImage(file.buffer, { reportId: report.id });
      registerImageBuffer(processed.main.path, processed.main.buffer);

      const mainUpload = await storage.upload({
        path: processed.main.path,
        buffer: processed.main.buffer,
        contentType: "image/webp",
      });

      const thumbUpload = await storage.upload({
        path: processed.thumbnail.path,
        buffer: processed.thumbnail.buffer,
        contentType: "image/webp",
      });

      const evidenceAnalysis = await analyzePhotoEvidence({
        buffer: processed.main.buffer,
        width: processed.main.width,
        height: processed.main.height,
        size: processed.main.size,
        gpsLocation: processed.gpsLocation,
        description: report.description,
      });

      const photoRecord = await db.createPhoto({
        reportId: report.id,
        path: processed.main.path,
        url: mainUpload.url,
        thumbnailPath: processed.thumbnail.path,
        thumbnailUrl: thumbUpload.url,
        size: processed.main.size,
        width: processed.main.width,
        height: processed.main.height,
        evidenceAnalysis,
        createdAt: new Date().toISOString(),
      });

      createdPhotos.push(photoRecord);
      newUrls.push(mainUpload.url);
    }

    // Append to report.photos
    const currentPhotos = Array.isArray(report.photos) ? report.photos : [];
    const updatedPhotos = [...currentPhotos, ...newUrls];

    // Audit log
    const auditText = `Added ${createdPhotos.length} evidence photo${createdPhotos.length > 1 ? "s" : ""}. Visual clarity: ${createdPhotos[0]?.evidenceAnalysis?.clarity || "Verified"}.`;
    await db.updateReport(
      report.id,
      { photos: updatedPhotos },
      {
        kind: "agent",
        who: "Evidence Agent",
        text: auditText,
        isInternal: false,
      }
    );

    const refreshedReport = await db.findReportById(report.id);
    return {
      photos: createdPhotos,
      report: refreshedReport,
    };
  },

  /**
   * Retrieve all photo metadata records for a given report with fresh signed URLs.
   */
  async getReportPhotos(idOrRef) {
    const report = await this.getReportByIdOrRef(idOrRef);
    const photos = await db.findPhotosByReportId(report.id);
    return Promise.all(
      photos.map(async (p) => ({
        ...p,
        url: (await resolvePhotoUrl(p.path || p.url)) || p.url,
        thumbnailUrl: (await resolvePhotoUrl(p.thumbnailPath || p.thumbnailUrl)) || p.thumbnailUrl,
      }))
    );
  },

  /**
   * Delete report and purge all associated evidence photo files from storage.
   */
  async deleteReport(idOrRef) {
    const report = await this.getReportByIdOrRef(idOrRef);
    const photos = await db.findPhotosByReportId(report.id);

    // Collect all storage paths to purge
    const pathsToDelete = [];
    for (const p of photos) {
      if (p.path) pathsToDelete.push(p.path);
      if (p.thumbnailPath) pathsToDelete.push(p.thumbnailPath);
    }

    // 1. Delete files from storage (Supabase bucket or LocalDisk)
    if (pathsToDelete.length > 0) {
      try {
        await storage.delete(pathsToDelete);
      } catch (err) {
        console.warn(`[Storage] Error deleting files for report ${report.id}:`, err.message);
      }
    }

    // 2. Cascade delete from DB
    await db.deleteReport(report.id);

    return {
      success: true,
      message: `Report ${report.ref} and ${pathsToDelete.length} evidence files deleted.`,
      id: report.id,
      ref: report.ref,
      deletedFilesCount: pathsToDelete.length,
    };
  },
};
