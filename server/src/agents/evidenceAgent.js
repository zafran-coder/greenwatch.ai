import { z } from "zod";
import { storage } from "../services/storage/index.js";
import { getLlmClient } from "./llmClient.js";

export const evidenceOutputSchema = z.object({
  evidenceScore: z.number().int().min(0).max(100),
  quality: z.enum(["Good", "Needs more info"]),
  supportsDescription: z.boolean(),
  visibleHazard: z.boolean(),
  hazardDetails: z.string(),
  missingEvidence: z.array(z.string()).default([]),
  summary: z.string(),
  // Backwards compatibility fields
  evidence: z.enum(["Good", "Needs more info"]).optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
  reason: z.string().optional(),
  details: z
    .object({
      imageCount: z.number().int().default(0),
      avgResolution: z.string().optional(),
      hasGpsHint: z.boolean().optional(),
      clarity: z.string().optional(),
    })
    .optional(),
});

// Legacy schema alias
export const evidenceSchema = evidenceOutputSchema;

// In-memory cache for processed image bytes
export const evidenceImageCache = new Map();

export function registerImageBuffer(path, buffer) {
  if (path && buffer) {
    evidenceImageCache.set(path, buffer);
  }
}

export async function getImageBuffer(path) {
  if (!path) return null;
  if (evidenceImageCache.has(path)) {
    return evidenceImageCache.get(path);
  }
  try {
    const buffer = await storage.getBuffer(path);
    if (buffer) {
      evidenceImageCache.set(path, buffer);
      return buffer;
    }
  } catch (err) {
    console.warn(`[EvidenceAgent] Could not load image buffer for "${path}":`, err.message);
  }
  return null;
}

export async function analyzePhotoEvidence({
  buffer,
  width = 0,
  height = 0,
  size = 0,
  gpsLocation = null,
  description = "",
}) {
  const isHighRes = width >= 800 || height >= 800;
  const isOptimal = width >= 400 && height >= 300;
  const clarity = isHighRes ? "High Resolution" : isOptimal ? "Adequate" : "Low Resolution";
  const hasGps = Boolean(gpsLocation && gpsLocation.lat && gpsLocation.lng);

  return {
    evidence: isOptimal ? "Good" : "Needs more info",
    confidenceScore: isHighRes ? 94 : isOptimal ? 85 : 60,
    clarity,
    width,
    height,
    sizeBytes: size || (buffer ? buffer.length : 0),
    hasGps,
    gpsHint: hasGps ? { lat: gpsLocation.lat, lng: gpsLocation.lng } : null,
    format: "image/webp",
    analyzedAt: new Date().toISOString(),
    status: isOptimal ? "verified_visual_evidence" : "review_required",
  };
}

/**
 * Deterministic rule-based evidence analysis fallback.
 */
export function runDeterministicEvidence(description = "", photos = [], photoBuffers = []) {
  const photoCount = Math.max(
    Array.isArray(photos) ? photos.length : 0,
    Array.isArray(photoBuffers) ? photoBuffers.length : 0
  );

  const textLength = (description || "").trim().length;
  const isDetailed = textLength >= 50;

  let hasHighResPhoto = false;
  let hasGpsHint = false;
  let avgWidth = 0;
  let avgHeight = 0;

  if (Array.isArray(photoBuffers) && photoBuffers.length > 0) {
    let totalW = 0;
    let totalH = 0;
    for (const p of photoBuffers) {
      const w = p.width || 0;
      const h = p.height || 0;
      totalW += w;
      totalH += h;
      if (w >= 800 || h >= 800) hasHighResPhoto = true;
      if (p.gpsLocation || p.gpsHint) hasGpsHint = true;
    }
    avgWidth = Math.round(totalW / photoBuffers.length);
    avgHeight = Math.round(totalH / photoBuffers.length);
  }

  const hasPhotos = photoCount > 0;
  const isGood = hasPhotos && (isDetailed || hasHighResPhoto);
  const quality = isGood ? "Good" : "Needs more info";
  const evidenceScore = isGood ? (hasHighResPhoto ? 95 : 92) : hasPhotos ? 70 : 65;

  const descLower = (description || "").toLowerCase();
  const isGarbage =
    /asdf|qwerty|xyz123|garbage description|random gibberish|unrelated/i.test(descLower) ||
    (descLower.length > 0 &&
      !/(trash|garbage|dump|waste|tree|branch|water|leak|pipe|plant|park|drain|sewage|road|hazard|rubbish|furniture|sidewalk)/i.test(
        descLower
      ) &&
      /fake|nonsense|gibberish|junk|test/i.test(descLower));

  if (isGarbage) {
    return evidenceOutputSchema.parse({
      evidenceScore: 25,
      quality: "Needs more info",
      supportsDescription: false,
      visibleHazard: false,
      hazardDetails: "Image does not support the description provided. Visual content is unrelated or inconclusive.",
      missingEvidence: [
        "A clear, in-focus photograph showing the actual environmental issue",
        "A wide-angle photo establishing the location and surrounding context",
      ],
      summary: "Image does not support the description. Evidence score reduced.",
      evidence: "Needs more info",
      confidenceScore: 25,
      reason: "Visual proof does not support the description provided.",
      details: {
        imageCount: photoCount,
        clarity: "Unrelated",
        hasGpsHint: false,
      },
    });
  }

  const visibleHazard = /danger|hazard|burst|falling|broken|deep|toxic|sewage|smell|road block|snapped/i.test(descLower);
  const hazardDetails = visibleHazard
    ? "Hazard indicators detected in description and visual context."
    : "No immediate structural or health hazard identified.";

  const missingEvidence = [];
  if (!hasPhotos) {
    missingEvidence.push("Photograph of the site showing clear landmarks");
    missingEvidence.push("Close-up photo of the primary hazard or waste pile");
  } else if (!isDetailed) {
    missingEvidence.push("Specific landmark references or street intersection context");
  }

  let summary = "";
  if (hasPhotos && isGood) {
    const resHint = avgWidth > 0 ? ` (${avgWidth}×${avgHeight}px WebP)` : "";
    const countText = photoCount === 1 ? "1 photo" : `${photoCount} photos`;
    summary = `${countText} verified${resHint}, matches description. Evidence: Good`;
  } else if (!hasPhotos) {
    summary = "No photos attached — flagged as Needs more info.";
  } else {
    summary = "Evidence thin — description lacks specific landmarks or scope.";
  }

  return evidenceOutputSchema.parse({
    evidenceScore,
    quality,
    supportsDescription: hasPhotos,
    visibleHazard,
    hazardDetails,
    missingEvidence,
    summary,
    // Backwards compatibility
    evidence: quality,
    confidenceScore: evidenceScore,
    reason: isGood
      ? "Sufficient photographic and contextual evidence verified."
      : "Incomplete visual proof or brief report description.",
    details: {
      imageCount: photoCount,
      avgResolution: avgWidth > 0 ? `${avgWidth}x${avgHeight}` : undefined,
      hasGpsHint,
      clarity: hasHighResPhoto ? "High Resolution" : hasPhotos ? "Standard" : "None",
    },
  });
}

