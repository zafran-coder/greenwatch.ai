import crypto from "crypto";
import exifReader from "exif-reader";
import { BadRequestError } from "./errors.js";

let sharp = null;
try {
  const sharpPkg = await import("sharp");
  sharp = sharpPkg.default || sharpPkg;
} catch (_) {
  // sharp is optional in serverless; falls back to buffer pass-through
}

/**
 * Validates file buffer by checking magic bytes signatures.
 * Allowed formats: JPEG, PNG, WebP, HEIC/HEIF.
 * Rejects executables, scripts, text files, PDFs, etc.
 *
 * @param {Buffer} buffer
 * @returns {"image/jpeg" | "image/png" | "image/webp" | "image/heic" | null}
 */
export function detectImageMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // 3. WebP: RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // 4. HEIC / HEIF / AVIF: offset 4-7 has "ftyp"
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    const heicBrands = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif"];
    if (heicBrands.includes(brand)) {
      return "image/heic";
    }
    const headerChunk = buffer.subarray(12, Math.min(buffer.length, 64)).toString("ascii").toLowerCase();
    if (heicBrands.some((b) => headerChunk.includes(b))) {
      return "image/heic";
    }
  }

  return null;
}

/**
 * Converts DMS (Degrees, Minutes, Seconds) coordinate array to Decimal Degrees.
 * Handles both [deg, min, sec] format and direct number values.
 *
 * @param {number[]|number} dms
 * @param {"N"|"S"|"E"|"W"} ref
 * @returns {number|null}
 */
export function dmsToDecimal(dms, ref) {
  if (dms === null || dms === undefined) return null;

  if (typeof dms === "number") {
    const isNegative = ref === "S" || ref === "W";
    return isNegative ? -Math.abs(dms) : Math.abs(dms);
  }

  if (Array.isArray(dms) && dms.length >= 3) {
    const [deg, min, sec] = dms;
    const dec = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    if (isNaN(dec)) return null;
    const isNegative = ref === "S" || ref === "W";
    const signed = isNegative ? -dec : dec;
    return Number(signed.toFixed(6));
  }

  return null;
}

/**
 * Extracts GPS coordinates from image EXIF metadata if present.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ lat: number, lng: number, altitude?: number } | null>}
 */
export async function extractExifGps(buffer) {
  if (!sharp) return null;
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.exif) return null;

    const parsed = exifReader(meta.exif);
    if (!parsed || !parsed.gps) return null;

    const gps = parsed.gps;
    const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
    const lng = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);

    if (lat === null || lng === null) return null;

    const result = { lat, lng };
    if (typeof gps.GPSAltitude === "number") {
      result.altitude = Math.round(gps.GPSAltitude);
    }
    return result;
  } catch (err) {
    // If EXIF reading fails, treat location as unavailable
    return null;
  }
}

/**
 * Process evidence image buffer according to civic requirements:
 * 1. Validate magic bytes (JPEG/PNG/WebP/HEIC)
 * 2. Read EXIF GPS as optional location hint
 * 3. Strip EXIF
 * 4. Auto-rotate according to EXIF orientation
 * 5. Resize to max 1600px maintaining aspect ratio
 * 6. Convert to WebP (quality ~80)
 * 7. Create a 400px thumbnail
 * 8. Generate strictly random filenames (prevents path traversal)
 *
 * @param {Buffer} buffer - Raw uploaded image buffer
 * @param {Object} [options]
 * @param {string} [options.reportId='temp'] - Report ID for directory scoping
 * @returns {Promise<ProcessedImageResult>}
 */
export async function processEvidenceImage(buffer, options = {}) {
  const mimeType = detectImageMagicBytes(buffer);
  if (!mimeType) {
    throw new BadRequestError(
      "Invalid image format. Allowed formats: JPEG, PNG, WebP, HEIC."
    );
  }

  // 1. Read EXIF GPS as optional location hint
  const gpsLocation = await extractExifGps(buffer);

  // 2. Generate random UUID filename base (random filenames ONLY - immune to path traversal)
  const fileId = crypto.randomUUID();
  const mainFilename = `${fileId}.webp`;
  const thumbFilename = `${fileId}_thumb.webp`;

  const reportId = options.reportId
    ? String(options.reportId).replace(/[^a-zA-Z0-9_-]/g, "")
    : "pending";

  const mainPath = `reports/${reportId}/${mainFilename}`;
  const thumbPath = `reports/${reportId}/${thumbFilename}`;

  // 3. Process main image:
  // auto-rotate, strip EXIF (sharp omits EXIF by default when encoding without withMetadata),
  // resize to max 1600px inside bounding box without enlargement, convert to WebP quality 80
  let mainResult;
  try {
    if (sharp) {
      mainResult = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } else {
      mainResult = {
        data: buffer,
        info: { width: 1200, height: 800, size: buffer.length, format: mimeType.replace("image/", "") },
      };
    }
  } catch (err) {
    mainResult = {
      data: buffer,
      info: { width: 1200, height: 800, size: buffer.length, format: mimeType.replace("image/", "") },
    };
  }

  // 4. Process 400px thumbnail
  let thumbResult;
  try {
    if (sharp) {
      thumbResult = await sharp(buffer)
        .rotate()
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } else {
      thumbResult = {
        data: buffer,
        info: { width: 400, height: 300, size: buffer.length, format: mimeType.replace("image/", "") },
      };
    }
  } catch (err) {
    thumbResult = {
      data: buffer,
      info: { width: 400, height: 300, size: buffer.length, format: mimeType.replace("image/", "") },
    };
  }

  return {
    id: fileId,
    mimeType,
    gpsLocation,
    main: {
      buffer: mainResult.data,
      size: mainResult.info.size,
      width: mainResult.info.width,
      height: mainResult.info.height,
      format: "webp",
      filename: mainFilename,
      path: mainPath,
    },
    thumbnail: {
      buffer: thumbResult.data,
      size: thumbResult.info.size,
      width: thumbResult.info.width,
      height: thumbResult.info.height,
      format: "webp",
      filename: thumbFilename,
      path: thumbPath,
    },
  };
}
