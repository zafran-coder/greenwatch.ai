import { AlertTriangle, Sparkles } from "lucide-react";

const PRIORITY_STYLE = {
  High: "border-red-200 bg-red-50 text-red-700 [&>i]:bg-red-500",
  Medium: "border-amber-200 bg-amber-50 text-amber-700 [&>i]:bg-amber-500",
  Low: "border-green-200 bg-green-50 text-green-700 [&>i]:bg-green-500",
};

export function PriorityBadge({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLE[value]}`}
    >
      <i className="size-1.5 rounded-full" />
      {value} priority
    </span>
  );
}

const STATUS_STYLE = {
  New: "border-slate-200 bg-slate-50 text-slate-600 [&>i]:bg-slate-400",
  Verified: "border-slate-300 bg-slate-50 text-slate-700 [&>i]:bg-slate-500",
  Assigned: "border-amber-200 bg-amber-50 text-amber-700 [&>i]:bg-amber-500",
  "In Progress": "border-amber-300 bg-amber-50 text-amber-800 [&>i]:bg-amber-600",
  Resolved: "border-green-200 bg-green-50 text-green-700 [&>i]:bg-green-600",
};

export function StatusBadge({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[value]}`}
    >
      <i className={`size-1.5 rounded-full ${value === "In Progress" ? "animate-pulse" : ""}`} />
      {value}
    </span>
  );
}

/** Small red chip shown next to overdue work orders. */
export function OverdueTag({ days }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      <AlertTriangle className="size-3" />
      Overdue{days > 0 ? ` ${days}d` : ""}
    </span>
  );
}

/** Trust marker for anything produced by the AI pipeline. */
export function AIBadge({ label = "AI" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-green-600/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-green-700">
      <Sparkles className="size-3" />
      {label}
    </span>
  );
}
