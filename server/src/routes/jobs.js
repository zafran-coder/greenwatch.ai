import { Router } from "express";
import { runScheduledJobs } from "../agents/followUpAgent.js";
import { config } from "../config.js";
import { UnauthorizedError } from "../lib/errors.js";

export const jobsRouter = Router();

/**
 * POST /api/jobs/run
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer <secret>).
 * Idempotently:
 * 1) Adds one reminder log entry for assigned/in-progress tickets with no update for 48h
 * 2) Flags SLA-overdue tickets
 * Designed for external serverless cron triggers (Render free tier safe).
 */
jobsRouter.post("/run", async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"] || "";
    const bearerSecret = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const providedSecret =
      req.headers["x-cron-secret"] ||
      bearerSecret ||
      req.query.secret ||
      req.body?.secret;

    const expectedSecret =
      config.cronSecret || process.env.CRON_SECRET || "greenwatch_cron_secret";

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedError("Unauthorized: Missing or invalid CRON_SECRET.");
    }

    const result = await runScheduledJobs(providedSecret);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});
