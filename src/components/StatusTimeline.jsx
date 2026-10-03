import { Check } from "lucide-react";
import { STATUS_STEPS } from "../data/mockData";

/**
 * Horizontal status timeline: Received → Verified → Assigned → In Progress → Resolved.
 * ("Received" is the friendly name for a "New" report.)
 */
export default function StatusTimeline({ status }) {
  const current = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-start px-1 pt-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const isFinal = step === "Resolved" && isCurrent;
        return (
          <div key={step} className="flex flex-1 items-start last:flex-none">
            {/* node + label */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  done || isCurrent
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-slate-200 bg-white text-slate-300"
                } ${isCurrent && !isFinal ? "ring-4 ring-green-600/15" : ""}`}
              >
                {done || isFinal ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] font-medium sm:text-xs ${
                  done || isCurrent ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {step === "New" ? "Received" : step}
              </span>
            </div>
            {/* connector */}
            {i < STATUS_STEPS.length - 1 && (
              <div className="mx-1 mt-[15px] h-0.5 flex-1 rounded-full bg-slate-200 sm:mx-2">
                <div
                  className={`h-full rounded-full bg-green-500 transition-all duration-500 ${
                    done ? "w-full" : "w-0"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
