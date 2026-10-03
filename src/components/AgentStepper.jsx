import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Cpu } from "lucide-react";

const STEP_MS = [500, 700, 750, 700, 650, 600];

/**
 * Vertical animated stepper. Steps light up one by one (~3.9s total),
 * then onDone fires.
 */
export default function AgentStepper({ steps, onDone }) {
  const [active, setActive] = useState(0); // index currently running
  const [done, setDone] = useState(0); // count completed
  const doneRef = useRef(false);

  useEffect(() => {
    let timer;
    let i = 0;
    const run = () => {
      if (i >= steps.length) {
        if (!doneRef.current) {
          doneRef.current = true;
          timer = setTimeout(() => onDone?.(), 500);
        }
        return;
      }
      setActive(i);
      timer = setTimeout(() => {
        setDone((d) => d + 1);
        i += 1;
        run();
      }, STEP_MS[i % STEP_MS.length]);
    };
    run();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const isDone = i < done;
        const isActive = i === active && !isDone;
        return (
          <li key={step.key} className="relative flex gap-3.5 pb-6 last:pb-0">
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
                  isDone ? "opacity-100" : "opacity-0"
                }`}
              >
                {isDone ? step.detail : "…"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
