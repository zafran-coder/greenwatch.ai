import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";

/**
 * Require valid JWT authentication.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token is missing or invalid"));
  }

  const token = authHeader.split(" ")[1];
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

/**
 * Require one of the specified roles (e.g. "official", "admin").
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
