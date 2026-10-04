/**
 * GreenWatch AI — OpenStreetMap Nominatim Reverse-Geocoding Service
 *
 * Requirements:
 * 1. Centered on Islamabad (default fallback coordinates: 33.6844, 73.0479)
 * 2. Strict Rate Limiting: Max 1 request / second adhering to OSM Nominatim policy
 * 3. Cache: In-memory store keyed by rounded coordinates to prevent redundant network hits
 * 4. Proper User-Agent: Custom identified User-Agent + contact email query parameter
 * 5. Fallback: Automatically falls back to formatted coordinates on any network or parsing failure
 */

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "GreenWatch-AI/1.0 (Civic Incident Reporter; support@greenwatch.ai)";
const CONTACT_EMAIL = "support@greenwatch.ai";

// Default Islamabad center coordinates
export const ISLAMABAD_CENTER = {
  lat: 33.6844,
  lng: 73.0479,
  address: "Islamabad, Pakistan",
  area: "Islamabad",
};

// In-memory cache for coordinates (~1.1 meter precision rounding)
const geocodeCache = new Map();

function buildCacheKey(lat, lng) {
  const roundedLat = Number(lat).toFixed(5);
  const roundedLng = Number(lng).toFixed(5);
  return `${roundedLat},${roundedLng}`;
}

// Queue for enforcing strictly <= 1 request / second (1050ms safety buffer)
let lastRequestTime = 0;
let queueTail = Promise.resolve();

async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitMs = Math.max(0, 1050 - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestTime = Date.now();
}

/**
 * Format raw Nominatim response into a clean civic address
 */
export function formatAddressFromNominatim(data, lat, lng) {
  if (!data || data.error) {
    return {
      address: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      area: "Islamabad",
      lat,
      lng,
      isFallback: true,
    };
  }

  const addr = data.address || {};
  // Common Islamabad sector and area subdivisions
  const area =
    addr.suburb ||
    addr.neighbourhood ||
    addr.city_district ||
    addr.residential ||
    addr.quarter ||
    addr.city ||
    "Islamabad";

  const components = [];

  // 1. Specific landmark / venue / amenity if present
  const poi = addr.amenity || addr.building || addr.shop || addr.tourism || addr.leisure;
  if (poi) components.push(poi);

  // 2. Road or avenue
  if (addr.road) components.push(addr.road);

  // 3. Suburb / sector (e.g. F-8/4, G-9 Markaz, Blue Area)
  if (addr.suburb && !components.includes(addr.suburb)) {
    components.push(addr.suburb);
  } else if (addr.neighbourhood && !components.includes(addr.neighbourhood)) {
    components.push(addr.neighbourhood);
  }

  // 4. City
  if (addr.city && !components.includes(addr.city)) {
    components.push(addr.city);
  }

  let formatted = components.join(", ");

  // Fallback to display_name truncated or coordinates
  if (!formatted) {
    if (data.display_name) {
      formatted = data.display_name.split(",").slice(0, 3).join(", ").trim();
    } else {
      formatted = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    }
  }

  return {
    address: formatted,
    area,
    lat,
    lng,
    displayName: data.display_name,
    isFallback: false,
  };
}

/**
 * Reverse-geocode a latitude and longitude into an address string using Nominatim.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{address: string, area: string, lat: number, lng: number, isFallback: boolean}>}
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return {
      address: ISLAMABAD_CENTER.address,
      area: ISLAMABAD_CENTER.area,
      lat: ISLAMABAD_CENTER.lat,
      lng: ISLAMABAD_CENTER.lng,
      isFallback: true,
    };
  }

  const cacheKey = buildCacheKey(lat, lng);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Schedule network request respecting rate limit
  const fetchOperation = async () => {
    await enforceRateLimit();

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      addressdetails: "1",
      "accept-language": "en",
      email: CONTACT_EMAIL,
    });

    const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;

    const headers = {
      Accept: "application/json",
    };

    // Include custom User-Agent identifying the app (safe in fetch)
    try {
      headers["User-Agent"] = USER_AGENT;
    } catch {
      // Ignored if browser strictly prohibits header mutation
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Nominatim returned status ${response.status}`);
      }

      const json = await response.json();
      const formatted = formatAddressFromNominatim(json, lat, lng);
      geocodeCache.set(cacheKey, formatted);
      return formatted;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Chain behind the sequential queue to prevent overlapping requests
  queueTail = queueTail.then(fetchOperation, fetchOperation);

  try {
    return await queueTail;
  } catch (err) {
    console.warn("[Nominatim] Reverse geocoding failed, falling back to coordinates:", err?.message);
    const fallback = {
      address: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      area: "Islamabad",
      lat,
      lng,
      isFallback: true,
    };
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}
