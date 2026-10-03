import { Sparkles, UserRound } from "lucide-react";
import { timeAgo, fmtDateTime } from "../utils/format";

/**
 * Vertical activity log, newest first.
 * items: [{ kind: "agent"|"human", who, text, at }]
 */
export default function ActivityLog({ items }) {
  const sorted = [...items].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <ol className="space-y-5">
      {sorted.map((item, i) => {
        const isAgent = item.kind === "agent";
        return (
          <li key={i} className="relative flex gap-3">
            {i < sorted.length - 1 && (
              <span className="absolute left-[13px] top-8 h-[calc(100%-20px)] w-px bg-slate-100" />
            )}
            <span
              className={`relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                isAgent
                  ? "bg-green-50 text-green-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {isAgent ? (
                <Sparkles className="size-3.5" />
              ) : (
                <UserRound className="size-3.5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">
                <span
                  className={`font-semibold ${
                    isAgent ? "text-green-700" : "text-slate-700"
                  }`}
                >
                  {item.who}
                </span>
                {" · "}
                <span title={fmtDateTime(item.at)}>{timeAgo(item.at)}</span>
                {isAgent && <span className="ml-1.5 rounded bg-green-50 px-1 py-px text-[10px] font-semibold text-green-700">AI</span>}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
