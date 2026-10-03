import { z } from "zod";

export const routingSchema = z.object({
  department: z.enum([
    "Sanitation",
    "Parks & Forestry",
    "Water Utility",
    "Public Works",
  ]),
  rationale: z.string(),
  summary: z.string(),
});

const DEPARTMENT_MAP = {
  garbage: {
    dept: "Sanitation",
    rationale: "Solid waste management and illegal dumping jurisdiction.",
  },
  park: {
    dept: "Sanitation",
    rationale: "Park cleanup, bin emptying, and municipal groundskeeping.",
  },
  tree: {
    dept: "Parks & Forestry",
    rationale: "Urban forestry, hazardous tree management, and branch pruning.",
  },
  plants: {
    dept: "Parks & Forestry",
    rationale: "Botanical maintenance, flower bed rehabilitation, and greening.",
  },
  water: {
    dept: "Water Utility",
    rationale: "Municipal water mains, leak detection, and wastage prevention.",
  },
  blocked: {
    dept: "Public Works",
    rationale: "Public rights-of-way, barriers, and structural green area access.",
  },
};

export function runRoutingAgent(category, description = "") {
  const mapping = DEPARTMENT_MAP[category] || DEPARTMENT_MAP.garbage;

  return routingSchema.parse({
    department: mapping.dept,
    rationale: mapping.rationale,
    summary: `Routed to ${mapping.dept}.`,
  });
}
