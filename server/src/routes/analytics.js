import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";

export const analyticsRouter = Router();

// Full analytics bundle
analyticsRouter.get("/", async (req, res, next) => {
  try {
    const data = await analyticsService.getAnalytics();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// Operational KPIs
analyticsRouter.get("/kpis", async (req, res, next) => {
  try {
    const data = await analyticsService.getKPIs();
    res.status(200).json({ data, ...data });
  } catch (err) {
    next(err);
  }
});

// Attention items
analyticsRouter.get("/attention", async (req, res, next) => {
  try {
    const data = await analyticsService.getAttentionReports();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// Category distribution
analyticsRouter.get("/categories", async (req, res, next) => {
  try {
    const data = await analyticsService.getCategories();
    res.status(200).json({ data, ...data });
  } catch (err) {
    next(err);
  }
});

// 14-day zero-filled trend (/trend & /trends)
analyticsRouter.get(["/trend", "/trends"], async (req, res, next) => {
  try {
    const data = await analyticsService.getTrend(14);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// Department resolution performance + rates
analyticsRouter.get("/departments", async (req, res, next) => {
  try {
    const data = await analyticsService.getDepartments();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});
