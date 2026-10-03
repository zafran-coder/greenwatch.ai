// ---------------------------------------------------------------------------
// GreenWatch AI — simulated AI pipeline.
// Simple, transparent heuristics that mimic what the agent pipeline would do:
// keyword triage, evidence scoring, duplicate scan, priority reasoning.
// ---------------------------------------------------------------------------

import { CATEGORIES } from "../data/mockData";

const RULES = [
  { cat: "garbage", kw: ["garbage", "trash", "dump", "waste", "litter", "rubbish", "bags", "debris", "mattress", "cardboard", "bin overflow"] },
  { cat: "tree", kw: ["tree", "branch", "fallen", "uprooted", "stump", "bark", "limb", "leaning"] },
  { cat: "water", kw: ["water", "leak", "pipe", "burst", "puddle", "flood", "sprinkler", "tap", "sewage", "drain", "gush", "wasting"] },
  { cat: "blocked", kw: ["blocked", "closed", "fence", "locked", "gate", "barrier", "scaffold", "chained", "encroach", "occupied"] },
  { cat: "plants", kw: ["plant", "flower", "hedge", "bed", "shrub", "trampled", "wilted", "garden bed", "replant"] },
  { cat: "park", kw: ["park", "playground", "bench", "swing", "dirty", "unclean", "dog park", "grass"] },
];

const HIGH_HINTS = ["school", "children", "child", "kids", "hospital", "clinic", "main road", "highway", "burst", "gush", "sewage", "smell", "health", "danger", "hazard", "blocking the road", "elderly"];
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

function scoreText(text) {
  const t = ` ${text.toLowerCase()} `;
  const scores = {};
  for (const rule of RULES) {
    scores[rule.cat] = rule.kw.reduce((acc, kw) => {
      let n = 0;
      let idx = t.indexOf(kw);
      while (idx !== -1) {
        n += 1;
        idx = t.indexOf(kw, idx + kw.length);
      }
      return acc + n;
    }, 0);
  }
  return scores;
}

export function classifyIssue(description, photoCount = 0, allReports = []) {
  const text = description || "";
  const scores = scoreText(text);
  let best = "garbage"; // most common category as a sane fallback
  let bestScore = -1;
  for (const [cat, s] of Object.entries(scores)) {
    if (s > bestScore) {
      best = cat;
      bestScore = s;
    }
  }

  const t = text.toLowerCase();
  let priority = "Medium";
  if (HIGH_HINTS.some((h) => t.includes(h))) priority = "High";
  else if (LOW_HINTS.some((h) => t.includes(h)) || bestScore <= 1) priority = "Low";

  // Evidence: photos + a reasonably detailed description
  const hasPhotos = photoCount > 0;
  const detailed = text.trim().length >= 60;
  const evidence = hasPhotos && detailed ? "Good" : "Needs more info";

  // Confidence: pretend the classifier is surer with more signal
  const confidence = Math.min(
    97,
    74 + bestScore * 4 + (hasPhotos ? 6 : 0) + (detailed ? 4 : 0)
  );

  // Duplicate scan: same category, still open
  const similarReports = allReports.filter(
    (r) => r.category === best && r.status !== "Resolved"
  );

  const department = CATEGORIES[best].department;

  return {
    category: best,
    categoryLabel: CATEGORIES[best].label,
    department,
    priority,
    reason: DEFAULT_REASON[best][priority],
    evidence,
    confidence,
    similarReports,
  };
}

/** The animated stepper copy, generated from the real analysis result. */
export function buildAgentSteps(analysis, workOrder) {
  const n = analysis.similarReports.length;
  return [
    {
      key: "triage",
      label: "Triage Agent",
      detail: `Classified as ${analysis.categoryLabel} · ${analysis.confidence}% confident`,
    },
    {
      key: "evidence",
      label: "Evidence Agent",
      detail:
        analysis.evidence === "Good"
          ? "Photos verified, match the description. Evidence: Good"
          : "Evidence thin — flagged as Needs more info",
    },
    {
      key: "duplicates",
      label: "Duplicate Detection",
      detail:
        n > 0
          ? `Scanned 1,284 recent reports · ${n} similar found nearby`
          : "Scanned 1,284 recent reports · no duplicates nearby",
    },
    {
      key: "priority",
      label: "Priority Agent",
      detail: `Marked ${analysis.priority} — ${analysis.reason}`,
    },
    {
      key: "routing",
      label: "Department Routing",
      detail: `Routed to ${analysis.department}`,
    },
    {
      key: "workorder",
      label: "Work Order Created",
      detail: `${workOrder} created and sent to the ${analysis.department} queue`,
    },
  ];
}
