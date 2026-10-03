import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Send,
  Sparkles,
  CircleCheck,
  Copy,
  Hash,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { Card, Btn, FieldLabel } from "../components/ui";
import { AIBadge } from "../components/Badges";
import PhotoUploader from "../components/PhotoUploader";
import LocationField from "../components/LocationField";
import AgentStepper from "../components/AgentStepper";
import AISummaryCard from "../components/AISummaryCard";
import { classifyIssue, buildAgentSteps } from "../lib/ai";
import {
  useReports,
  addReport,
  nextRef,
  nextWorkOrder,
  newId,
} from "../data/store";
import { useToast } from "../components/Toast";
import garbageImg from "../assets/garbage.jpg";
import waterImg from "../assets/water.jpg";
import treeImg from "../assets/tree.jpg";

const DUE_DAYS = { High: 1, Medium: 3, Low: 5 };

const SAMPLES = [
  {
    description:
      "A pile of garbage bags has been dumped beside the green belt on Margalla Road. Stray dogs are tearing the bags open and the smell is spreading to the walking trail.",
    location: "Margalla Road, F-8/4, Islamabad",
    area: "F-8, Islamabad",
    photo: garbageImg,
  },
  {
    description:
      "A water pipe is leaking heavily near the service road in G-9 Markaz. Clean water has been flowing onto the street since early morning and thousands of litres are going to waste.",
    location: "Service Road South, G-9 Markaz, Islamabad",
    area: "G-9, Islamabad",
    photo: waterImg,
  },
  {
    description:
      "A large eucalyptus branch fell across the walking track in Fatima Jinnah Park after last night's storm. It's blocking the path near the F-9 gate where children play.",
    location: "Fatima Jinnah Park, near F-9 gate, Islamabad",
    area: "F-9, Islamabad",
    photo: treeImg,
  },
];

