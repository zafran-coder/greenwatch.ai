import { MapPin, CircleCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "./ui";
import { AIBadge, PriorityBadge } from "./Badges";
import CategoryIcon from "./CategoryIcon";

function Row({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

/**
 * The pipeline result card.
 * analysis: { category, categoryLabel, priority, reason, evidence, confidence,
 *             department, similarReports|similar:{count,ids} , locationText }
 */
export default function AISummaryCard({ analysis, similarLink, onViewSimilar }) {
  const similarCount =
    analysis.similar?.count ?? analysis.similarReports?.length ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-green-50/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <AIBadge label="AI Analysis" />
          <span className="text-xs text-slate-500">
            {analysis.confidence}% confidence
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          AI suggested · human approved
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
        <Row label="Category">
          <span className="flex items-center gap-2.5 font-medium text-slate-900">
            <CategoryIcon category={analysis.category} size="sm" />
            {analysis.categoryLabel}
          </span>
        </Row>

        <Row label="Severity">
          <PriorityBadge value={analysis.priority} />
        </Row>

        {analysis.locationText && (
          <Row label="Location" wide>
            <span className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
              {analysis.locationText}
            </span>
          </Row>
        )}

        <Row label="Assigned department">
          <span className="font-medium text-slate-900">
            {analysis.department}
          </span>
        </Row>

        <Row label="Similar reports">
          <span className="flex items-center gap-2">
            <span className="font-medium">{similarCount} found</span>
            {similarCount > 0 && (similarLink || onViewSimilar) && (
              similarLink ? (
                <Link
                  to={similarLink}
                  className="text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
                >
                  View similar
                </Link>
              ) : (
                <button
                  onClick={onViewSimilar}
                  className="text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
                >
                  View similar
                </button>
              )
            )}
          </span>
        </Row>

        <Row label="Reason for priority" wide>
          {analysis.reason}
        </Row>

        <Row label="Evidence quality" wide>
          {analysis.evidence === "Good" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-green-700">
              <CircleCheck className="size-4" /> Good
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
              <TriangleAlert className="size-4" /> Needs more info
            </span>
          )}
        </Row>
      </div>
    </Card>
  );
}
