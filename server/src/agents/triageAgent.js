import { z } from "zod";

export const triageSchema = z.object({
  category: z.enum(["garbage", "tree", "water", "plants", "park", "blocked"]),
  categoryLabel: z.string(),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string(),
});

const RULES = [
  {
    cat: "garbage",
    label: "Illegal Garbage Dumping",
    kw: ["garbage", "trash", "dump", "waste", "litter", "rubbish", "bags", "debris", "mattress", "cardboard", "bin overflow", "dumpster", "filth"],
  },
  {
    cat: "tree",
    label: "Fallen / Damaged Tree",
    kw: ["tree", "branch", "fallen", "uprooted", "stump", "bark", "limb", "leaning", "elm", "eucalyptus", "wood", "bough"],
  },
  {
    cat: "water",
    label: "Water Leakage / Wastage",
    kw: ["water", "leak", "pipe", "burst", "puddle", "flood", "sprinkler", "tap", "sewage", "drain", "gush", "wasting", "gutter", "valve"],
  },
  {
    cat: "blocked",
    label: "Blocked Green Area",
    kw: ["blocked", "closed", "fence", "locked", "gate", "barrier", "scaffold", "chained", "encroach", "occupied", "obstruction", "passage"],
  },
  {
    cat: "plants",
    label: "Damaged Plants",
    kw: ["plant", "flower", "hedge", "bed", "shrub", "trampled", "wilted", "garden bed", "replant", "sapling", "vegetation"],
  },
  {
    cat: "park",
    label: "Dirty Park",
    kw: ["park", "playground", "bench", "swing", "dirty", "unclean", "dog park", "grass", "litter", "recreation"],
  },
];

export function runDeterministicTriage(description, photoCount = 0) {
  const text = (description || "").toLowerCase();
  const scores = {};

  for (const rule of RULES) {
    scores[rule.cat] = rule.kw.reduce((acc, kw) => {
      let n = 0;
      let idx = text.indexOf(kw);
      while (idx !== -1) {
        n += 1;
        idx = text.indexOf(kw, idx + kw.length);
      }
      return acc + n;
    }, 0);
  }

  let best = "garbage";
  let bestScore = -1;
  for (const [cat, s] of Object.entries(scores)) {
    if (s > bestScore) {
      best = cat;
      bestScore = s;
    }
  }

  const selectedRule = RULES.find((r) => r.cat === best);
  const confidence = Math.min(
    98,
    Math.max(72, 74 + bestScore * 4 + (photoCount > 0 ? 6 : 0) + (text.length >= 60 ? 4 : 0))
  );

  return triageSchema.parse({
    category: best,
    categoryLabel: selectedRule ? selectedRule.label : "Environmental Issue",
    confidence,
    reasoning: `Keywords and signals detected matching ${best} patterns.`,
  });
}

/**
 * Triage Agent — Untrusted LLM output validation with deterministic fallback.
 * Rule 5: All AI/LLM output is untrusted: validate against schema, handle failures with fallback.
 */
export async function runTriageAgent(description, photoCount = 0, geminiClient = null) {
  if (geminiClient) {
    try {
      // If external LLM is configured, call it and strictly validate against triageSchema
      const prompt = `Classify this environmental report into one of: garbage, tree, water, plants, park, blocked. Description: "${description}". Respond with JSON { "category", "categoryLabel", "confidence", "reasoning" }.`;
      const raw = await geminiClient.generate(prompt);
      const parsed = JSON.parse(raw);
      return triageSchema.parse(parsed);
    } catch (err) {
      console.warn("[Triage Agent] LLM output invalid or unavailable; using deterministic fallback:", err.message);
    }
  }

  return runDeterministicTriage(description, photoCount);
}
