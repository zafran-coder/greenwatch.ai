import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";

export const analyticsRouter = Router();

analyticsRouter.get("/", async (req, res, next) => {
  try {
    const data = await analyticsService.getAnalytics();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});
