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
  photos: z
    .array(z.string())
    .or(
      z.string().transform((s) => {
        try {
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) ? parsed : [s];
        } catch {
          return s ? [s] : [];
        }
      })
    )
    .optional()
    .default([]),
  // Honeypot fields for anti-spam detection
  hp: z.string().optional(),
  website: z.string().optional(),
  honeypot: z.string().optional(),
  _hp: z.string().optional(),
});

export const updateReportSchema = z.object({
  status: z.enum(["New", "Verified", "Assigned", "In Progress", "Resolved"]).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  department: z.enum(["Sanitation", "Parks & Forestry", "Water Utility", "Public Works"]).optional(),
  assignee: z.string().nullable().optional(),
  assignedUserId: z.string().nullable().optional(),
  dueDate: z.string().or(z.date()).optional(),
  slaDueAt: z.string().or(z.date()).optional(),
  note: z.string().trim().optional(),
  activityEntry: z
    .object({
      kind: z.enum(["agent", "human"]).default("human"),
      who: z.string().optional(),
      text: z.string(),
      isInternal: z.boolean().optional(),
    })
    .optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["New", "Verified", "Assigned", "In Progress", "Resolved"]),
  note: z.string().trim().optional(),
});

export const updateWorkOrderSchema = z.object({
  assignee: z.string().nullable().optional(),
  assignedUserId: z.string().nullable().optional(),
  dueDate: z.string().or(z.date()).optional(),
  slaDueAt: z.string().or(z.date()).optional(),
  note: z.string().trim().optional(),
});

export const addActivitySchema = z.object({
  kind: z.enum(["agent", "human"]).default("human"),
  who: z.string().optional(),
  text: z.string().trim().min(1, "Activity text cannot be empty"),
  isInternal: z.boolean().optional().default(true),
});

export const reportQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  department: z.string().optional(),
  q: z.string().optional(),
  sortBy: z.enum(["createdAt", "dueDate", "slaDueAt", "priority", "status"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});
