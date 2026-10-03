import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

/**
 * Global error handling middleware.
 * Ensures strict compliance with Rule 4:
 * Format: { error: { code, message, details? } }
 */
export function errorHandler(err, req, res, next) {
  // If headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
      code: e.code,
    }));

    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details,
      },
    });
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    const payload = {
      code: err.code,
      message: err.message,
    };
    if (err.details !== undefined) {
      payload.details = err.details;
    }
    return res.status(err.statusCode).json({ error: payload });
  }

  // Handle JSON parsing errors in body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON in request body",
      },
    });
  }

  // Generic fallback for unexpected server errors
  console.error("[Unhandled Error]:", err);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "An unexpected error occurred",
    },
  });
}
