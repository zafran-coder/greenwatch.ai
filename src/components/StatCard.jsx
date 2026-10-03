import { Card } from "./ui";

const ACCENTS = {
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-500",
};

export default function StatCard({ icon: Icon, label, value, hint, accent = "slate" }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
      </div>
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`}
      >
        <Icon className="size-5" />
      </span>
    </Card>
  );
}
