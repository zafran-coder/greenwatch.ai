import { z } from "zod";

export const followUpSchema = z.object({
  action: z.enum(["none", "overdue_reminder", "overdue_escalation", "citizen_confirmation", "closed_loop"]),
  message: z.string(),
  needsNotification: z.boolean(),
});

export function evaluateFollowUp(report) {
  if (!report) {
    return followUpSchema.parse({
      action: "none",
      message: "No report provided.",
      needsNotification: false,
    });
  }

  const now = Date.now();
  const dueDate = report.dueDate ? new Date(report.dueDate).getTime() : null;
  const isOverdue = dueDate && now > dueDate && report.status !== "Resolved";
  const updatedAt = report.updatedAt ? new Date(report.updatedAt).getTime() : now;
  const hoursSinceUpdate = (now - updatedAt) / (3600 * 1000);

  // Case 1: Issue is Resolved
  if (report.status === "Resolved") {
    const resolvedAt = report.resolvedAt ? new Date(report.resolvedAt).getTime() : updatedAt;
    const hoursSinceResolved = (now - resolvedAt) / (3600 * 1000);
    if (hoursSinceResolved >= 24) {
      return followUpSchema.parse({
        action: "closed_loop",
        message: "Citizen notified. No re-report in 24h — loop closed.",
        needsNotification: false,
      });
    }
    return followUpSchema.parse({
      action: "citizen_confirmation",
      message: "Citizen notified and asked to confirm the fix.",
      needsNotification: true,
    });
  }

  // Case 2: Past SLA Due Date and Incomplete
  if (isOverdue) {
    if (hoursSinceUpdate >= 48) {
      return followUpSchema.parse({
        action: "overdue_escalation",
        message: "Escalated: no update for 48h and report is past due. Reminder sent to crew supervisor.",
        needsNotification: true,
      });
    }
    return followUpSchema.parse({
      action: "overdue_reminder",
      message: `Update requested from the ${report.department} team — report is past its due date.`,
      needsNotification: true,
    });
  }

  return followUpSchema.parse({
    action: "none",
    message: "Report within SLA limits.",
    needsNotification: false,
  });
}
