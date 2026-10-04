import { Router } from "express";

export const configRouter = Router();

/**
 * GET /api/config
 * Returns client runtime configuration (Rule 6).
 */
configRouter.get("/config", (req, res) => {
  res.status(200).json({
    adminRequired: true,
  });
});
