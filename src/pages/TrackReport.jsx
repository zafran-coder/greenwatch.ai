import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  SearchX,
  MapPin,
  UserRound,
  Building2,
  BellRing,
  FilePlus2,
} from "lucide-react";
import { Card, Btn, inputCls } from "../components/ui";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import StatusTimeline from "../components/StatusTimeline";
import ActivityLog from "../components/ActivityLog";
import CategoryIcon from "../components/CategoryIcon";
import EmptyState from "../components/EmptyState";
import { getReportByRef } from "../data/store";
import { CATEGORIES } from "../data/mockData";
import { timeAgo } from "../utils/format";

export default function TrackReport() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("ref") || "");
  const searched = params.get("ref") || "";
  const report = searched ? getReportByRef(searched) : null;

  // Keep the box in sync when arriving via ?ref=GW-XXXX
  useEffect(() => {
    setQuery(params.get("ref") || "");
  }, [params]);

  const search = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) setParams({ ref: q });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Track a report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the reference ID you received after submitting — no account
          needed.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <form onSubmit={search} className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. GW-2041"
              className={`${inputCls} pl-10! uppercase placeholder:normal-case`}
            />
          </div>
          <Btn type="submit">Search</Btn>
        </form>
      </Card>

      {!searched && (
        <Card className="mt-5">
          <EmptyState
            icon={Search}
            title="Have a reference ID?"
            message="It looks like GW-2041 and appears right after you submit a report. Try GW-2041 to see a live example."
          />
        </Card>
      )}

      {searched && !report && (
        <Card className="mt-5">
          <EmptyState
            icon={SearchX}
            title="No report found"
            message={`We couldn't find “${searched}”. Check the ID and try again — it looks like GW-2041.`}
            action={
              <Link to="/report">
                <Btn variant="secondary" size="sm">
                  <FilePlus2 className="size-4" />
                  Report a new issue
                </Btn>
              </Link>
            }
          />
        </Card>
      )}

      {report && (
        <div className="mt-5 space-y-5">
          <Card>
            <div className="flex items-start justify-between gap-3 p-5 pb-0">
              <div className="flex items-start gap-3">
                <CategoryIcon category={report.category} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {report.ref}
                    </h2>
                    <StatusBadge value={report.status} />
                    <PriorityBadge value={report.priority} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {CATEGORIES[report.category].label}
                  </p>
                </div>
              </div>
              <Link
                to={`/reports/${report.id}`}
                className="shrink-0 text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
              >
                Full details
              </Link>
            </div>

            <div className="px-4 py-6 sm:px-6">
              <StatusTimeline status={report.status} />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-slate-400" />
                {report.location.address}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-slate-400" />
                {report.department}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5 text-slate-400" />
                {report.assignee || "Awaiting assignment"}
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Updates</h3>
              <span className="text-xs text-slate-400">
                Last activity {timeAgo(report.updatedAt)}
              </span>
            </div>
            <ActivityLog items={report.activity} />
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-green-50/70 px-3.5 py-3 text-xs leading-relaxed text-green-800">
              <BellRing className="mt-0.5 size-3.5 shrink-0" />
              The Follow-up Agent checks this report every 24 hours and nudges
              the team if it stalls. You'll see their notes here.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
