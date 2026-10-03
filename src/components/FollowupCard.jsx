import { BellRing, CircleCheck } from "lucide-react";
import { AIBadge } from "./Badges";
import { hoursUntil, timeAgo } from "../utils/format";

/** What the Follow-up Agent will do next for this report. */
export default function FollowupCard({ report }) {
  if (report.status === "Resolved") {
    return (
      <div className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-green-600" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-green-800">Follow-up Agent</p>
            <AIBadge />
          </div>
          <p className="mt-1 text-sm text-green-700">
            Loop closed — the citizen was notified and asked to confirm the fix.
          </p>
        </div>
      </div>
    );
  }

  // Reminder cadence: nudge every 48h of silence from the assigned team.
  const reminderAt = new Date(
    new Date(report.updatedAt).getTime() + 48 * 36e5
  ).toISOString();
  const hours = hoursUntil(reminderAt);

  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        hours < 0
          ? "border-red-200 bg-red-50"
          : "border-amber-200/70 bg-amber-50/70"
      }`}
    >
      <BellRing
        className={`mt-0.5 size-5 shrink-0 ${
          hours < 0 ? "text-red-500" : "text-amber-500"
        }`}
      />
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">Follow-up Agent</p>
          <AIBadge />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {hours < 0 ? (
            <>
              No update for 48h — a reminder was sent to the{" "}
              <span className="font-medium">{report.department}</span> team and
              their supervisor.
            </>
          ) : (
            <>
              Reminder will be sent in{" "}
              <span className="font-medium text-slate-800">
                {hours} hour{hours === 1 ? "" : "s"}
              </span>{" "}
              if the {report.department} team doesn't update.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Last activity {timeAgo(report.updatedAt)}
        </p>
      </div>
    </div>
  );
}
