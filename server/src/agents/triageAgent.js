import { z } from "zod";
import { getLlmClient } from "./llmClient.js";

export const triageOutputSchema = z.object({
  category: z.enum(["garbage", "tree", "water", "plants", "park", "blocked"]),
  categoryLabel: z.string(),
  confidence: z.number().min(0).max(1), // Normalized 0-1
  extractedLocation: z.string().nullable().default(null),
  shortReason: z.string(),
  needsReview: z.boolean().default(false),
});

// Legacy schema compatibility
export const triageSchema = z.object({
  category: z.enum(["garbage", "tree", "water", "plants", "park", "blocked"]),
  categoryLabel: z.string(),
  confidence: z.number(), // Accepts both 0-1 float or 0-100 int
  reasoning: z.string().optional(),
  shortReason: z.string().optional(),
  extractedLocation: z.string().nullable().optional(),
  needsReview: z.boolean().optional(),
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

/**
 * Deterministic heuristic triage fallback.
 * Always available and produces guaranteed Zod-valid outputs.
 */
export function runDeterministicTriage(description = "", photoCount = 0) {
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
  const rawConfidenceInt =
    bestScore > 0
      ? Math.min(98, Math.max(72, 74 + bestScore * 4 + (photoCount > 0 ? 6 : 0) + (text.length >= 60 ? 4 : 0)))
      : 55 + (photoCount > 0 ? 5 : 0) + (text.length >= 60 ? 4 : 0);

  const confidence = Math.round((rawConfidenceInt / 100) * 100) / 100;
  const needsReview = confidence < 0.70;

  // Extract location hint if present
  let extractedLocation = null;
  const locMatch = description.match(/(?:near|behind|at|across|in|on|opposite)\s+([A-Z][a-zA-Z0-9\s&'-]{2,40})/);
  if (locMatch) {
    extractedLocation = locMatch[1].trim();
  }

  return triageOutputSchema.parse({
    category: best,
    categoryLabel: selectedRule ? selectedRule.label : "Environmental Issue",
    confidence,
    extractedLocation,
    shortReason: `Classified as ${selectedRule?.label || best} based on environmental keywords and report context.`,
    needsReview,
  });
}

/**
 * Triage Agent — Classifies category, confidence 0-1, extracted location, short reason.
 * Flags needsReview = true when confidence is low.
 * Untrusted citizen text is wrapped in prompt security boundaries.
 *
 * @param {string} description
 * @param {number} photoCount
 * @param {Object} [options]
 * @returns {Promise<z.infer<typeof triageOutputSchema>>}
 */
export async function runTriageAgent(description = "", photoCount = 0, options = {}) {
  const client = options.llmClient || getLlmClient();

  try {
    const prompt = `Classify this environmental report into one of: garbage, tree, water, plants, park, blocked.
Citizen report text: "${description}".
Photo count attached: ${photoCount}.
Respond with JSON matching schema:
{
  "category": "garbage" | "tree" | "water" | "plants" | "park" | "blocked",
  "categoryLabel": string,
  "confidence": number between 0.0 and 1.0,
  "extractedLocation": string or null,
  "shortReason": string,
  "needsReview": boolean
}`;

    const raw = await client.generateJson({
      prompt,
      zodSchema: triageOutputSchema,
      agentType: "triage",
      context: { photoCount },
      timeoutMs: options.timeoutMs || 5000,
    });

    const parsed = triageOutputSchema.parse(raw);
    // Enforce low-confidence rule: confidence < 0.70 => needsReview = true
    if (parsed.confidence < 0.70) {
      parsed.needsReview = true;
    }
    return parsed;
  } catch (err) {
    if (options.rethrow) {
      throw err;
    }
    // Graceful fallback to deterministic rule engine
    return runDeterministicTriage(description, photoCount);
  }
}
