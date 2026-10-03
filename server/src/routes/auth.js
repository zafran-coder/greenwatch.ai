import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { loginSchema, registerSchema } from "../schemas/authSchema.js";
import { authService } from "../services/authService.js";

export const authRouter = Router();

authRouter.post("/login", validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/register", validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ data: { user } });
  } catch (err) {
    next(err);
  }
});
