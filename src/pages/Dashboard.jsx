import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  Loader,
  AlarmClock,
  CircleCheck,
  AlertTriangle,
  ChevronRight,
  Search,
  Rows3,
  ChartColumn,
  BarChart3,
  LineChart as LineChartIcon,
  ShieldCheck,
  FilterX,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, Select, Btn } from "../components/ui";
import StatCard from "../components/StatCard";
import ReportTable from "../components/ReportTable";
import EmptyState from "../components/EmptyState";
import { StatusBadge } from "../components/Badges";
import CategoryIcon from "../components/CategoryIcon";
import { CategoryChart, TrendChart, DeptRateChart } from "../components/Charts";
import {
  StatCardsGroupSkeleton,
  ReportTableSkeleton,
} from "../components/Skeletons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { CATEGORIES, DEPARTMENTS, STATUS_STEPS, PRIORITIES } from "../data/mockData";
import { isOverdue, ageOf } from "../utils/format";

const inputIconCls =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-600/10";

export default function Dashboard() {
  const { role, isOfficial } = useAuth();

  const [tab, setTab] = useState("reports"); // reports | analytics
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [priority, setPriority] = useState("All");
  const [department, setDepartment] = useState("All");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // Live data states
  const [reports, setReports] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const [attention, setAttention] = useState([]);

  // Debounce search query input (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
    }, 250);
    return () => clearTimeout(handler);
  }, [q]);

  // Fetch KPIs and Attention list
  const loadKpis = async () => {
    try {
      setKpisLoading(true);
      const [kpiRes, attentionRes] = await Promise.allSettled([
        api.analytics.getKpis(),
        api.analytics.getAttention(),
      ]);

      if (kpiRes.status === "fulfilled") {
        setKpis(kpiRes.value?.data || kpiRes.value || null);
      }
      if (attentionRes.status === "fulfilled") {
        const attItems = attentionRes.value?.data || attentionRes.value || [];
        setAttention(Array.isArray(attItems) ? attItems.slice(0, 3) : []);
      }
    } catch {
      // Retried by client
    } finally {
      setKpisLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  // Fetch Reports list when filters change
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const res = await api.reports.list({
        status,
        category,
        priority,
        department,
        q: debouncedQ,
        limit: 100,
      });

      const items = res.items || [];
      setReports(items);
      setTotalCount(res.total || items.length);

      // Fallback attention items if endpoint was empty
      if (attention.length === 0 && items.length > 0) {
        const highOrOverdue = items
          .filter((r) => r.status !== "Resolved" && (isOverdue(r) || r.priority === "High"))
          .sort((a, b) => {
            const oa = isOverdue(a) ? 0 : 1;
            const ob = isOverdue(b) ? 0 : 1;
            if (oa !== ob) return oa - ob;
            return new Date(a.dueDate || a.createdAt) - new Date(b.dueDate || b.createdAt);
          })
          .slice(0, 3);
        setAttention(highOrOverdue);
      }
    } catch (err) {
      console.error("[Dashboard] Error loading reports:", err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [status, category, priority, department, debouncedQ]);

  const isFiltered =
    status !== "All" ||
    category !== "All" ||
    priority !== "All" ||
    department !== "All" ||
    q.trim();

  const resetFilters = () => {
    setStatus("All");
    setCategory("All");
    setPriority("All");
    setDepartment("All");
    setQ("");
    setDebouncedQ("");
  };

  const getCategoryLabel = (cat) =>
    CATEGORIES[cat]?.label || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Issue");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Operations dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every citizen report in one place — AI-routed, human-approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadKpis();
              loadReports();
            }}
            title="Refresh dashboard"
            className="inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <ShieldCheck className="size-3.5 text-green-600" />
            {isOfficial ? "Viewing as City Official" : "Read-only citizen view"}
          </span>
        </div>
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <Card className="mt-6 border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 border-b border-red-100 px-5 py-3.5">
            <AlertTriangle className="size-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-800">Needs attention</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {attention.length}
            </span>
          </div>
          <div className="divide-y divide-red-100/70">
            {attention.map((r) => (
              <Link
                key={r.id}
                to={`/reports/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-50 sm:px-5"
              >
                <CategoryIcon category={r.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    <span className="font-semibold">{r.ref}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {getCategoryLabel(r.category)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.location?.address || "Reported location"}
                  </p>
                </div>
                <span className="hidden shrink-0 sm:block">
                  <StatusBadge value={r.status} />
                </span>
                <span className="shrink-0 text-xs font-medium text-red-600">
                  {isOverdue(r)
                    ? `Overdue · ${r.priority}`
                    : `${r.priority} priority · ${ageOf(r.createdAt)} old`}
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Stats */}
      {kpisLoading && !kpis ? (
        <StatCardsGroupSkeleton />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={Inbox}
            label="New"
            value={kpis?.fresh ?? 0}
            hint="awaiting first review"
            accent="slate"
          />
          <StatCard
            icon={Loader}
            label="In progress"
            value={kpis?.active ?? kpis?.inProgress ?? 0}
            hint="assigned or being fixed"
            accent="amber"
          />
          <StatCard
            icon={AlarmClock}
            label="Overdue"
            value={kpis?.overdue ?? 0}
            hint="past their due date"
            accent="red"
          />
          <StatCard
            icon={CircleCheck}
            label="Resolved today"
            value={kpis?.resolvedToday ?? 0}
            hint="confirmed & closed"
            accent="green"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-7 flex w-fit gap-1 rounded-full bg-slate-100 p-1">
        {[
          { id: "reports", label: "Reports", icon: Rows3 },
          { id: "analytics", label: "Analytics", icon: ChartColumn },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all ${
              tab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <>
          {/* Filters */}
          <Card className="mt-4 grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4 lg:flex lg:items-center">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="lg:w-40"
            >
              <option value="All">All statuses</option>
              {STATUS_STEPS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="lg:w-52"
            >
              <option value="All">All categories</option>
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="lg:w-36"
            >
              <option value="All">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="lg:w-48"
            >
              <option value="All">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <div className="relative col-span-2 sm:col-span-4 lg:flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ID, place, keyword…"
                className={inputIconCls}
              />
            </div>
          </Card>

          {/* Table */}
          <Card className="mt-4 overflow-hidden">
            {reportsLoading && reports.length === 0 ? (
              <ReportTableSkeleton rows={8} />
            ) : reports.length === 0 ? (
              <EmptyState
                icon={FilterX}
                title="No reports match"
                message="Try widening the filters or clearing the search."
                action={
                  <Btn variant="secondary" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Btn>
                }
              />
            ) : (
              <>
                <ReportTable reports={reports} />
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                  <p className="text-xs text-slate-400">
                    Showing {reports.length} of {totalCount} reports
                  </p>
                  {isFiltered && (
                    <button
                      onClick={resetFilters}
                      className="text-xs font-medium text-green-700 hover:text-green-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {tab === "analytics" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader
              icon={LineChartIcon}
              title="Reports over time"
              sub="Filed vs resolved · last 14 days"
            />
            <div className="p-4">
              <TrendChart />
            </div>
          </Card>
          <Card>
            <CardHeader
              icon={BarChart3}
              title="Reports by category"
              sub="What's being reported most"
            />
            <div className="p-4">
              <CategoryChart />
            </div>
          </Card>
          <Card>
            <CardHeader
              icon={CircleCheck}
              title="Resolution rate by department"
              sub="Share of reports closed within SLA"
            />
            <div className="p-4">
              <DeptRateChart />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
