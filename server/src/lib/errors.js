/**
 * Base custom application error with HTTP status code and standard error code.
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} code
   * @param {any} [details]
   */
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details = undefined) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details = undefined) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", details = undefined) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = undefined) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", details = undefined, code = "CONFLICT") {
    super(message, 409, code, details);
  }
}

export class IllegalTransitionError extends AppError {
  constructor(message = "Illegal status transition", details = undefined) {
    super(message, 409, "ILLEGAL_STATUS_TRANSITION", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details = undefined) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}
