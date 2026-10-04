import { useEffect, useRef } from "react";
import { Check, Loader2, Cpu } from "lucide-react";

/**
 * Vertical animated stepper driven by the server AI Agent Pipeline.
 * Visually identical to original design.
 * Steps light up as each agent completes its work, then onDone fires.
 *
 * steps: [{ key, label, status: "pending" | "running" | "completed", detail }]
 */
export default function AgentStepper({ steps = [], onDone }) {
  const doneFiredRef = useRef(false);

  // Determine which step is currently active
  const firstIncompleteIdx = steps.findIndex((s) => s.status !== "completed");
  const allCompleted = steps.length > 0 && firstIncompleteIdx === -1;

  useEffect(() => {
    if (allCompleted && !doneFiredRef.current) {
      doneFiredRef.current = true;
      const timer = setTimeout(() => {
        onDone?.();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, onDone]);

  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const isDone = step.status === "completed";
        const isActive =
          !isDone && (step.status === "running" || i === firstIncompleteIdx);

        return (
          <li key={step.key || i} className="relative flex gap-3.5 pb-6 last:pb-0">
            {/* connector */}
            {i < steps.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-26px)] w-0.5 bg-slate-200">
                <span
                  className={`block w-full bg-green-500 transition-all duration-500 ${
                    isDone ? "h-full" : "h-0"
                  }`}
                />
              </span>
            )}

            {/* node */}
            <span
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                isDone
                  ? "border-green-600 bg-green-600 text-white"
                  : isActive
                  ? "border-green-500 bg-white text-green-600"
                  : "border-slate-200 bg-white text-slate-300"
              }`}
            >
              {isDone ? (
                <Check className="size-4" strokeWidth={3} />
              ) : isActive ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Cpu className="size-3.5" />
              )}
            </span>

            {/* copy */}
            <div className="min-w-0 pt-1">
              <p
                className={`text-sm font-medium transition-colors ${
                  isDone || isActive ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {step.label}
                {isActive && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-green-600">
                    working
                    <span className="flex gap-0.5">
                      <i className="size-1 animate-bounce rounded-full bg-green-500 [animation-delay:0ms]" />
                      <i className="size-1 animate-bounce rounded-full bg-green-500 [animation-delay:150ms]" />
                      <i className="size-1 animate-bounce rounded-full bg-green-500 [animation-delay:300ms]" />
                    </span>
                  </span>
                )}
              </p>
              <p
                className={`mt-0.5 text-xs text-slate-500 transition-opacity duration-300 ${
                  isDone && step.detail ? "opacity-100" : "opacity-0"
                }`}
              >
                {isDone && step.detail ? step.detail : "…"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
