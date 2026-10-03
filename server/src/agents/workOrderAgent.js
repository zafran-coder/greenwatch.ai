import { z } from "zod";

export const workOrderSchema = z.object({
  workOrderRef: z.string().regex(/^WO-\d+$/),
  dueDate: z.string().datetime(),
  summary: z.string(),
});

export function runWorkOrderAgent(workOrderRef, dueDays = 3) {
  const dueDate = new Date(Date.now() + dueDays * 24 * 3600 * 1000).toISOString();

  return workOrderSchema.parse({
    workOrderRef,
    dueDate,
    summary: `Work order ${workOrderRef} created.`,
  });
}
