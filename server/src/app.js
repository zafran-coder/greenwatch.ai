import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./lib/errors.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { reportsRouter } from "./routes/reports.js";
import { analyticsRouter } from "./routes/analytics.js";

export const app = express();

// Middlewares
app.use(
  cors({
    origin: config.corsOrigin || "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);

// Catch 404 for unknown endpoints
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Centralized error handler
app.use(errorHandler);
