import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";

/**
 * Extracts JWT token from signed cookie, plain cookie, or Authorization Bearer header.
 *
 * @param {import("express").Request} req
 * @returns {string|null}
 */
export function extractToken(req) {
  // 1. Signed cookie (admin_token)
  if (req.signedCookies && req.signedCookies.admin_token) {
    return req.signedCookies.admin_token;
  }
  // 2. Plain cookie (fallback)
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }
  // 3. Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

/**
 * Require valid JWT authentication (via signed cookie or Bearer header).
 */
export function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError("Authentication token is missing or invalid"));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Authentication token has expired"));
    }
    return next(new UnauthorizedError("Invalid authentication token"));
  }
}

/**
 * Optional authentication: extracts user if token provided, but doesn't fail if absent.
 */
export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

/**
 * Require one of the specified roles (e.g. "OFFICIAL", "ADMIN").
 * @param  {...string} roles
 */
export function requireRole(...roles) {
  const normalized = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    const userRole = (req.user.role || "").toLowerCase();
    if (!normalized.includes(userRole)) {
      return next(
        new ForbiddenError(`Access restricted to roles: ${roles.join(", ")}`)
      );
    }
    next();
  };
}

export const requireOfficialOrAdmin = [authenticate, requireRole("OFFICIAL", "ADMIN")];
