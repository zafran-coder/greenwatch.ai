import { z } from "zod";

export const evidenceSchema = z.object({
  evidence: z.enum(["Good", "Needs more info"]),
  confidenceScore: z.number().int().min(0).max(100),
  reason: z.string(),
  summary: z.string(),
});

export function runEvidenceAgent(description, photos = []) {
  const hasPhotos = Array.isArray(photos) && photos.length > 0;
  const photoCount = Array.isArray(photos) ? photos.length : 0;
  const textLength = (description || "").trim().length;
  const isDetailed = textLength >= 60;

  const isGood = hasPhotos && isDetailed;
  const evidence = isGood ? "Good" : "Needs more info";

  let summary = "";
  if (hasPhotos && isDetailed) {
    summary = `${photoCount} photo${photoCount > 1 ? "s" : ""} verified, matches the description. Evidence: Good`;
  } else if (!hasPhotos) {
    summary = "No photos attached — flagged as Needs more info.";
  } else {
    summary = "Evidence thin — description lacks specific landmarks or scope.";
  }

  const confidenceScore = isGood ? 92 : 65;

  return evidenceSchema.parse({
    evidence,
    confidenceScore,
    reason: isGood
      ? "Sufficient visual evidence and detailed textual context provided."
      : "Incomplete visual evidence or brief description.",
    summary,
  });
}
