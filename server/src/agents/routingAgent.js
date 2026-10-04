import { z } from "zod";
import { getLlmClient } from "./llmClient.js";

export const routingOutputSchema = z.object({
  department: z.enum([
    "Sanitation",
    "Parks & Forestry",
    "Water Utility",
    "Public Works",
  ]),
  rationale: z.string(),
  isEdgeCase: z.boolean().default(false),
  summary: z.string(),
});

// Legacy schema alias
export const routingSchema = routingOutputSchema;

/**
 * Configurable category to department routing table.
 */
export const CATEGORY_DEPARTMENT_MAP = {
  garbage: {
    dept: "Sanitation",
    rationale: "Solid waste management, illegal dumping enforcement, and municipal collection.",
  },
  park: {
    dept: "Sanitation",
    rationale: "Park cleanup, bin clearance, and municipal groundskeeping.",
  },
  tree: {
    dept: "Parks & Forestry",
    rationale: "Urban forestry, hazardous tree management, and branch pruning.",
  },
  plants: {
    dept: "Parks & Forestry",
    rationale: "Botanical maintenance, flower bed rehabilitation, and nursery operations.",
  },
  water: {
    dept: "Water Utility",
    rationale: "Municipal water mains, leak detection, and wastage prevention.",
  },
  blocked: {
    dept: "Public Works",
    rationale: "Public rights-of-way, road barriers, and civil structural access.",
  },
};

/**
 * Detects whether a report is an edge case spanning multiple municipal jurisdictions.
 * @param {string} category
 * @param {string} text
 * @returns {boolean}
 */
function isMultiDepartmentEdgeCase(category, text = "") {
  const lower = text.toLowerCase();
  let crossoverSignals = 0;

  if (/water|pipe|leak|flood/i.test(lower)) crossoverSignals++;
  if (/tree|branch|wood/i.test(lower)) crossoverSignals++;
  if (/garbage|trash|waste|debris/i.test(lower)) crossoverSignals++;
  if (/blocked|gate|fence|road barrier/i.test(lower)) crossoverSignals++;

  return crossoverSignals >= 3;
}

/**
 * Deterministic department routing.
 * @param {string} category
 * @param {string} description
 * @returns {z.infer<typeof routingOutputSchema>}
 */
export function runDeterministicRouting(category, description = "") {
  const mapping = CATEGORY_DEPARTMENT_MAP[category] || CATEGORY_DEPARTMENT_MAP.garbage;
  const isEdgeCase = isMultiDepartmentEdgeCase(category, description);

  return routingOutputSchema.parse({
    department: mapping.dept,
    rationale: mapping.rationale,
    isEdgeCase,
    summary: `Routed to ${mapping.dept}.`,
  });
}

/**
 * Department Routing Agent
 * Configurable category -> department table; LLM only for edge cases.
 */
export function runRoutingAgent(category, description = "") {
  return runDeterministicRouting(category, description);
}

export async function runRoutingAgentAsync(category, description = "", options = {}) {
  const isEdgeCase = isMultiDepartmentEdgeCase(category, description);

  // If complex edge case and LLM client is available, consult LLM
  if (isEdgeCase && options.llmClient) {
    try {
      const prompt = `A citizen submitted an edge-case environmental report: "${description}".
Category identified: "${category}".
Determine the best single lead department among: "Sanitation", "Parks & Forestry", "Water Utility", "Public Works".
Respond with JSON: { "department", "rationale", "isEdgeCase": true, "summary" }`;

      const raw = await options.llmClient.generateJson({
        prompt,
        zodSchema: routingOutputSchema,
        agentType: "routing",
        timeoutMs: options.timeoutMs || 4000,
      });

      return routingOutputSchema.parse(raw);
    } catch (err) {
      // Fallback to table
    }
  }

  return runDeterministicRouting(category, description);
}
