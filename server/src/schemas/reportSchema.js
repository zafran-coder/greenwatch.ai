import { z } from "zod";

export const CATEGORIES = [
  "garbage",
  "tree",
  "water",
  "plants",
  "park",
  "blocked",
];

export const DEPARTMENTS = [
  "Sanitation",
  "Parks & Forestry",
  "Water Utility",
  "Public Works",
];

export const PRIORITIES = ["High", "Medium", "Low"];

export const STATUSES = [
  "New",
  "Verified",
  "Assigned",
  "In Progress",
  "Resolved",
];

export const createReportSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Please add a few more details (at least 10 characters)."),
  location: z.object({
    address: z.string().trim().min(1, "Add a location so the crew knows where to go."),
    area: z.string().trim().optional().default("Reported via app"),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
  }),
  photos: z.array(z.string()).optional().default([]),
});

export const updateReportSchema = z.object({
  status: z.enum(["New", "Verified", "Assigned", "In Progress", "Resolved"]).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  department: z.enum(["Sanitation", "Parks & Forestry", "Water Utility", "Public Works"]).optional(),
  assignee: z.string().nullable().optional(),
  note: z.string().trim().optional(),
  activityEntry: z
    .object({
      kind: z.enum(["agent", "human"]).default("human"),
      who: z.string(),
      text: z.string(),
    })
    .optional(),
});

export const addActivitySchema = z.object({
  kind: z.enum(["agent", "human"]).default("human"),
  who: z.string().min(1, "Author name/role is required"),
  text: z.string().trim().min(1, "Activity text cannot be empty"),
});

export const reportQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  department: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});
