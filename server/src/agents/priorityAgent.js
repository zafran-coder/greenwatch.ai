import { z } from "zod";

export const prioritySchema = z.object({
  priority: z.enum(["High", "Medium", "Low"]),
  reason: z.string(),
  dueDays: z.number().int().positive(),
  summary: z.string(),
});

const HIGH_HINTS = [
  "school",
  "children",
  "child",
  "kids",
  "hospital",
  "clinic",
  "main road",
  "highway",
  "burst",
  "gush",
  "sewage",
  "smell",
  "health",
  "danger",
  "hazard",
  "blocking the road",
  "elderly",
  "stray dogs",
];

const LOW_HINTS = ["minor", "small", "few", "slight", "cosmetic"];

const DEFAULT_REASON = {
  garbage: {
    High: "Public health and environmental risk",
    Medium: "Waste accumulation in a public area",
    Low: "Minor litter issue, low urgency",
  },
  tree: {
    High: "Safety hazard — risk to people or property",
    Medium: "Obstruction risk in a shared public space",
    Low: "No immediate risk, routine maintenance",
  },
  water: {
    High: "Active water loss — damage and waste risk",
    Medium: "Continuous leakage wasting water",
    Low: "Steady water waste, no damage risk",
  },
  plants: {
    High: "Widespread damage to public greenery",
    Medium: "Damage to maintained greenery",
    Low: "Cosmetic damage to maintained greenery",
  },
  park: {
    High: "Public health concern in a busy park",
    Medium: "Hygiene concern in a public area",
    Low: "Light cleaning needed",
  },
  blocked: {
    High: "Green space fully inaccessible — access complaint",
    Medium: "Public green space inaccessible to residents",
    Low: "Temporary obstruction, alternate path available",
  },
};

const DUE_DAYS = {
  High: 1,
  Medium: 3,
  Low: 5,
};

export function runPriorityAgent(category, description) {
  const text = (description || "").toLowerCase();

  let priority = "Medium";
  if (HIGH_HINTS.some((h) => text.includes(h))) {
    priority = "High";
  } else if (LOW_HINTS.some((h) => text.includes(h))) {
    priority = "Low";
  }

  const catReasons = DEFAULT_REASON[category] || DEFAULT_REASON.garbage;
  const reason = catReasons[priority] || "Assessed based on municipal guidelines.";
  const dueDays = DUE_DAYS[priority];

  return prioritySchema.parse({
    priority,
    reason,
    dueDays,
    summary: `Priority set to ${priority} — ${reason}.`,
  });
}
