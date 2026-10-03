import { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";
import MapPlaceholder from "./MapPlaceholder";
import { inputCls } from "./ui";

const NEARBY_SPOTS = [
  { address: "Green Park Avenue, near gate 2", area: "Riverside District", lat: 40.7112, lng: -74.0067 },
  { address: "Elm Street, by Bloom School", area: "Bloomfield", lat: 40.7212, lng: -73.9987 },
  { address: "Riverside Walkway, Pier 4", area: "Riverside District", lat: 40.7093, lng: -74.0122 },
  { address: "Hill Road, community garden gate", area: "Hill District", lat: 40.7244, lng: -74.0041 },
  { address: "Rosewood Lane, corner of 5th Ave", area: "Old Town", lat: 40.7157, lng: -73.9964 },
];

export default function LocationField({ location, setLocation, error }) {
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (locating) return;
    setLocating(true);
    // Simulated GPS lookup — resolves with a nearby spot after a short delay.
    setTimeout(() => {
      const spot =
        NEARBY_SPOTS[Math.floor(Math.random() * NEARBY_SPOTS.length)];
      setLocation(spot);
      setLocating(false);
    }, 1100);
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={`${inputCls} flex-1 ${error ? "border-red-300 focus:border-red-400 focus:ring-red-500/10" : ""}`}
          placeholder="Street, landmark or park name"
          value={location?.address || ""}
          onChange={(e) =>
            setLocation(
              e.target.value
                ? { address: e.target.value, area: "", lat: null, lng: null }
                : null
            )
          }
        />
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin text-green-600" />
          ) : (
            <LocateFixed className="size-4 text-green-600" />
          )}
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <MapPlaceholder
        address={location?.address}
        className="mt-3 h-44 sm:h-52"
      />
    </div>
  );
}
