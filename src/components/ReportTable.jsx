import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { CATEGORIES } from "../data/mockData";
import { PriorityBadge, StatusBadge, OverdueTag } from "./Badges";
import CategoryIcon from "./CategoryIcon";
import { ageOf, isOverdue } from "../utils/format";

/** Reports list — a real table on desktop, stacked cards on mobile. */
export default function ReportTable({ reports }) {
  const navigate = useNavigate();
  const open = (id) => navigate(`/reports/${id}`);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {["ID", "Category", "Location", "Priority", "Department", "Status", "Age", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr
                key={r.id}
                onClick={() => open(r.id)}
                className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-green-50/40"
              >
                <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                  {r.ref}
                </td>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CategoryIcon category={r.category} size="sm" />
                    {CATEGORIES[r.category].label}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-5 py-4 text-sm text-slate-500">
                  {r.location.address}
                </td>
                <td className="px-5 py-4">
                  <PriorityBadge value={r.priority} />
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {r.department}
                </td>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-1.5">
                    <StatusBadge value={r.status} />
                    {isOverdue(r) && <OverdueTag days={Math.max(1, Math.round((Date.now() - new Date(r.dueDate)) / 864e5))} />}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm tabular-nums text-slate-500">
                  {ageOf(r.createdAt)}
                </td>
                <td className="pr-4">
                  <ChevronRight className="size-4 text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="divide-y divide-slate-100 md:hidden">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => open(r.id)}
            className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors active:bg-green-50/50"
          >
            <CategoryIcon category={r.category} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {r.ref}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {ageOf(r.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {CATEGORIES[r.category].label}
              </p>
              <p className="truncate text-xs text-slate-400">
                {r.location.address}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <PriorityBadge value={r.priority} />
                <StatusBadge value={r.status} />
                {isOverdue(r) && <OverdueTag days={Math.max(1, Math.round((Date.now() - new Date(r.dueDate)) / 864e5))} />}
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </>
  );
}
