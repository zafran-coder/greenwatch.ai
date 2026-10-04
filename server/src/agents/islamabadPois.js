/**
 * Configurable Points of Interest (POIs) in Islamabad, Pakistan.
 * Used by the AI Priority Agent to detect critical proximity to schools, hospitals,
 * main roads, and major public parks.
 */

export const ISLAMABAD_POIS = [
  // --- Schools & Educational Institutions ---
  {
    id: "poi-school-bloom",
    name: "Bloomfield Hall School",
    type: "school",
    area: "Bloomfield / F-8",
    lat: 33.7150,
    lng: 73.0600,
    keywords: ["bloom school", "bloomfield", "bloom", "bloom school crossing"],
    riskWeight: "High",
  },
  {
    id: "poi-school-model",
    name: "Islamabad Model School",
    type: "school",
    area: "G-6",
    lat: 33.7050,
    lng: 73.0450,
    keywords: ["islamabad model school", "model school", "government model school"],
    riskWeight: "High",
  },
  {
    id: "poi-school-beacon",
    name: "Beaconhouse School System",
    type: "school",
    area: "F-7",
    lat: 33.7220,
    lng: 73.0550,
    keywords: ["beaconhouse", "beacon house", "beacon school"],
    riskWeight: "High",
  },
  {
    id: "poi-school-froebels",
    name: "Froebel's International School",
    type: "school",
    area: "F-7",
    lat: 33.7280,
    lng: 73.0580,
    keywords: ["froebels", "froebel", "froebel's"],
    riskWeight: "High",
  },
  {
    id: "poi-school-aps",
    name: "Army Public School & College",
    type: "school",
    area: "Islamabad / Rawalpindi Border",
    lat: 33.6000,
    lng: 73.0400,
    keywords: ["army public school", "aps school", "aps"],
    riskWeight: "High",
  },

  // --- Hospitals & Emergency Healthcare Facilities ---
  {
    id: "poi-hosp-pims",
    name: "Pakistan Institute of Medical Sciences (PIMS)",
    type: "hospital",
    area: "G-8 / Sector G",
    lat: 33.7077,
    lng: 73.0537,
    keywords: ["pims", "medical sciences", "pims hospital", "emergency hospital"],
    riskWeight: "High",
  },
  {
    id: "poi-hosp-shifa",
    name: "Shifa International Hospital",
    type: "hospital",
    area: "H-8",
    lat: 33.6780,
    lng: 73.0780,
    keywords: ["shifa", "shifa international", "shifa hospital"],
    riskWeight: "High",
  },
  {
    id: "poi-hosp-polyclinic",
    name: "Federal Government Polyclinic Hospital",
    type: "hospital",
    area: "G-6",
    lat: 33.7200,
    lng: 73.0800,
    keywords: ["polyclinic", "poly clinic", "fgpc", "polyclinic hospital"],
    riskWeight: "High",
  },
  {
    id: "poi-hosp-ali",
    name: "Ali Medical Centre",
    type: "hospital",
    area: "F-8 Markaz",
    lat: 33.7100,
    lng: 73.0380,
    keywords: ["ali medical", "ali medical centre", "ali clinic"],
    riskWeight: "High",
  },

  // --- Arterial Main Roads & Expressways ---
  {
    id: "poi-road-srinagar",
    name: "Srinagar Highway (Kashmir Highway)",
    type: "main_road",
    area: "Central Transit Corridor",
    lat: 33.6844,
    lng: 73.0479,
    keywords: ["srinagar highway", "kashmir highway", "highway", "main road"],
    riskWeight: "High",
  },
  {
    id: "poi-road-expressway",
    name: "Islamabad Expressway",
    type: "main_road",
    area: "Eastern Arterial Highway",
    lat: 33.6500,
    lng: 73.1000,
    keywords: ["islamabad expressway", "expressway", "express way"],
    riskWeight: "High",
  },
  {
    id: "poi-road-jinnah",
    name: "Jinnah Avenue",
    type: "main_road",
    area: "Blue Area",
    lat: 33.7100,
    lng: 73.0600,
    keywords: ["jinnah avenue", "blue area avenue", "jinnah ave"],
    riskWeight: "High",
  },
  {
    id: "poi-road-margalla",
    name: "Margalla Road",
    type: "main_road",
    area: "Northern Sector Perimeter",
    lat: 33.7380,
    lng: 73.0650,
    keywords: ["margalla road", "margalla ave", "margalla"],
    riskWeight: "High",
  },
  {
    id: "poi-road-ijp",
    name: "IJP Road (Karnal Sher Khan Road)",
    type: "main_road",
    area: "I-8 / Border Area",
    lat: 33.6400,
    lng: 73.0600,
    keywords: ["ijp road", "i.j.p. road", "ijp", "karnal sher khan"],
    riskWeight: "High",
  },

  // --- Major Parks & High-Footfall Public Spaces ---
  {
    id: "poi-park-f9",
    name: "Fatima Jinnah Park (F-9 Park)",
    type: "park",
    area: "Sector F-9",
    lat: 33.7020,
    lng: 73.0210,
    keywords: ["f-9 park", "fatima jinnah park", "f9 park", "public park"],
    riskWeight: "Medium",
  },
  {
    id: "poi-park-lakeview",
    name: "Lake View Park",
    type: "park",
    area: "Rawal Lake",
    lat: 33.7120,
    lng: 73.1360,
    keywords: ["lake view park", "lakeview", "rawal lake"],
    riskWeight: "Medium",
  },
];

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in meters
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Find Islamabad POIs located within maxDistanceMeters of coordinates.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [maxDistanceMeters=350]
 * @returns {Array<Object>}
 */
