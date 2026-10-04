import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";

export const officialsRouter = Router();

/**
 * GET /api/officials
 * Returns municipal staff directory grouped or listed by department.
 */
officialsRouter.get("/", async (req, res, next) => {
  try {
    const officials = await analyticsService.getOfficials();
    res.status(200).json({ data: officials });
  } catch (err) {
    next(err);
  }
});
