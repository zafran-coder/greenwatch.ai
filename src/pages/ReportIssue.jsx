import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Send,
  Sparkles,
  CircleCheck,
  Copy,
  Hash,
  RotateCcw,
  Wand2,
  Loader2,
} from "lucide-react";
import { Card, Btn, FieldLabel } from "../components/ui";
import { AIBadge } from "../components/Badges";
import PhotoUploader from "../components/PhotoUploader";
import LocationField from "../components/LocationField";
import AgentStepper from "../components/AgentStepper";
import AISummaryCard from "../components/AISummaryCard";
import { useToast } from "../components/Toast";
import { api } from "../api";
import { CATEGORIES } from "../data/mockData";
import garbageImg from "../assets/garbage.jpg";
import waterImg from "../assets/water.jpg";
import treeImg from "../assets/tree.jpg";

const DEFAULT_STEPS = [
  { key: "triage", label: "Triage Agent", status: "running", detail: "Classifying issue category and urgency…" },
  { key: "evidence", label: "Evidence Agent", status: "pending", detail: "Waiting to verify photographic proof…" },
  { key: "duplicates", label: "Duplicate Detection", status: "pending", detail: "Waiting to scan geographic radius…" },
  { key: "priority", label: "Priority Agent", status: "pending", detail: "Waiting to evaluate health risk…" },
  { key: "routing", label: "Department Routing", status: "pending", detail: "Waiting to assign responsible department…" },
  { key: "workorder", label: "Work Order Created", status: "pending", detail: "Waiting to generate work order reference…" },
];

const SAMPLES = [
  {
    description:
      "A pile of garbage bags has been dumped beside the green belt on Margalla Road. Stray dogs are tearing the bags open and the smell is spreading to the walking trail.",
    location: "Margalla Road, F-8/4, Islamabad",
    area: "F-8, Islamabad",
    lat: 33.7182,
    lng: 73.0366,
    photo: garbageImg,
  },
  {
    description:
      "A water pipe is leaking heavily near the service road in G-9 Markaz. Clean water has been flowing onto the street since early morning and thousands of litres are going to waste.",
    location: "Service Road South, G-9 Markaz, Islamabad",
    area: "G-9, Islamabad",
    lat: 33.6844,
    lng: 73.0249,
    photo: waterImg,
  },
  {
    description:
      "A large eucalyptus branch fell across the walking track in Fatima Jinnah Park after last night's storm. It's blocking the path near the F-9 gate where children play.",
    location: "Fatima Jinnah Park, near F-9 gate, Islamabad",
    area: "F-9, Islamabad",
    lat: 33.7022,
    lng: 73.0211,
    photo: treeImg,
  },
];

export default function ReportIssue() {
  const toast = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("form"); // form | analyzing | done
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [location, setLocation] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Real backend report and pipeline steps
  const [createdReport, setCreatedReport] = useState(null);
  const [pipelineSteps, setPipelineSteps] = useState(DEFAULT_STEPS);
  const [finalReport, setFinalReport] = useState(null);

  const pollIntervalRef = useRef(null);

  const clearError = (key) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const fillSample = () => {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    setDescription(s.description);
    setLocation({
      address: s.location,
      area: s.area,
      lat: s.lat,
      lng: s.lng,
    });
    setPhotos([{ id: `sample-${Date.now()}`, url: s.photo }]);
    setErrors({});
    toast("Sample report filled — review and submit", "info");
  };

  const reset = () => {
    setDescription("");
    setPhotos([]);
    setLocation(null);
    setErrors({});
    setCreatedReport(null);
    setFinalReport(null);
    setPipelineSteps(DEFAULT_STEPS);
    setPhase("form");
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    window.scrollTo({ top: 0 });
  };

  // Convert photos array to real binary File objects for FormData
  const preparePhotosForUpload = async () => {
    const fileList = [];
    for (const p of photos) {
      if (p.file instanceof File) {
        fileList.push(p.file);
      } else if (p.url) {
        try {
          const res = await fetch(p.url);
          const blob = await res.blob();
          const ext = blob.type.includes("png") ? "png" : "jpg";
          const file = new File([blob], `evidence-${Date.now()}.${ext}`, {
            type: blob.type || "image/jpeg",
          });
          fileList.push(file);
        } catch {
          // If fetching as blob fails, skip
        }
      }
    }
    return fileList;
  };

  const submit = async (e) => {
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

    setSubmitting(true);

    try {
      // Build real FormData payload
      const formData = new FormData();
      formData.append("description", text);

      const resolvedLat = location.lat ?? 33.6844;
      const resolvedLng = location.lng ?? 73.0479;
      const locationPayload = {
        address: location.address.trim(),
        area: location.area || "Islamabad",
        lat: resolvedLat,
        lng: resolvedLng,
      };
      formData.append("location", JSON.stringify(locationPayload));

      const files = await preparePhotosForUpload();
      for (const file of files) {
        formData.append("photos", file);
      }

      // Real API submission
      const response = await api.reports.create(formData);
      const report = response.report;

      setCreatedReport(report);
      if (response.steps && response.steps.length > 0) {
        setPipelineSteps(response.steps);
      } else {
        setPipelineSteps(DEFAULT_STEPS);
      }

      setPhase("analyzing");
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast(err.message || "Failed to submit report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Poll GET /api/reports/:id/pipeline every ~1s while analyzing
  useEffect(() => {
    if (phase !== "analyzing" || !createdReport?.id) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const pipelineData = await api.reports.getPipeline(createdReport.id);
        if (pipelineData?.steps && Array.isArray(pipelineData.steps)) {
          setPipelineSteps(pipelineData.steps);
        }

        // If pipeline completed, fetch the latest report state
        if (pipelineData?.status === "completed") {
          const fresh = await api.reports.getById(createdReport.id);
          setFinalReport(fresh);
        }
      } catch {
        // Polling will retry quietly on next tick
      }
    };

    // Immediate first check
    poll();
    pollIntervalRef.current = setInterval(poll, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [phase, createdReport?.id]);

  const finishAnalysis = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Ensure we have the enriched report data
    let reportToDisplay = finalReport;
    if (!reportToDisplay && createdReport?.id) {
      try {
        reportToDisplay = await api.reports.getById(createdReport.id);
        setFinalReport(reportToDisplay);
      } catch {
        reportToDisplay = createdReport;
      }
    }

    setPhase("done");
    toast(`Report ${reportToDisplay?.ref || "GW-XXXX"} submitted — work order created`);
    window.scrollTo({ top: 0 });
  };

  // ---------------------------------------------------------------- phase UI

  if (phase === "analyzing") {
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
          <AgentStepper steps={pipelineSteps} onDone={finishAnalysis} />
        </Card>
      </div>
    );
  }

  if (phase === "done" && (finalReport || createdReport)) {
    const report = finalReport || createdReport;
    const catLabel =
      CATEGORIES[report.category]?.label ||
      report.category.charAt(0).toUpperCase() + report.category.slice(1);

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
            category: report.category,
            categoryLabel: catLabel,
            priority: report.priority,
            reason: report.ai?.reason || `Triaged as ${report.priority} priority for ${report.department}.`,
            evidence: report.ai?.evidence || "Good",
            confidence: report.ai?.confidence || 94,
            department: report.department,
            locationText: report.location?.address,
            similar: { count: report.ai?.similar?.count || 0 },
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
            Work order <strong className="text-slate-700">{report.workOrder || report.workOrderRef}</strong> created · No account needed
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
            <Btn type="submit" disabled={submitting} className="h-12 w-full text-[15px]">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting Report…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit Report
                </>
              )}
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
