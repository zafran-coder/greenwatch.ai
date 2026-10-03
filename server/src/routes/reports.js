import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import {
  createReportSchema,
  updateReportSchema,
  addActivitySchema,
  reportQuerySchema,
} from "../schemas/reportSchema.js";
import { reportService } from "../services/reportService.js";

export const reportsRouter = Router();

// Public: Submit new citizen report (triggers full AI Agent Pipeline)
reportsRouter.post(
  "/",
  validate({ body: createReportSchema }),
  async (req, res, next) => {
    try {
      const { report, steps } = await reportService.createReport(req.body);
      res.status(201).json({
        data: report,
        steps,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Public / Official: List reports with filters and search
reportsRouter.get(
  "/",
  validate({ query: reportQuerySchema }),
  async (req, res, next) => {
    try {
      const result = await reportService.getReports(req.query);
      res.status(200).json({
        data: result.items,
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

// Citizen: Track report specifically by reference GW-XXXX
reportsRouter.get("/track/:ref", async (req, res, next) => {
  try {
    const report = await reportService.getReportByIdOrRef(req.params.ref);
    res.status(200).json({ data: report });
  } catch (err) {
    next(err);
  }
});

// Public / Official: Get single report by ID or GW-XXXX reference
reportsRouter.get("/:id", async (req, res, next) => {
  try {
    const report = await reportService.getReportByIdOrRef(req.params.id);
    res.status(200).json({ data: report });
  } catch (err) {
    next(err);
  }
});

// Official / Admin: Patch report status, priority, department, assignee, or note
reportsRouter.patch(
  "/:id",
  optionalAuth,
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

// Official / Admin: Append manual note or activity
reportsRouter.post(
  "/:id/activity",
  optionalAuth,
  validate({ body: addActivitySchema }),
  async (req, res, next) => {
    try {
      const updated = await reportService.addActivity(req.params.id, {
        kind: req.body.kind,
        who: req.body.who || (req.user ? req.user.name : "Official"),
        text: req.body.text,
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
