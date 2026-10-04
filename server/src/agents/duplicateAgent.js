import { z } from "zod";
import { haversineDistanceMeters, computeCosineSimilarity } from "./similarity.js";

export const duplicateScoreSchema = z.object({
  id: z.string(),
  ref: z.string(),
  distanceMeters: z.number(),
  textSimilarity: z.number(),
  combinedScore: z.number(),
});

export const duplicateOutputSchema = z.object({
  count: z.number().int().min(0),
  ids: z.array(z.string()),
  scores: z.array(duplicateScoreSchema),
  isDuplicate: z.boolean(),
  summary: z.string(),
  // Backwards compatibility aliases
  similarCount: z.number().int().min(0).optional(),
  similarIds: z.array(z.string()).optional(),
});

// Legacy schema alias
export const duplicateSchema = duplicateOutputSchema;

const RELATED_CATEGORIES = {
  garbage: ["garbage", "park"],
  park: ["park", "garbage"],
  tree: ["tree", "plants"],
  plants: ["plants", "tree"],
  water: ["water"],
  blocked: ["blocked"],
};

/**
 * Duplicate Detection Agent
 * Scans open reports within ~150m (haversine) in the same/related category in the last 30 days.
 * Ranked by text similarity (TF-IDF cosine).
 * Above threshold -> DuplicateLink and cross-reference.
 * NEVER auto-merges or deletes.
 *
 * @param {string} category
 * @param {Object} location - { lat, lng, address, area }
 * @param {string} description
 * @param {Array<Object>} existingReports
 * @returns {z.infer<typeof duplicateOutputSchema>}
 */
export function runDuplicateAgent(category, location = {}, description = "", existingReports = []) {
  // If called with old signature: runDuplicateAgent(category, location, existingReports)
  let candidateReports = existingReports;
  let reportText = description;
  if (Array.isArray(description) && existingReports.length === 0) {
    candidateReports = description;
    reportText = "";
  }

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const relatedCats = RELATED_CATEGORIES[category] || [category];

  // Filter open reports from last 30 days in same/related category
  const activeReports = (candidateReports || []).filter((r) => {
    if (r.status === "Resolved") return false;

    // Check category match
    const isCatMatch = relatedCats.includes(r.category);
    if (!isCatMatch) return false;

    // Check 30-day window if createdAt exists
    if (r.createdAt) {
      const createdTime = new Date(r.createdAt).getTime();
      if (!isNaN(createdTime) && now - createdTime > THIRTY_DAYS_MS) {
        return false;
      }
    }
    return true;
  });

  const scoredMatches = [];

  const locLat = location?.lat != null ? Number(location.lat) : null;
  const locLng = location?.lng != null ? Number(location.lng) : null;
  const locArea = (location?.area || "").trim().toLowerCase();
  const locAddress = (location?.address || "").trim().toLowerCase();

  for (const report of activeReports) {
    const rLat = report.lat ?? report.location?.lat ?? null;
    const rLng = report.lng ?? report.location?.lng ?? null;
    const rArea = (report.area || report.location?.area || "").trim().toLowerCase();
    const rAddress = (report.address || report.location?.address || "").trim().toLowerCase();
    const rText = report.description || "";

    let distMeters = Infinity;
    let isWithinRadius = false;

    if (locLat != null && locLng != null && rLat != null && rLng != null) {
      distMeters = haversineDistanceMeters(locLat, locLng, Number(rLat), Number(rLng));
      // Within ~150m radius (with 10% tolerance = 165m)
      if (distMeters <= 165) {
        isWithinRadius = true;
      }
    } else {
      // Fallback to area and address keyword match if coordinates unavailable
      const areaMatches = locArea && rArea && (locArea === rArea || locArea.includes(rArea) || rArea.includes(locArea));
      const addrMatches = locAddress && rAddress && (locAddress.includes(rAddress) || rAddress.includes(locAddress));
      if (areaMatches || addrMatches) {
        isWithinRadius = true;
        distMeters = 75; // Imputed proximate distance
      }
    }

    if (!isWithinRadius) {
      continue;
    }

    // Compute TF-IDF Cosine Similarity between descriptions
    const hasDescriptions = Boolean(reportText && reportText.trim() && rText && rText.trim());
    const textSim = hasDescriptions
      ? computeCosineSimilarity(reportText, rText)
      : (locArea && rArea && locArea === rArea ? 0.75 : 0.5);

    // Distance score: closer -> higher
    const distanceScore = distMeters < Infinity ? Math.max(0, 1 - distMeters / 150) : 0.5;

    // Combined score: 65% text similarity, 35% spatial proximity
    const combinedScore = Math.round((textSim * 0.65 + distanceScore * 0.35) * 100) / 100;

    // Threshold for duplicate link: textSimilarity >= 0.30 or combinedScore >= 0.45 (or identical location)
    if (
      textSim >= 0.30 ||
      combinedScore >= 0.40 ||
      (distMeters <= 50 && textSim >= 0.20) ||
      (distMeters === 75 && textSim >= 0.25) ||
      (!hasDescriptions && isWithinRadius)
    ) {
      scoredMatches.push({
        id: report.id,
        ref: report.ref || report.id,
        distanceMeters: distMeters === Infinity ? 0 : distMeters,
        textSimilarity: textSim,
        combinedScore,
      });
    }
  }

  // Rank by highest similarity score
  scoredMatches.sort((a, b) => b.combinedScore - a.combinedScore);

  const count = scoredMatches.length;
  const ids = scoredMatches.map((m) => m.id);

  let summary = "";
  if (count > 0) {
    summary = `${count} similar report${count > 1 ? "s" : ""} detected within ~150m in this category. Linked for cross-reference (never auto-merged).`;
  } else {
    summary = "Scanned open reports within 150m · no duplicates detected.";
  }

  return duplicateOutputSchema.parse({
    count,
    ids,
    scores: scoredMatches,
    isDuplicate: count > 0,
    summary,
    // Backwards compatibility
    similarCount: count,
    similarIds: ids.slice(0, 3),
  });
}
