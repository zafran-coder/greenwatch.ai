import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon, MapPin } from "lucide-react";

// Fix the default Leaflet marker icon bug with Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

// Default center on Islamabad, Pakistan
export const ISLAMABAD_CENTER = [33.6844, 73.0479];
export const DEFAULT_ZOOM = 13;

/**
 * Helper component: listens for clicks on the map to place or move the pin
 */
function MapClickHandler({ onPinChange }) {
  useMapEvents({
    click(e) {
      if (onPinChange) {
        onPinChange({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
}

/**
 * Helper component: re-centers the map when coordinates change externally
 */
function MapRecenter({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const current = map.getCenter();
      const distance = Math.hypot(current.lat - lat, current.lng - lng);
      // Smoothly pan if within reasonable distance, otherwise jump
      if (distance > 0.0001) {
        map.setView([lat, lng], map.getZoom(), { animate: true });
      }
    }
  }, [lat, lng, map]);

  return null;
}

/**
 * Helper component: invalidates map container size on mount to ensure tiles fill properly
 */
function MapResizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

/**
 * Interactive OpenStreetMap component using react-leaflet.
 * Centered on Islamabad, with identical dimensions, borders, and pin-to-click/drag behavior.
 */
export default function MapPlaceholder({
  address,
  lat,
  lng,
  onPinChange,
  className = "",
}) {
  const hasCoordinates =
    lat != null && lng != null && !isNaN(lat) && !isNaN(lng);

  // Determine current active marker coordinates
  const markerPosition = hasCoordinates
    ? [Number(lat), Number(lng)]
    : ISLAMABAD_CENTER;

  // Draggable marker handlers
  const markerEventHandlers = useMemo(
    () => ({
      dragend(e) {
        if (onPinChange) {
          const marker = e.target;
          const pos = marker.getLatLng();
          onPinChange({
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          });
        }
      },
    }),
    [onPinChange]
  );

  return (
    <div
      className={`relative select-none overflow-hidden rounded-xl border border-slate-200 bg-[#ECF3ED] ${className}`}
      aria-label="Map preview — click or drag marker to set coordinates"
    >
      <MapContainer
        center={markerPosition}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
        style={{ height: "100%", width: "100%" }}
      >
        {/* OpenStreetMap TileLayer with visible OSM Attribution */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Marker with drag support and fixed default icon */}
        <Marker
          position={markerPosition}
          draggable={Boolean(onPinChange)}
          eventHandlers={markerEventHandlers}
        />

        {/* Map interaction helpers */}
        {onPinChange && <MapClickHandler onPinChange={onPinChange} />}
        <MapRecenter lat={hasCoordinates ? lat : null} lng={hasCoordinates ? lng : null} />
        <MapResizeInvalidator />
      </MapContainer>

      {/* Top-left badge: Map preview indicator */}
      <span className="pointer-events-none absolute left-2.5 top-2.5 z-[1000] flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
        <MapIcon className="size-3 text-green-600" />
        Map preview
      </span>

      {/* Bottom-left badge: Address preview (constrained to ensure OSM attribution at bottom-right is unobstructed) */}
      {address && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[1000] flex max-w-[calc(100%-140px)] items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm sm:max-w-xs">
          <MapPin className="size-3.5 shrink-0 text-green-600" />
          <span className="truncate">{address}</span>
        </div>
      )}
    </div>
  );
}
