import rateLimit from "express-rate-limit";
import { config } from "../config.js";

// In-memory per-IP daily submission tracker
const ipDailySubmissions = new Map();
const DAILY_LIMIT = 50;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clean up old IP tracker entries every hour
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipDailySubmissions.entries()) {
    if (now > record.resetTime) {
      ipDailySubmissions.delete(ip);
    }
  }
}, 60 * 60 * 1000).unref();

/**
 * Honeypot validation middleware for public report submissions.
 * Rejects requests if hidden bot fields are populated.
 */
export function honeypotCheck(req, res, next) {
  const honeypots = ["hp", "website", "honeypot", "_hp", "_gotcha"];
  for (const field of honeypots) {
    if (req.body && req.body[field]) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Bot submission detected via honeypot field.",
        },
      });
    }
  }
  next();
}

/**
 * Per-IP daily submission cap for public reports (Rule: max 50 reports/day per IP).
 */
export function ipDailyReportCap(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "127.0.0.1";
  const now = Date.now();

  let record = ipDailySubmissions.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + ONE_DAY_MS };
    ipDailySubmissions.set(ip, record);
  }

  if (record.count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: `Daily report creation limit (${DAILY_LIMIT} reports/day) exceeded for this IP.`,
      },
    });
  }

  record.count += 1;
  next();
}

/**
 * Helper to reset daily cap for tests
 */
export function resetDailyCap() {
  ipDailySubmissions.clear();
}

/**
 * Strict Rate Limiter for POST /api/reports
 */
export const reportsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // allow up to 60 report creates per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many reports submitted from this IP, please try again later.",
    },
  },
});

/**
 * Strict Rate Limiter for GET /api/track/:reference
 */
export const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many tracking lookups from this IP, please try again later.",
    },
  },
});

/**
 * Strict Rate Limiter for POST /api/admin/login
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts from this IP, please try again later.",
    },
  },
});

/**
 * Test rate limiter with a low threshold (3 requests) to test 429 response
 */
export const testStrictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Too many requests.",
    },
  },
});
