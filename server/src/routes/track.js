import { Router } from "express";
import { trackLimiter } from "../middleware/rateLimiter.js";
import { reportService } from "../services/reportService.js";

export const trackRouter = Router();

/**
 * GET /api/track/:reference
 * PUBLIC, citizen-safe tracking view.
 * Strips internal notes and contact information.
 */
trackRouter.get("/:reference", trackLimiter, async (req, res, next) => {
  try {
    const report = await reportService.getTrackReport(req.params.reference);
    res.status(200).json({ data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/track/:reference/verify
 * PUBLIC, citizen verification endpoint:
 * { confirmed: boolean, comment?: string }
 * "not fixed" reopens it (In Progress, priority bumped, logged).
 */
trackRouter.post("/:reference/verify", trackLimiter, async (req, res, next) => {
  try {
    const { verifyFeedbackSchema, verifyCitizenFeedback } = await import(
      "../agents/followUpAgent.js"
    );
    const parsed = verifyFeedbackSchema.parse(req.body);
    const result = await verifyCitizenFeedback(req.params.reference, parsed);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

