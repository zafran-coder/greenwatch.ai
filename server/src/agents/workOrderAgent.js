import { z } from "zod";

export const workOrderOutputSchema = z.object({
  workOrderRef: z.string().regex(/^WO-[A-Za-z0-9_-]+$/),
  dueDate: z.string().datetime(),
  slaHours: z.number().int().positive(),
  status: z.enum(["New", "Verified", "Assigned"]),
  needsReview: z.boolean(),
  summary: z.string(),
});

// Legacy schema alias
export const workOrderSchema = z.object({
  workOrderRef: z.string().regex(/^WO-[A-Za-z0-9_-]+$/),
  dueDate: z.string().datetime(),
  summary: z.string(),
  slaHours: z.number().int().optional(),
  status: z.enum(["New", "Verified", "Assigned"]).optional(),
  needsReview: z.boolean().optional(),
});

/**
 * SLA Hours mapping:
 * High: 24h (1 day)
 * Medium: 72h (3 days)
 * Low: 168h (7 days)
 */
const SLA_HOURS_MAP = {
  High: 24,
  Medium: 72,
  Low: 168,
};

/**
 * Work Order Creator Agent
 * Generates WO-XXXX, calculates SLA by priority (High 24h, Medium 72h, Low 7d).
 * Sets status to "Verified" if triage confidence is high (>= 0.70 / 70%) and !needsReview;
 * otherwise report stays "New" with needsReview = true.
 *
 * @param {string} workOrderRef - e.g. "WO-1198"
 * @param {Object} [params]
 * @param {string} [params.priority="Medium"] - "High" | "Medium" | "Low"
 * @param {number} [params.confidence=0.85] - 0.0 to 1.0 or 0 to 100
 * @param {boolean} [params.needsReview=false]
 * @returns {z.infer<typeof workOrderOutputSchema>}
 */
export function runWorkOrderAgent(workOrderRef, params = {}) {
  // Support legacy call signature: runWorkOrderAgent(workOrderRef, dueDays)
  let priority = "Medium";
  let confidence = 0.85;
  let needsReview = false;

  if (typeof params === "number") {
    // Legacy dueDays parameter passed
    const dueDays = params;
    priority = dueDays === 1 ? "High" : dueDays >= 5 ? "Low" : "Medium";
  } else if (typeof params === "object" && params !== null) {
    priority = params.priority || "Medium";
    confidence = params.confidence != null ? params.confidence : 0.85;
    needsReview = Boolean(params.needsReview);
  }

  // Normalize confidence (if passed as 0-100 percentage, convert to 0-1)
  const normConfidence = confidence > 1 ? confidence / 100 : confidence;
  const isHighConfidence = normConfidence >= 0.70 && !needsReview;

  const slaHours = SLA_HOURS_MAP[priority] || 72;
  const dueDate = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  // Status is "Verified" if confidence is high, else stays "New" with needsReview = true
  const status = isHighConfidence ? "Verified" : "New";
  const finalNeedsReview = !isHighConfidence;

  const summary = isHighConfidence
    ? `Work order ${workOrderRef} created with ${slaHours}h SLA. Auto-verified (confidence: ${Math.round(normConfidence * 100)}%).`
    : `Work order ${workOrderRef} created with ${slaHours}h SLA. Flagged for official human review (low confidence: ${Math.round(normConfidence * 100)}%).`;

  return workOrderOutputSchema.parse({
    workOrderRef,
    dueDate,
    slaHours,
    status,
    needsReview: finalNeedsReview,
    summary,
  });
}
