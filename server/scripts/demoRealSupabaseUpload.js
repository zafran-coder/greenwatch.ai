import sharp from "sharp";
import { config } from "../src/config.js";
import { SupabaseStorage } from "../src/services/storage/SupabaseStorage.js";
import { processEvidenceImage } from "../src/lib/imageProcessor.js";
import { analyzePhotoEvidence } from "../src/agents/evidenceAgent.js";
import { db } from "../src/db/client.js";

async function runDemo() {
  console.log("===============================================================================");
  console.log("GreenWatch AI — Live Supabase Evidence Upload & Postgres Verification");
  console.log("===============================================================================");
  console.log(`Supabase URL:    ${config.supabase.url}`);
  console.log(`Target Bucket:   ${config.supabase.bucket}`);
  console.log("-------------------------------------------------------------------------------");

  // 1. Instantiate live Supabase storage driver
  const supabaseStorage = new SupabaseStorage();
  if (!supabaseStorage.isAvailable()) {
    throw new Error("SupabaseStorage client could not be initialized");
  }

  // 2. Generate a realistic municipal evidence image buffer (1920x1080 JPEG)
  // Simulating an SVG rendered into JPEG depicting street garbage / civic hazard
  const svgGraphic = `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#bg)"/>
      <circle cx="960" cy="540" r="300" fill="#10b981" opacity="0.2"/>
      <rect x="400" y="300" width="1120" height="480" rx="24" fill="#1e293b" stroke="#334155" stroke-width="4"/>
      <text x="960" y="460" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#f8fafc" text-anchor="middle">
        GreenWatch AI — Evidence Capture
      </text>
      <text x="960" y="540" font-family="Arial, sans-serif" font-size="32" fill="#10b981" text-anchor="middle">
        Municipal Issue: Overflowing Waste Dumpster Block C
      </text>
      <text x="960" y="620" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">
        GPS: 37.7749° N, 122.4194° W · Verified Visual Evidence · High Resolution
      </text>
    </svg>
  `;

  const inputBuffer = await sharp(Buffer.from(svgGraphic))
    .jpeg({ quality: 90 })
    .toBuffer();

  console.log(`[1] Created source evidence photo (${inputBuffer.length} bytes, format: JPEG).`);

  // 3. Process image through civic requirements:
  // magic bytes validation, resize <=1600px, WebP quality 80, 400px thumbnail, random filename
  const targetReportId = "r1"; // Link to existing Seed Report r1 (GW-2041)
  console.log(`[2] Processing through sharp (magic bytes check, auto-rotate, resize <=1600px, WebP q80, 400px thumb)...`);
  const processed = await processEvidenceImage(inputBuffer, { reportId: targetReportId });

  console.log(`    - Magic bytes verified:  ${processed.mimeType}`);
  console.log(`    - Main WebP dimensions: ${processed.main.width}x${processed.main.height}px (${processed.main.size} bytes)`);
  console.log(`    - Thumb dimensions:     ${processed.thumbnail.width}x${processed.thumbnail.height}px (${processed.thumbnail.size} bytes)`);
  console.log(`    - Random safe path:     ${processed.main.path}`);
  console.log(`    - Random thumb path:    ${processed.thumbnail.path}`);

  // 4. Upload main image to live Supabase bucket
  console.log(`[3] Uploading main WebP image to Supabase Storage bucket "${supabaseStorage.bucket}"...`);
  const mainUpload = await supabaseStorage.upload({
    path: processed.main.path,
    buffer: processed.main.buffer,
    contentType: "image/webp",
  });
  console.log(`    ✓ Main upload success! Public URL:`);
  console.log(`      ${mainUpload.url}`);

  // 5. Upload thumbnail to live Supabase bucket
  console.log(`[4] Uploading 400px thumbnail to Supabase Storage bucket "${supabaseStorage.bucket}"...`);
  const thumbUpload = await supabaseStorage.upload({
    path: processed.thumbnail.path,
    buffer: processed.thumbnail.buffer,
    contentType: "image/webp",
  });
  console.log(`    ✓ Thumbnail upload success! Public URL:`);
  console.log(`      ${thumbUpload.url}`);

  // 6. Run Evidence Agent analysis on real image bytes
  console.log(`[5] Running Evidence Agent analysis on processed WebP image...`);
  const evidenceAnalysis = await analyzePhotoEvidence({
    buffer: processed.main.buffer,
    width: processed.main.width,
    height: processed.main.height,
    size: processed.main.size,
    gpsLocation: { lat: 37.774929, lng: -122.419416 },
    description: "Overflowing commercial garbage dumpster blocking pedestrian alleyway.",
  });
  console.log(`    ✓ Evidence Agent output:`, JSON.stringify(evidenceAnalysis, null, 2));

  // 7. Store Photo record in database
  console.log(`[6] Persisting row to Postgres Photo table...`);
  const photoRow = await db.createPhoto({
    reportId: targetReportId,
    path: processed.main.path,
    url: mainUpload.url,
    thumbnailPath: processed.thumbnail.path,
    thumbnailUrl: thumbUpload.url,
    size: processed.main.size,
    width: processed.main.width,
    height: processed.main.height,
    evidenceAnalysis,
    createdAt: new Date().toISOString(),
  });

  console.log("-------------------------------------------------------------------------------");
  console.log("✓ SUPABASE STORAGE & POSTGRES ROW VERIFICATION COMPLETE:");
  console.log(JSON.stringify(photoRow, null, 2));
  console.log("===============================================================================");

  return photoRow;
}

runDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo failed:", err);
    process.exit(1);
  });
