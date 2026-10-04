import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import {
  reportsLimiter,
  trackLimiter,
  honeypotCheck,
  ipDailyReportCap,
} from "../middleware/rateLimiter.js";
import {
  createReportSchema,
  updateReportSchema,
  updateStatusSchema,
  updateWorkOrderSchema,
  addActivitySchema,
  reportQuerySchema,
} from "../schemas/reportSchema.js";
import { reportService } from "../services/reportService.js";
import {
  uploadPhotosMiddleware,
  optionalReportUploadMiddleware,
} from "../middleware/upload.js";

export const reportsRouter = Router();

// Public: Submit new citizen report (triggers full AI Agent Pipeline)
// Accepts either JSON payload or multipart/form-data with attached photos
// Protected by strict rate limits, per-IP daily cap, and honeypot detection
reportsRouter.post(
  "/",
  reportsLimiter,
  ipDailyReportCap,
  honeypotCheck,
  optionalReportUploadMiddleware,
  validate({ body: createReportSchema }),
  async (req, res, next) => {
    try {
      const { report, photos, steps } = await reportService.createReport({
        ...req.body,
        uploadedFiles: req.uploadedFiles || req.files || [],
      });
      res.status(201).json({
        data: report,
        photos,
        steps,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Public / Official: List reports with multi-criteria filters, sorting, and pagination
reportsRouter.get(
  "/",
  validate({ query: reportQuerySchema }),
  async (req, res, next) => {
    try {
      const result = await reportService.getReports(req.query);
      res.status(200).json({
        data: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Citizen: Track report specifically by reference (GW-XXXX)
// Public, citizen-safe: strips internal notes and contact info
reportsRouter.get("/track/:ref", trackLimiter, async (req, res, next) => {
  try {
    const report = await reportService.getTrackReport(req.params.ref);
    res.status(200).json({ data: report });
  } catch (err) {
    next(err);
  }
});

// Public / Official: Get single report by internal ID or GW-XXXX reference
reportsRouter.get("/:id", async (req, res, next) => {
  try {
    const report = await reportService.getReportByIdOrRef(req.params.id);
    res.status(200).json({ data: report });
  } catch (err) {
    next(err);
  }
});

// Official / Admin: Patch report status, priority, department, assignee, or note
// Requires authentication (Rule 6). Illegal status moves return 409.
reportsRouter.patch(
  "/:id",
  authenticate,
  validate({ body: updateReportSchema }),
  async (req, res, next) => {
    try {
      const updated = await reportService.updateReport(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Official / Admin: Explicit status change through state machine
// Requires authentication. Illegal moves return 409 Conflict.
reportsRouter.patch(
  "/:id/status",
  authenticate,
  validate({ body: updateStatusSchema }),
  async (req, res, next) => {
    try {
      const updated = await reportService.updateReport(
        req.params.id,
        { status: req.body.status, note: req.body.note },
        req.user
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Official / Admin: Assign official or update SLA due date
// Requires authentication.
reportsRouter.patch(
  "/:id/work-order",
  authenticate,
  validate({ body: updateWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const updated = await reportService.updateWorkOrder(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Progress API: GET /api/reports/:id/pipeline returns each agent's status/output
reportsRouter.get("/:id/pipeline", async (req, res, next) => {
  try {
    const progress = await reportService.getPipelineProgress(req.params.id);
    res.status(200).json({ data: progress });
  } catch (err) {
    next(err);
  }
});

// Human-in-the-Loop: PATCH /api/reports/:id/ai-decision lets an official accept or override AI decisions
reportsRouter.patch(
  ["/:id/ai-decision", "/:id/ai"],
  authenticate,
  async (req, res, next) => {
    try {
      const updated = await reportService.overrideAiDecision(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Activity: GET per report (unauthenticated requests never receive isInternal: true)
reportsRouter.get("/:id/activity", optionalAuth, async (req, res, next) => {
  try {
    const activities = await reportService.getActivities(req.params.id, req.user);
    res.status(200).json({ data: activities });
  } catch (err) {
    next(err);
  }
});

// Activity: POST internal official note (isInternal=true)
// Requires authentication.
reportsRouter.post(
  "/:id/activity",
  authenticate,
  validate({ body: addActivitySchema }),
  async (req, res, next) => {
    try {
      const isInternal = req.body.isInternal !== undefined ? req.body.isInternal : true;
      const updated = await reportService.addActivity(req.params.id, {
        kind: req.body.kind,
        who: req.body.who || (req.user ? req.user.name : "Official"),
        text: req.body.text,
        isInternal,
      });
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Trigger Follow-up Agent SLA check / escalation
reportsRouter.post("/:id/follow-up", async (req, res, next) => {
  try {
    const result = await reportService.triggerFollowUp(req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Evidence Photos: POST /api/reports/:id/photos (multipart, max 4 images, 5MB each)
reportsRouter.post(
  "/:id/photos",
  uploadPhotosMiddleware,
  async (req, res, next) => {
    try {
      const result = await reportService.addPhotosToReport(
        req.params.id,
        req.uploadedFiles || req.files
      );
      res.status(201).json({
        data: result.photos,
        report: result.report,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Evidence Photos: GET /api/reports/:id/photos
reportsRouter.get("/:id/photos", async (req, res, next) => {
  try {
    const photos = await reportService.getReportPhotos(req.params.id);
    res.status(200).json({ data: photos });
  } catch (err) {
    next(err);
  }
});

// Report Deletion: DELETE /api/reports/:id (deletes report AND purges its storage files)
reportsRouter.delete("/:id", optionalAuth, async (req, res, next) => {
  try {
    const result = await reportService.deleteReport(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

