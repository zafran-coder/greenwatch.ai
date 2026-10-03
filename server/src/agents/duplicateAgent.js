import { z } from "zod";

export const duplicateSchema = z.object({
  similarCount: z.number().int().min(0),
  similarIds: z.array(z.string()),
  isDuplicate: z.boolean(),
  summary: z.string(),
});

export function runDuplicateAgent(category, location, existingReports = []) {
  const openReports = (existingReports || []).filter(
    (r) => r.status !== "Resolved" && r.category === category
  );

  const locText = `${location?.address || ""} ${location?.area || ""}`.toLowerCase();

  const matches = openReports.filter((r) => {
    const rLoc = `${r.location?.address || ""} ${r.location?.area || ""}`.toLowerCase();
    // Check area match or address keyword overlap
    if (location?.area && r.location?.area && location.area.toLowerCase() === r.location.area.toLowerCase()) {
      return true;
    }
    // Simple spatial proximity if lat/lng are present
    if (
      location?.lat != null &&
      location?.lng != null &&
      r.location?.lat != null &&
      r.location?.lng != null
    ) {
      const dLat = Math.abs(location.lat - r.location.lat);
      const dLng = Math.abs(location.lng - r.location.lng);
      if (dLat < 0.01 && dLng < 0.01) return true; // ~1km
    }
    return locText && rLoc && (locText.includes(rLoc) || rLoc.includes(locText));
  });

  const count = matches.length;
  const similarIds = matches.slice(0, 3).map((r) => r.id);

  let summary = "";
  if (count > 0) {
    summary = `${count} similar report${count > 1 ? "s" : ""} found in this area. Linked, not merged.`;
  } else {
    summary = "Scanned recent reports · no duplicates found nearby.";
  }

  return duplicateSchema.parse({
    similarCount: count,
    similarIds,
    isDuplicate: count > 0,
    summary,
  });
}
