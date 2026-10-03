// Small date / time helpers shared across the app.

const MIN = 60e3;
const HOUR = 36e5;
const DAY = 24 * HOUR;

export function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const d = Math.floor(diff / DAY);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** How old a report is, shown in the table: "8h" / "3d" */
export function ageOf(createdAt) {
  const diff = Date.now() - new Date(createdAt).getTime();
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MIN))}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  return `${Math.floor(diff / DAY)}d`;
}

export function hoursUntil(ts) {
  return Math.round((new Date(ts).getTime() - Date.now()) / HOUR);
}

export function isOverdue(report) {
  return report.status !== "Resolved" && new Date(report.dueDate) < new Date();
}

/** Value for <input type="date"> */
export function dateInputValue(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isToday(ts) {
  if (!ts) return false;
  const a = new Date(ts);
  const b = new Date();
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