export function findNearbyPois(lat, lng, maxDistanceMeters = 350) {
  if (lat == null || lng == null) return [];
  const results = [];

  for (const poi of ISLAMABAD_POIS) {
    const dist = haversineDistanceMeters(lat, lng, poi.lat, poi.lng);
    if (dist <= maxDistanceMeters) {
      results.push({
        ...poi,
        distanceMeters: dist,
        matchType: "proximity",
      });
    }
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Find POIs referenced directly in description text or address string.
 * @param {string} text
 * @returns {Array<Object>}
 */
export function findMentionedPois(text = "") {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = [];

  for (const poi of ISLAMABAD_POIS) {
    const hasKeyword = poi.keywords.some((kw) => lower.includes(kw.toLowerCase()));
    const hasName = lower.includes(poi.name.toLowerCase());
    if (hasKeyword || hasName) {
      matched.push({
        ...poi,
        matchType: "text_mention",
      });
    }
  }

  return matched;
}

/**
 * Comprehensive evaluation of POI proximity and mentions for a report.
 * @param {Object} location - { lat, lng, address, area }
 * @param {string} description
 * @returns {Object}
 */
export function evaluatePoiRisk(location = {}, description = "") {
  const combinedText = `${location.address || ""} ${location.area || ""} ${description}`.toLowerCase();
  const nearby = findNearbyPois(location.lat, location.lng, 350);
  const mentioned = findMentionedPois(combinedText);

  // Merge unique POIs
  const map = new Map();
  for (const p of [...nearby, ...mentioned]) {
    if (!map.has(p.id)) {
      map.set(p.id, p);
    }
  }
  const allMatches = Array.from(map.values());

  const hasSchool = allMatches.some((p) => p.type === "school") || /school|kindergarten|classroom|children|kids/i.test(combinedText);
  const hasHospital = allMatches.some((p) => p.type === "hospital") || /hospital|clinic|emergency room|patient/i.test(combinedText);
  const hasMainRoad = allMatches.some((p) => p.type === "main_road") || /main road|highway|expressway|avenue|arterial|thoroughfare/i.test(combinedText);
  const hasPark = allMatches.some((p) => p.type === "park") || /public park|playground|recreation area/i.test(combinedText);

  const isSensitive = hasSchool || hasHospital || hasMainRoad || hasPark;
  const triggeredLabels = [];
  if (hasSchool) triggeredLabels.push("School / Children proximity");
  if (hasHospital) triggeredLabels.push("Hospital / Healthcare proximity");
  if (hasMainRoad) triggeredLabels.push("Main road / Arterial traffic hazard");
  if (hasPark) triggeredLabels.push("Public park / Recreational area");

  return {
    isSensitive,
    hasSchool,
    hasHospital,
    hasMainRoad,
    hasPark,
    matchedPois: allMatches,
    triggeredLabels,
  };
}
