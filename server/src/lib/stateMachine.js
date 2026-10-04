import { IllegalTransitionError } from "./errors.js";

/**
 * State machine allowed transitions:
 * New -> Verified -> Assigned -> In Progress -> Resolved
 * Reopen: Resolved -> In Progress
 * Assignment auto-transition: New -> Assigned
 */
export const ALLOWED_STATUS_TRANSITIONS = {
  New: ["Verified", "Assigned"],
  Verified: ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Resolved"],
  Resolved: ["In Progress"],
};

/**
 * Validates a status transition against the state machine.
 * Returns true if valid, or throws IllegalTransitionError (409) if illegal.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
export function validateStatusTransition(currentStatus, targetStatus) {
  if (!targetStatus) {
    return true;
  }

  // Idempotent no-op
  if (currentStatus === targetStatus) {
    return true;
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new IllegalTransitionError(
      `Illegal status transition from "${currentStatus}" to "${targetStatus}". Allowed next state(s): ${allowed.join(", ") || "none"}.`,
      {
        code: "ILLEGAL_STATUS_TRANSITION",
        from: currentStatus,
        to: targetStatus,
        allowed,
      }
    );
  }

  return true;
}
