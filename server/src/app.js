import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./lib/errors.js";
import { testStrictLimiter } from "./middleware/rateLimiter.js";
import { healthRouter } from "./routes/health.js";
import { configRouter } from "./routes/config.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { reportsRouter } from "./routes/reports.js";
import { trackRouter } from "./routes/track.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { analyticsRouter } from "./routes/analytics.js";
import { officialsRouter } from "./routes/officials.js";
import { jobsRouter } from "./routes/jobs.js";

export const app = express();

// Trust reverse proxies (Render, Cloudflare, etc.)
app.set("trust proxy", 1);

// 1. Security Headers (Helmet with cross-origin resource policy)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// 2. Cookie Parser with Signed Cookie Secret
app.use(cookieParser(config.cookieSecret));

// 3. Strict CORS Allowlist from Environment with Credentials
const allowedOrigins = [
  ...String(config.corsOrigin || "").split(",").map((s) => s.trim()).filter(Boolean),
  ...(process.env.FRONTEND_URL ? String(process.env.FRONTEND_URL).split(",").map((s) => s.trim()).filter(Boolean) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      // or local development origins (localhost / 127.0.0.1 with any port)
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        (config.nodeEnv !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ) {
        return callback(null, true);
      }
      // In production, check without trailing slashes
      const cleanOrigin = origin.replace(/\/+$/, "");
      if (allowedOrigins.some((o) => o.replace(/\/+$/, "") === cleanOrigin)) {
        return callback(null, true);
      }
      // Deny disallowed origins cleanly
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-cron-secret"],
  })
);

// 4. Body Size Limits (Strict 1MB max for standard JSON)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 5. Static uploads directory for LocalDiskStorage
const uploadsDir = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

// 6. Test Rate Limit Endpoint (for verifying 429 responses)
app.get("/test/rate-limit", testStrictLimiter, (req, res) => {
  res.status(200).json({ ok: true });
});

// 6. API Routes
app.use("/api", healthRouter);
app.use("/api", configRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/track", trackRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/officials", officialsRouter);
app.use("/api/jobs", jobsRouter);

// Aliases per api contract: /departments and /trend
app.get(["/api/departments", "/departments"], (req, res, next) => {
  req.url = "/departments";
  analyticsRouter(req, res, next);
});
app.get(["/api/trend", "/api/trends", "/trend", "/trends"], (req, res, next) => {
  req.url = "/trend";
  analyticsRouter(req, res, next);
});

// 7. Catch 404 for unknown endpoints
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// 8. Centralized Error Handler (ensures no stack traces leak)
app.use(errorHandler);
