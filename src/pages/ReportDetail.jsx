import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  UserRound,
  FileQuestion,
  CheckCircle2,
  ListChecks,
  History,
  ChevronDown,
  Plus,
  Check,
  Link2,
} from "lucide-react";
import { Card, CardHeader, Btn, Select } from "../components/ui";
import { PriorityBadge, StatusBadge, OverdueTag } from "../components/Badges";
import CategoryIcon from "../components/CategoryIcon";
import MapPlaceholder from "../components/MapPlaceholder";
import AISummaryCard from "../components/AISummaryCard";
import WorkOrderCard from "../components/WorkOrderCard";
import FollowupCard from "../components/FollowupCard";
import ActivityLog from "../components/ActivityLog";
import EmptyState from "../components/EmptyState";
import { useReports, patchReport, appendActivity } from "../data/store";
import { CATEGORIES, STATUS_STEPS } from "../data/mockData";
import { useToast } from "../components/Toast";
import { timeAgo, fmtDate, isOverdue } from "../utils/format";

export default function ReportDetail() {
  const { id } = useParams();
  const location = useLocation();
  const reports = useReports();
  const toast = useToast();
  const similarRef = useRef(null);

  const report = reports.find((r) => r.id === id);
  const [note, setNote] = useState("");
  const [showSimilar, setShowSimilar] = useState(location.hash === "#similar");

  useEffect(() => {
    if (location.hash === "#similar" && similarRef.current) {
      setShowSimilar(true);
      setTimeout(
        () => similarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        150
      );
    }
  }, [location.hash]);

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="Report not found"
            message="This report may have been archived, or the link is incomplete."
            action={
              <Link to="/dashboard">
                <Btn variant="secondary" size="sm">
                  Back to dashboard
                </Btn>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const resolved = report.status === "Resolved";
  const overdue = isOverdue(report);
  const similar = (report.ai.similar?.ids || [])
    .map((rid) => reports.find((r) => r.id === rid))
    .filter(Boolean);

  const changeStatus = (value) => {
    patchReport(
      report.id,
      {
        status: value,
        resolvedAt: value === "Resolved" ? new Date().toISOString() : null,
      },
      { kind: "human", who: "You (Official)", text: `Status changed to ${value}.` }
    );
    if (value === "Resolved") {
      appendActivity(report.id, {
        kind: "agent",
        who: "Follow-up Agent",
        text: "Citizen notified and asked to confirm the fix.",
      });
    }
    toast(
      value === "Resolved"
        ? `${report.ref} marked as resolved`
        : `Status set to ${value}`
    );
  };

  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    patchReport(report.id, {}, { kind: "human", who: "You (Official)", text: `Note: “${text}”` });
    setNote("");
    toast("Note added");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <CategoryIcon category={report.category} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {CATEGORIES[report.category].label}
            </h1>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {report.ref}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="size-3.5" />
            {report.location.address}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <PriorityBadge value={report.priority} />
          <StatusBadge value={report.status} />
          {overdue && (
            <OverdueTag days={Math.max(1, Math.round((Date.now() - new Date(report.dueDate)) / 864e5))} />
          )}
        </div>
      </div>

      {resolved && (
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3.5 text-sm text-green-800">
          <CheckCircle2 className="size-4.5 shrink-0 text-green-600" />
          <span>
            <span className="font-semibold">Resolved on {fmtDate(report.resolvedAt)}</span>
            {" — "}the citizen was notified and the Follow-up Agent closed the loop.
          </span>
        </div>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------- LEFT */}
        <div className="space-y-5">
          <Card>
            <CardHeader icon={UserRound} title="Citizen report" sub={`Filed ${timeAgo(report.createdAt)} · ${report.location.area}`} />
            <div className="p-5">
              <p className="text-[15px] leading-relaxed text-slate-700">
                {report.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {report.location.address}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Reported {timeAgo(report.createdAt)}
                </span>
              </div>

              {report.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {report.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Evidence ${i + 1}`}
                      className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}

              <MapPlaceholder address={report.location.address} className="mt-4 h-48" />
            </div>
          </Card>

          <AISummaryCard
            analysis={{
              category: report.category,
              categoryLabel: CATEGORIES[report.category].label,
              priority: report.ai.severity,
              reason: report.ai.reason,
              evidence: report.ai.evidence,
              confidence: report.ai.confidence,
              department: report.department,
              similar: report.ai.similar,
            }}
            onViewSimilar={() => {
              setShowSimilar(true);
              setTimeout(
                () => similarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                50
              );
            }}
          />

          {/* Similar reports (collapsed by default) */}
          <Card ref={similarRef} className="scroll-mt-24">
            <button
              onClick={() => setShowSimilar((s) => !s)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={showSimilar}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <Link2 className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Similar reports ({report.ai.similar?.count ?? 0})
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Possible duplicates found by the Duplicate Detection agent
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`size-4 shrink-0 text-slate-400 transition-transform ${showSimilar ? "rotate-180" : ""}`}
              />
            </button>
            {showSimilar && (
              <div className="border-t border-slate-100 px-5 pb-4 pt-1">
                {similar.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">
                    Nothing else like this nearby — this looks like a unique case.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {similar.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={`/reports/${s.id}`}
                          className="flex items-center gap-3 py-3 transition-colors hover:bg-green-50/40"
                        >
                          <CategoryIcon category={s.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">{s.ref}</p>
                            <p className="truncate text-xs text-slate-500">{s.location.address}</p>
                          </div>
                          <StatusBadge value={s.status} />
                          <span className="text-xs text-slate-400">{timeAgo(s.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------- RIGHT */}
        <div className="space-y-5">
          <WorkOrderCard report={report} />

          <Card>
            <CardHeader icon={ListChecks} title="Update status" sub="Changes notify the citizen" />
            <div className="space-y-3 p-5">
              <Select
                value={report.status}
                onChange={(e) => changeStatus(e.target.value)}
                disabled={resolved}
              >
                {STATUS_STEPS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>

              <div className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Add a note…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-600/10"
                />
                <Btn variant="secondary" size="sm" onClick={addNote} disabled={!note.trim()} className="shrink-0">
                  <Plus className="size-4" />
                  Note
                </Btn>
              </div>

              {!resolved ? (
                <Btn className="w-full" onClick={() => changeStatus("Resolved")}>
                  <Check className="size-4" strokeWidth={3} />
                  Mark as Resolved
                </Btn>
              ) : (
                <p className="rounded-xl bg-green-50 px-3.5 py-2.5 text-center text-xs font-medium text-green-700">
                  This work order is closed.
                </p>
              )}
            </div>
          </Card>

          <FollowupCard report={report} />

          <Card>
            <CardHeader icon={History} title="Activity" sub="Agent and human actions, newest first" />
            <div className="p-5">
              <ActivityLog items={report.activity} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
