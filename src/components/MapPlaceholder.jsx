import { useState } from "react";
import { Map as MapIcon, MapPin } from "lucide-react";

/**
 * Lightweight static "map" — an SVG street grid with a pin.
 * Click anywhere inside the box to move the pin. No map library needed.
 */
export default function MapPlaceholder({ address, className = "" }) {
  const [pin, setPin] = useState({ x: 50, y: 50 });

  const movePin = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPin({
      x: Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(92, Math.max(8, ((e.clientY - rect.top) / rect.height) * 100)),
    });
  };

  return (
    <div
      onClick={movePin}
      role="button"
      aria-label="Map preview — click to fine-tune the pin"
      title="Click to fine-tune the pin"
      className={`relative cursor-crosshair select-none overflow-hidden rounded-xl border border-slate-200 bg-[#ECF3ED] ${className}`}
    >
      <svg
        viewBox="0 0 400 220"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <rect width="400" height="220" fill="#ECF3ED" />
        {/* green blocks = parks */}
        <rect x="24" y="30" width="90" height="64" rx="10" fill="#D8EAD9" />
        <rect x="286" y="120" width="92" height="70" rx="10" fill="#D8EAD9" />
        <rect x="250" y="18" width="60" height="44" rx="10" fill="#E1EFE2" />
        {/* roads */}
        <g stroke="#FFFFFF" strokeLinecap="round">
          <path d="M0 116 H400" strokeWidth="16" />
          <path d="M150 0 V220" strokeWidth="14" />
          <path d="M0 180 C120 170 260 196 400 176" strokeWidth="12" fill="none" />
          <path d="M255 0 C265 80 235 150 250 220" strokeWidth="10" fill="none" />
          <path d="M0 60 H130" strokeWidth="9" />
          <path d="M320 60 H400" strokeWidth="9" />
        </g>
        {/* dashes on main road */}
        <path
          d="M0 116 H400"
          stroke="#C9DDD0"
          strokeWidth="2"
          strokeDasharray="10 12"
        />
      </svg>

      {/* label */}
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
        <MapIcon className="size-3 text-green-600" />
        Map preview
      </span>

      {/* draggable-feel pin */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
      >
        <span className="absolute -inset-3 animate-ping rounded-full bg-green-600/20" />
        <span className="relative flex size-9 items-center justify-center rounded-full bg-green-600 text-white shadow-pop ring-4 ring-white">
          <MapPin className="size-4" />
        </span>
      </div>

      {address && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
          <MapPin className="size-3.5 shrink-0 text-green-600" />
          <span className="truncate">{address}</span>
        </div>
      )}
    </div>
  );
}
