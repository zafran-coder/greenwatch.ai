import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { adminLoginLimiter } from "../middleware/rateLimiter.js";
import { loginSchema } from "../schemas/authSchema.js";
import { authService } from "../services/authService.js";
import { config } from "../config.js";

export const adminRouter = Router();

export const ADMIN_COOKIE_NAME = "admin_token";

export function getAdminCookieOptions() {
  const isProd = config.nodeEnv === "production";
  return {
    httpOnly: true,
    signed: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };
}

/**
 * POST /api/admin/login
 * Authenticates admin/official with env credentials or database user,
 * sets a signed httpOnly SameSite cookie, and returns JWT token & user profile.
 */
adminRouter.post(
  "/login",
  adminLoginLimiter,
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);

      // Set signed httpOnly SameSite cookie
      res.cookie(ADMIN_COOKIE_NAME, result.token, getAdminCookieOptions());

      res.status(200).json({
        success: true,
        data: result,
        token: result.token,
        user: result.user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */
adminRouter.post("/logout", (req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/admin/me
 * Retrieves current admin profile from active signed cookie or Bearer token.
 */
adminRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({
      success: true,
      data: { user },
      user,
    });
  } catch (err) {
    next(err);
  }
});
