import { z } from "zod";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { NotFoundError, UnauthorizedError } from "../lib/errors.js";

export const followUpSchema = z.object({
  action: z.enum(["none", "overdue_reminder", "overdue_escalation", "citizen_confirmation", "closed_loop"]),
  message: z.string(),
  needsNotification: z.boolean(),
});

export const verifyFeedbackSchema = z.object({
  confirmed: z.boolean(),
  comment: z.string().max(500).optional(),
});

/**
 * Priority escalation ladder:
 * Low -> Medium, Medium -> High, High -> High
 */
const PRIORITY_BUMP = {
  Low: "Medium",
  Medium: "High",
  High: "High",
};

/**
 * Evaluate SLA follow-up state for a report (heuristic).
 */
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

/**
 * Public Citizen verification endpoint handler:
 * POST /api/track/:reference/verify { confirmed, comment? }
 * "not fixed" reopens it (In Progress, priority bumped, logged).
 *
 * @param {string} reference - GW-XXXX or reportId
 * @param {Object} payload - { confirmed: boolean, comment?: string }
 * @returns {Promise<Object>}
 */
export async function verifyCitizenFeedback(reference, { confirmed, comment = "" }) {
  let report = await db.findReportByRef(reference);
  if (!report) {
    report = await db.findReportById(reference);
  }
  if (!report) {
    throw new NotFoundError(`Report with reference “${reference}” not found.`);
  }

  const now = new Date().toISOString();

  if (confirmed === false) {
    // "not fixed" -> Reopen ticket to "In Progress" & bump priority
    const currentPriority = report.priority || "Medium";
    const newPriority = PRIORITY_BUMP[currentPriority] || "High";

    const commentText = comment && comment.trim().length > 0 ? ` (Citizen note: “${comment.trim()}”)` : "";
    const logText = `Citizen reported issue NOT fixed${commentText}. Ticket reopened and priority escalated from ${currentPriority} to ${newPriority}.`;

    const updated = await db.updateReport(
      report.id,
      {
        status: "In Progress",
        priority: newPriority,
        resolvedAt: null,
      },
      {
        kind: "agent",
        who: "Follow-up Agent",
        text: logText,
        isInternal: false,
      }
    );

    // Update FollowUp record
    if (db.createFollowUp) {
      await db.createFollowUp({
        reportId: report.id,
        status: "reopened",
        confirmed: false,
        comment: comment || null,
        verifiedAt: now,
      });
    }

    return {
      success: true,
      action: "reopened",
      message: "Report has been reopened and escalated to field crews.",
      report: updated,
    };
  } else {
    // Citizen confirmed fix
    const commentText = comment && comment.trim().length > 0 ? ` (Citizen note: “${comment.trim()}”)` : "";
    const logText = `Citizen confirmed fix verified${commentText}. Closed loop verified.`;

    const updated = await db.updateReport(
      report.id,
      {},
      {
        kind: "agent",
        who: "Follow-up Agent",
        text: logText,
        isInternal: false,
      }
    );

    if (db.createFollowUp) {
      await db.createFollowUp({
        reportId: report.id,
        status: "confirmed",
        confirmed: true,
        comment: comment || null,
        verifiedAt: now,
      });
    }

    return {
      success: true,
      action: "confirmed",
      message: "Thank you for confirming! Loop is officially closed.",
      report: updated,
    };
  }
}

/**
 * Scheduled job endpoint runner:
 * POST /api/jobs/run (protected by CRON_SECRET header)
 * Idempotently:
 * 1) Adds one reminder log entry for assigned/in-progress tickets with no update for 48h
 * 2) Flags SLA-overdue tickets
 * No in-process cron (Render free sleeps).
 *
 * @param {string} providedSecret
 * @returns {Promise<Object>}
 */
export async function runScheduledJobs(providedSecret) {
  const expectedSecret = config.cronSecret || process.env.CRON_SECRET || "greenwatch_cron_secret";
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new UnauthorizedError("Invalid or missing CRON_SECRET authentication.");
  }

  const now = Date.now();
  const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
  const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;

  const { items: reports } = await db.findReports({ take: 500 });

  let reminderCount = 0;
  let overdueCount = 0;
  const flaggedReports = [];

  for (const report of reports) {
    if (report.status === "Resolved") continue;

    const isActive = report.status === "Assigned" || report.status === "In Progress";
    if (!isActive) continue;

    const updatedAt = report.updatedAt ? new Date(report.updatedAt).getTime() : now;
    const hoursSinceUpdate = now - updatedAt;

    const activities = report.activity || [];

    // 1. Inactivity Reminder: No update for 48h (Idempotent: at most one per 48h)
    if (hoursSinceUpdate >= FORTY_EIGHT_HOURS_MS) {
      const recent48hReminder = activities.find((a) => {
        const textMatch = a.text && a.text.includes("no update for 48h");
        const aTime = a.at ? new Date(a.at).getTime() : 0;
        return textMatch && now - aTime < FORTY_EIGHT_HOURS_MS;
      });

      if (!recent48hReminder) {
        await db.addActivity(report.id, {
          kind: "agent",
          who: "Follow-up Agent",
          text: `Escalated: no update for 48h and ticket is active in ${report.department}. Reminder sent to crew supervisor.`,
          isInternal: false,
        });
        reminderCount++;
        flaggedReports.push({ id: report.id, ref: report.ref, reason: "48h_inactivity" });
      }
    }

    // 2. SLA Overdue check: past dueDate and incomplete (Idempotent: at most one alert per 24h)
    const dueDate = report.dueDate ? new Date(report.dueDate).getTime() : null;
    if (dueDate && now > dueDate) {
      const recentOverdueAlert = activities.find((a) => {
        const textMatch = a.text && a.text.includes("SLA target resolution deadline");
        const aTime = a.at ? new Date(a.at).getTime() : 0;
        return textMatch && now - aTime < TWENTY_FOUR_HOURS_MS;
      });

      if (!recentOverdueAlert) {
        await db.addActivity(report.id, {
          kind: "agent",
          who: "Follow-up Agent",
          text: `Update requested from the ${report.department} team — report has exceeded its SLA target resolution deadline.`,
          isInternal: false,
        });
        overdueCount++;
        flaggedReports.push({ id: report.id, ref: report.ref, reason: "sla_overdue" });
      }
    }
  }

  return {
    success: true,
    scannedCount: reports.length,
    reminderCount,
    overdueCount,
    flaggedReports,
    executedAt: new Date().toISOString(),
  };
}
