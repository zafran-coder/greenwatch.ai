import { ChevronDown } from "lucide-react";

// --- Cards -------------------------------------------------------------------

export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ icon: Icon, title, sub, aside }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Icon className="size-4" />
          </span>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

// --- Buttons -----------------------------------------------------------------

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-600/20 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const btnVariants = {
  primary: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

const btnSizes = {
  md: "h-11 px-5 text-sm",
  sm: "h-9 px-3.5 text-sm",
  xs: "h-8 px-3 text-xs",
};

export function Btn({ variant = "primary", size = "md", className = "", ...props }) {
  return (
    <button
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...props}
    />
  );
}

// --- Form controls -------------------------------------------------------------

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-600/10";

export function Select({ children, className = "", ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select
        className={`${inputCls} cursor-pointer appearance-none pr-9`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function FieldLabel({ children, optional, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="flex items-baseline justify-between text-sm font-medium text-slate-800">
        <span>
          {children}
          {required && <span className="ml-0.5 font-semibold text-red-500">*</span>}
        </span>
        {optional && (
          <span className="text-xs font-normal text-slate-500">optional</span>
        )}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
