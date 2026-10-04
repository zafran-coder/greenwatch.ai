import { z } from "zod";
import { evaluatePoiRisk } from "./islamabadPois.js";

export const priorityOutputSchema = z.object({
  priority: z.enum(["High", "Medium", "Low"]),
  reason: z.string(),
  dueHours: z.number().int().positive(),
  dueDays: z.number().int().positive(),
  factors: z.array(z.string()),
  summary: z.string(),
});

// Legacy schema alias
export const prioritySchema = priorityOutputSchema;

const HEALTH_HAZARD_KEYWORDS = [
  "school", "children", "child", "kids", "playground", "park", "public park",
  "hospital", "clinic", "emergency", "patient",
  "main road", "highway", "expressway", "avenue", "traffic", "blocking road",
  "burst", "gush", "flood", "flooding", "water main",
  "sewage", "foul smell", "stink", "smell", "filth", "rot",
  "health", "danger", "hazard", "toxic", "chemical", "disease", "infection",
  "rats", "stray dogs", "mosquitoes", "dengue", "elderly", "falling", "snapped branch"
];

const LOW_PRIORITY_KEYWORDS = [
  "minor", "small", "few", "slight", "cosmetic", "isolated", "light cleaning", "not urgent"
];

const SLA_CONFIG = {
  High: { hours: 24, days: 1 },
  Medium: { hours: 72, days: 3 },
  Low: { hours: 168, days: 7 },
};

const CATEGORY_DEFAULT_REASONS = {
  garbage: {
    High: "Public health and environmental risk",
    Medium: "Waste accumulation in a public area",
    Low: "Minor litter issue, low urgency",
  },
  tree: {
    High: "Safety hazard — risk to people, traffic, or property",
    Medium: "Obstruction risk in a shared public space",
    Low: "No immediate risk, routine maintenance",
  },
  water: {
    High: "Active water loss — structural damage and wastage risk",
    Medium: "Continuous leakage wasting municipal water",
    Low: "Steady minor drip, no immediate damage risk",
  },
  plants: {
    High: "Widespread damage to public greenery / eco-zone",
    Medium: "Damage to maintained greenery",
    Low: "Cosmetic damage to maintained greenery",
  },
  park: {
    High: "Public health concern in a high-footfall park",
    Medium: "Hygiene and groundskeeping concern in a public area",
    Low: "Routine cleaning needed",
  },
  blocked: {
    High: "Public green space / right-of-way fully blocked",
    Medium: "Public green space inaccessible to residents",
    Low: "Temporary minor obstruction, alternate path available",
  },
};

/**
 * Priority Agent — Evaluates High/Medium/Low priority based on:
 * - Category baseline
 * - Health-risk & hazard keywords
 * - Proximity to Islamabad POIs (schools, hospitals, main roads)
 * - Existing duplicate count (escalation)
 * - Evidence confidence / clarity
 *
 * @param {string} category
 * @param {string} description
 * @param {Object} [context] - { location, duplicateCount, evidenceScore, photos }
 * @returns {z.infer<typeof priorityOutputSchema>}
 */
export function runPriorityAgent(category, description = "", context = {}) {
  const rawText = (description || "").toLowerCase();

  // Strip prompt injection attempts to mark as Low
  const sanitizedText = rawText
    .replace(/ignore (?:all )?previous instructions[^.]*\./gi, "")
    .replace(/mark as low/gi, "")
    .replace(/set priority to low/gi, "");

  const triggeredFactors = [];

  // 1. Health & Hazard keywords
  const matchedKeywords = HEALTH_HAZARD_KEYWORDS.filter((kw) => sanitizedText.includes(kw));
  if (matchedKeywords.length > 0) {
    triggeredFactors.push(`Hazard/Health risk signals: ${matchedKeywords.slice(0, 3).join(", ")}`);
  }

  // 2. Proximity to Islamabad POIs (Schools, Hospitals, Main Roads)
  const poiEval = evaluatePoiRisk(context.location || {}, sanitizedText);
  if (poiEval.isSensitive) {
    triggeredFactors.push(...poiEval.triggeredLabels);
  }

  // 3. Duplicate escalation: multiple reports signify persistent or widening problem
  const duplicateCount = context.duplicateCount || 0;
  if (duplicateCount >= 2) {
    triggeredFactors.push(`${duplicateCount} duplicate reports filed in vicinity (Escalation factor)`);
  }

  // 4. Evidence score reinforcement
  const evidenceScore = context.evidenceScore || 0;
  if (evidenceScore >= 85 && matchedKeywords.length > 0) {
    triggeredFactors.push("Verified high-clarity evidence confirming environmental impact");
  }

  // Determine priority level
  let priority = "Medium";

  if (
    matchedKeywords.length >= 2 ||
    poiEval.hasSchool ||
    poiEval.hasHospital ||
    (poiEval.hasMainRoad && matchedKeywords.length >= 1) ||
    duplicateCount >= 3 ||
    (sanitizedText.includes("school") && (category === "tree" || category === "garbage" || category === "water")) ||
    (sanitizedText.includes("hospital") && (category === "water" || category === "garbage")) ||
    (category === "garbage" && (sanitizedText.includes("park") || sanitizedText.includes("playground"))) ||
    sanitizedText.includes("burst pipe") ||
    sanitizedText.includes("water has been gushing") ||
    sanitizedText.includes("large amount of garbage") ||
    sanitizedText.includes("dangerous") ||
    sanitizedText.includes("hazard")
  ) {
    priority = "High";
  } else if (
    LOW_PRIORITY_KEYWORDS.some((kw) => sanitizedText.includes(kw)) &&
    matchedKeywords.length === 0 &&
    !poiEval.isSensitive &&
    duplicateCount === 0
  ) {
    priority = "Low";
  }

  // Human-readable reason
  const catReasons = CATEGORY_DEFAULT_REASONS[category] || CATEGORY_DEFAULT_REASONS.garbage;
  let reason = catReasons[priority] || "Assessed based on municipal guidelines.";

  if (poiEval.hasSchool) {
    reason = "Safety hazard near a school crossing";
  } else if (poiEval.hasHospital) {
    reason = "Public health and environmental risk near healthcare facility";
  } else if (priority === "High" && category === "garbage") {
    reason = "Public health and environmental risk";
  }

  const sla = SLA_CONFIG[priority];
  const summary = `Priority set to ${priority} — ${reason}. SLA: ${sla.hours}h (${sla.days} day${sla.days > 1 ? "s" : ""}).`;

  return priorityOutputSchema.parse({
    priority,
    reason,
    dueHours: sla.hours,
    dueDays: sla.days,
    factors: triggeredFactors.length > 0 ? triggeredFactors : ["Standard municipal guidelines"],
    summary,
  });
}
