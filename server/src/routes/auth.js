import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { adminLoginLimiter } from "../middleware/rateLimiter.js";
import { loginSchema, registerSchema } from "../schemas/authSchema.js";
import { authService } from "../services/authService.js";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "./admin.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  adminLoginLimiter,
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
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

authRouter.post("/logout", (req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

authRouter.post("/register", validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.cookie(ADMIN_COOKIE_NAME, result.token, getAdminCookieOptions());
    res.status(201).json({ data: result, token: result.token, user: result.user });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ data: { user }, user });
  } catch (err) {
    next(err);
  }
});