export default function ReportIssue() {
  const reports = useReports();
  const toast = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("form"); // form | analyzing | done
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [location, setLocation] = useState(null);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);

  const steps = useMemo(
    () => (result ? buildAgentSteps(result.analysis, result.report.workOrder) : []),
    [result]
  );

  const clearError = (key) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const fillSample = () => {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    setDescription(s.description);
    setLocation({ address: s.location, area: s.area, lat: null, lng: null });
    setPhotos([{ id: `sample-${Date.now()}`, url: s.photo }]);
    setErrors({});
    toast("Sample report filled — review and submit", "info");
  };

  const reset = () => {
    setDescription("");
    setPhotos([]);
    setLocation(null);
    setErrors({});
    setResult(null);
    setPhase("form");
    window.scrollTo({ top: 0 });
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    const text = description.trim();
    if (!text) errs.description = "Please describe the problem.";
    else if (text.length < 10)
      errs.description = "Please add a few more details (at least 10 characters).";
    if (!location?.address?.trim())
      errs.location = "Add a location so the crew knows where to go.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // --- Run the simulated pipeline -------------------------------------
    const analysis = classifyIssue(description, photos.length, reports);
    const now = new Date().toISOString();
    const workOrder = nextWorkOrder();
    const ref = nextRef();

    const report = {
      id: newId(),
      ref,
      category: analysis.category,
      description: description.trim(),
      location: {
        address: location.address.trim(),
        area: location.area || "Reported via app",
        lat: location.lat,
        lng: location.lng,
      },
      photos: photos.map((p) => p.url),
      priority: analysis.priority,
      status: "Assigned",
      department: analysis.department,
      assignee: null,
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(
        Date.now() + (DUE_DAYS[analysis.priority] || 3) * 864e5
      ).toISOString(),
      resolvedAt: null,
      workOrder,
      ai: {
        severity: analysis.priority,
        reason: analysis.reason,
        evidence: analysis.evidence,
        confidence: analysis.confidence,
        similar: {
          count: analysis.similarReports.length,
          ids: analysis.similarReports.map((r) => r.id),
        },
      },
      activity: [
        {
          kind: "agent",
          who: "Triage Agent",
          text: `Classified as ${analysis.categoryLabel} (${analysis.confidence}% confidence).`,
          at: now,
        },
        {
          kind: "agent",
          who: "Routing Agent",
          text: `Routed to ${analysis.department}. Work order ${workOrder} created.`,
          at: now,
        },
      ],
    };

    addReport(report);
    setResult({ report, analysis });
    setPhase("analyzing");
    window.scrollTo({ top: 0 });
  };

  const finishAnalysis = () => {
    setPhase("done");
    toast(`Report ${result.report.ref} submitted — work order created`);
    window.scrollTo({ top: 0 });
  };

  // ---------------------------------------------------------------- phase UI

  if (phase === "analyzing" && result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="p-6 sm:p-8">
          <div className="mb-7 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                Analyzing your report
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Six AI agents are checking it — this takes a few seconds.
              </p>
            </div>
            <AIBadge label="AI at work" />
          </div>
          <AgentStepper steps={steps} onDone={finishAnalysis} />
        </Card>
      </div>
    );
  }

  if (phase === "done" && result) {
    const { report, analysis } = result;
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CircleCheck className="size-6" />
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            Report received — AI analysis complete
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A human official will review and approve every AI suggestion.
          </p>
        </div>

        <AISummaryCard
          analysis={{
            category: analysis.category,
            categoryLabel: analysis.categoryLabel,
            priority: analysis.priority,
            reason: analysis.reason,
            evidence: analysis.evidence,
            confidence: analysis.confidence,
            department: analysis.department,
            locationText: report.location.address,
            similar: { count: analysis.similarReports.length },
          }}
          onViewSimilar={() => navigate(`/reports/${report.id}#similar`)}
        />

        <Card className="p-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Hash className="size-3.5" /> Your reference ID
          </p>
          <p className="mt-2 flex items-center justify-center gap-2.5 text-3xl font-bold tracking-[0.12em] text-slate-900">
            {report.ref}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(report.ref);
                toast("Reference ID copied", "info");
              }}
              aria-label="Copy reference ID"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <Copy className="size-4" />
            </button>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            No account needed — this ID is your tracking key.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Link to={`/track?ref=${report.ref}`}>
              <Btn className="w-full sm:w-auto">Track this report</Btn>
            </Link>
            <Btn variant="secondary" onClick={reset} className="w-full sm:w-auto">
              <RotateCcw className="size-4" />
              Submit another
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------- form

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Report an issue
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell us what's wrong — the AI pipeline routes it to the right city
          team and keeps you posted.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-6 p-5 sm:p-7" noValidate>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={fillSample}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 underline-offset-2 transition-colors hover:text-green-800 hover:underline"
            >
              <Wand2 className="size-3.5" />
              Fill sample report
            </button>
          </div>

          <div>
            <FieldLabel required>What's the problem?</FieldLabel>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              placeholder="Describe the problem, e.g. garbage dumped near the park"
              className={`w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:ring-4 ${
                errors.description
                  ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-600/10"
              }`}
            />
            <div className="mt-1.5 flex items-center justify-between">
              {errors.description ? (
                <p className="text-xs text-red-600">{errors.description}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  One or two sentences is enough.
                </p>
              )}
              <p className="text-xs tabular-nums text-slate-500">
                {description.length} chars
              </p>
            </div>
          </div>

          <div>
            <FieldLabel optional hint="Photos help us resolve issues faster">
              Photos
            </FieldLabel>
            <PhotoUploader photos={photos} setPhotos={setPhotos} max={3} />
          </div>

          <div>
            <FieldLabel required>Location</FieldLabel>
            <LocationField
              location={location}
              setLocation={(loc) => {
                setLocation(loc);
                clearError("location");
              }}
              error={errors.location}
            />
          </div>

          <div className="border-t border-slate-100 pt-5">
            <Btn type="submit" className="h-12 w-full text-[15px]">
              <Send className="size-4" />
              Submit Report
            </Btn>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
              <Sparkles className="size-3.5 text-green-500" />
              AI agents analyze it instantly — a human official approves every
              step.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