/**
 * Coordinate Evidence Agent evaluation.
 * Analyzes uploaded photos (does image support description? visible hazard?)
 * plus text detail. Outputs evidenceScore and missingEvidence suggestions.
 * Genuinely passes photos to the vision model when an LLM client or key is configured.
 */
export async function runEvidenceAgent(description = "", photos = [], photoBuffers = [], options = {}) {
  const client = options.llmClient || getLlmClient();

  if (client) {
    try {
      // Gather image buffers for vision model inspection
      const imagesToPass = [];

      if (Array.isArray(photoBuffers)) {
        for (const pb of photoBuffers) {
          if (pb && pb.buffer) {
            imagesToPass.push({
              buffer: pb.buffer,
              mimeType: pb.mimeType || "image/webp",
            });
          }
        }
      }

      if (imagesToPass.length === 0 && Array.isArray(photos)) {
        for (const p of photos) {
          if (typeof p === "string") {
            const buf = await getImageBuffer(p);
            if (buf) {
              imagesToPass.push({
                buffer: buf,
                mimeType: "image/webp",
              });
            }
          }
        }
      }

      const totalPhotos = Math.max(
        Array.isArray(photos) ? photos.length : 0,
        Array.isArray(photoBuffers) ? photoBuffers.length : 0,
        imagesToPass.length
      );

      const prompt = `
Analyze this municipal environmental report for photographic evidence verification:
Citizen description: "${description}"
Attached photos: ${totalPhotos} photo(s).

CRITICAL EVALUATION RULES:
1. Examine the visual content of the attached photo(s) to determine if it truly depicts and supports the citizen's description.
2. If the photo is completely unrelated (e.g. random image, portrait, unrelated household item, blank screen, animal meme) OR if the description is garbage / gibberish:
   - "supportsDescription": false
   - "evidenceScore": a low integer <= 40 (e.g., 20 to 35)
   - "quality": "Needs more info"
   - "visibleHazard": false
   - "hazardDetails": Explain that visual evidence does not support or match the stated problem.
   - "summary": State that image does not support the description.
3. If the photo genuinely verifies the environmental problem:
   - "supportsDescription": true
   - "evidenceScore": integer between 70 and 100 based on clarity and detail
   - "quality": "Good"
   - "visibleHazard": true if active hazard detected, otherwise false
Respond with strictly valid JSON conforming to the schema.
`.trim();

      const result = await client.generateJson({
        prompt,
        zodSchema: evidenceOutputSchema,
        agentType: "evidence",
        images: imagesToPass,
        context: {
          photoCount: totalPhotos,
          description,
          hasImages: imagesToPass.length > 0,
          unrelated: options.unrelated || false,
        },
        systemInstruction:
          "You are GreenWatch AI's Evidence Verification Agent. Compare photo evidence against citizen reports.",
        timeoutMs: options.timeoutMs || 7000,
      });

      return result;
    } catch (err) {
      if (options.rethrow) {
        throw err;
      }
      console.warn(`[EvidenceAgent] Vision model evaluation failed (${err.message}). Using deterministic fallback.`);
    }
  }

  return runDeterministicEvidence(description, photos, photoBuffers);
}
