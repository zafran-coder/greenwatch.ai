import { Link } from "react-router-dom";
import {
  ArrowRight,
  LayoutDashboard,
  Smartphone,
  Sparkles,
  Route,
  ClipboardCheck,
} from "lucide-react";
import { Card } from "../components/ui";
import { AIBadge, PriorityBadge } from "../components/Badges";
import CategoryIcon from "../components/CategoryIcon";
import { PLATFORM } from "../data/mockData";

const STEPS = [
  {
    icon: Smartphone,
    title: "Report",
    text: "Snap a photo and describe the problem in a sentence.",
  },
  {
    icon: Sparkles,
    title: "AI analysis",
    text: "Agents verify evidence, find duplicates and score priority.",
  },
  {
    icon: Route,
    title: "Routed to a team",
    text: "The right department gets a ready-made work order.",
  },
  {
    icon: ClipboardCheck,
    title: "Resolved",
    text: "Follow-ups keep it moving until it's done — and you hear back.",
  },
];

const DOT = <span className="text-green-600">.</span>;

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-240px] h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-green-100/60 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-medium text-green-700 shadow-sm">
            <Sparkles className="size-3.5" />
            AI-coordinated city response
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Report{DOT} Route{DOT} Resolve{DOT}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            GreenWatch AI turns a citizen's report into an approved work order
            for the right city team — then tracks it until it's done.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/report"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-700 active:scale-[0.98] sm:w-auto"
            >
              Report an Issue
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              <LayoutDashboard className="size-4" />
              Official Dashboard
            </Link>
          </div>
        </div>

        {/* Product at a glance — example AI summary for one report */}
        <div className="relative mx-auto max-w-xl px-4 sm:px-6">
          <Card className="overflow-hidden text-left shadow-pop animate-fade-in">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-green-50/50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <AIBadge label="AI Summary" />
                <span className="text-xs text-slate-500">GW-2041</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                example · generated in ~4s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Category
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <CategoryIcon category="garbage" size="sm" />
                  Illegal Garbage Dumping
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Severity
                </p>
                <div className="mt-1.5">
                  <PriorityBadge value="High" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Department
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  Sanitation
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Similar reports
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  2 found{" "}
                  <span className="text-xs font-normal text-slate-500">
                    · linked, not merged
                  </span>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900">
          How it works
        </h2>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          From your phone to the right crew — in four steps.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="relative p-5">
              <span className="absolute right-4 top-4 text-xs font-semibold text-slate-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <step.icon className="size-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {step.text}
              </p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-slate-300 lg:block" />
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <Card className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { value: PLATFORM.totalFiled.toLocaleString(), label: "Reports filed this year" },
            { value: `${PLATFORM.resolvedPct}%`, label: "Resolved and confirmed" },
            { value: `${PLATFORM.avgDays} days`, label: "Average time to resolve" },
          ].map((s) => (
            <div key={s.label} className="px-6 py-6 text-center sm:py-7">
              <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
