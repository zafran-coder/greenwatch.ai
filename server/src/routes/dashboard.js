import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/kpis
 * Real-time operational KPIs: fresh, in-progress, overdue, resolved today
 */
dashboardRouter.get("/kpis", async (req, res, next) => {
  try {
    const data = await analyticsService.getKPIs();
    res.status(200).json({ data, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/attention
 * Open reports requiring immediate municipal crew attention
 */
dashboardRouter.get("/attention", async (req, res, next) => {
  try {
    const data = await analyticsService.getAttentionReports();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard
 * Aggregated dashboard metrics overview
 */
dashboardRouter.get("/", async (req, res, next) => {
  try {
    const data = await analyticsService.getAnalytics();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});
