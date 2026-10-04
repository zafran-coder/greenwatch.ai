import { useState, useRef, useEffect } from "react";
import { LocateFixed, Loader2 } from "lucide-react";
import MapPlaceholder from "./MapPlaceholder";
import { inputCls } from "./ui";
import { reverseGeocode, ISLAMABAD_CENTER } from "../lib/nominatim";

const NEARBY_SPOTS = [
  { address: "Margalla Road, F-8/4, Islamabad", area: "F-8, Islamabad", lat: 33.7182, lng: 73.0366 },
  { address: "Service Road South, G-9 Markaz, Islamabad", area: "G-9, Islamabad", lat: 33.6844, lng: 73.0249 },
  { address: "Fatima Jinnah Park, near F-9 gate, Islamabad", area: "F-9, Islamabad", lat: 33.7022, lng: 73.0211 },
  { address: "Jinnah Avenue, Blue Area, Islamabad", area: "Blue Area, Islamabad", lat: 33.7105, lng: 73.0573 },
  { address: "Shakarparian National Park, Islamabad", area: "Shakarparian, Islamabad", lat: 33.6928, lng: 73.0764 },
];

export default function LocationField({ location, setLocation, error }) {
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef(null);

  // Clean up any pending debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handlePinChange = ({ lat, lng }) => {
    // Keep coordinates updated immediately for marker and payload
    setLocation((prev) => ({
      address: prev?.address || "Locating address…",
      area: prev?.area || "Islamabad",
      lat,
      lng,
    }));

    // Debounce reverse geocoding requests to prevent rapid network spamming
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const geo = await reverseGeocode(lat, lng);
        setLocation({
          address: geo.address,
          area: geo.area || "Islamabad",
          lat,
          lng,
        });
      } catch {
        // Fall back to clean coordinates on failure
        setLocation({
          address: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
          area: "Islamabad",
          lat,
          lng,
        });
      }
    }, 400);
  };

  const useMyLocation = () => {
    if (locating) return;
    setLocating(true);

    // Try browser geolocation first
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          try {
            const geo = await reverseGeocode(lat, lng);
            setLocation({
              address: geo.address,
              area: geo.area || "Islamabad",
              lat,
              lng,
            });
          } catch {
            setLocation({
              address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              area: "Islamabad",
              lat,
              lng,
            });
          } finally {
            setLocating(false);
          }
        },
        () => {
          // Fallback to nearby municipal Islamabad spot
          const spot = NEARBY_SPOTS[Math.floor(Math.random() * NEARBY_SPOTS.length)];
          setLocation(spot);
          setLocating(false);
        },
        { timeout: 4000 }
      );
    } else {
      setTimeout(() => {
        const spot = NEARBY_SPOTS[Math.floor(Math.random() * NEARBY_SPOTS.length)];
        setLocation(spot);
        setLocating(false);
      }, 600);
    }
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
                ? {
                    address: e.target.value,
                    area: location?.area || "Islamabad",
                    lat: location?.lat || ISLAMABAD_CENTER.lat,
                    lng: location?.lng || ISLAMABAD_CENTER.lng,
                  }
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
        lat={location?.lat}
        lng={location?.lng}
        onPinChange={handlePinChange}
        className="mt-3 h-44 sm:h-52"
      />
    </div>
  );
}
