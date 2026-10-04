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
  RefreshCw,
} from "lucide-react";
import { Card, Btn, inputCls } from "../components/ui";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import StatusTimeline from "../components/StatusTimeline";
import ActivityLog from "../components/ActivityLog";
import CategoryIcon from "../components/CategoryIcon";
import EmptyState from "../components/EmptyState";
import { TrackReportSkeleton } from "../components/Skeletons";
import { api } from "../api";
import { CATEGORIES } from "../data/mockData";
import { timeAgo } from "../utils/format";

export default function TrackReport() {
  const [params, setParams] = useSearchParams();
  const searchedRef = params.get("ref") || "";
  const [query, setQuery] = useState(searchedRef);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep search box in sync when URL query changes
  useEffect(() => {
    setQuery(params.get("ref") || "");
  }, [params]);

  // Fetch report live from API whenever searchedRef changes
  useEffect(() => {
    if (!searchedRef.trim()) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError(null);

    api.reports
      .track(searchedRef.trim())
      .then((data) => {
        if (!isCurrent) return;
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setReport(null);
        setError(err);
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [searchedRef]);

  const search = (e) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) {
      setParams({ ref: q });
    } else {
      setParams({});
    }
  };

  const reload = () => {
    if (!searchedRef.trim()) return;
    setLoading(true);
    api.reports
      .track(searchedRef.trim())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  };

  const catLabel = report?.category
    ? CATEGORIES[report.category]?.label || report.category
    : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Track a report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the reference ID you received after submitting — no account needed.
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

      {!searchedRef && (
        <Card className="mt-5">
          <EmptyState
            icon={Search}
            title="Have a reference ID?"
            message="It looks like GW-2041 and appears right after you submit a report. Try GW-2041 to see a live example."
          />
        </Card>
      )}

      {loading && <TrackReportSkeleton />}

      {!loading && searchedRef && !report && (
        <Card className="mt-5">
          <EmptyState
            icon={SearchX}
            title="No report found"
            message={`We couldn't find “${searchedRef}”. Check the ID and try again — it looks like GW-2041.`}
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

      {!loading && report && (
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
                  <p className="mt-1 text-sm text-slate-500">{catLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reload}
                  title="Refresh live status"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <Link
                  to={`/reports/${report.id || report.ref}`}
                  className="shrink-0 text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
                >
                  Full details
                </Link>
              </div>
            </div>

            <div className="px-4 py-6 sm:px-6">
              <StatusTimeline status={report.status} />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-slate-400" />
                {report.location?.address || "Location on record"}
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

            {Array.isArray(report.photos) && report.photos.length > 0 && (
              <div className="border-t border-slate-100 p-5">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Evidence Photos
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {report.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Evidence ${i + 1}`}
                      className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover shadow-xs"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Updates</h3>
              <span className="text-xs text-slate-400">
                Last activity {timeAgo(report.updatedAt || report.createdAt)}
              </span>
            </div>
            <ActivityLog items={report.activity || []} />
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-green-50/70 px-3.5 py-3 text-xs leading-relaxed text-green-800">
              <BellRing className="mt-0.5 size-3.5 shrink-0" />
              The Follow-up Agent checks this report every 24 hours and nudges the
              team if it stalls. You'll see their notes here.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
