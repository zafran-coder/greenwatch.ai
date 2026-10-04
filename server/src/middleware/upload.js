import multer from "multer";
import { BadRequestError } from "../lib/errors.js";
import { detectImageMagicBytes } from "../lib/imageProcessor.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 4;

const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PHOTOS,
  },
});

/**
 * Handle multipart errors (file size limit, count limit) and convert to clean BadRequestError.
 */
function handleMulterErrors(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new BadRequestError("File size exceeds 5MB limit. Please upload images under 5MB each.")
      );
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new BadRequestError("Maximum 4 photos allowed per upload.")
      );
    }
    return next(new BadRequestError(`Upload error: ${err.message}`));
  }

  return next(err);
}

/**
 * Validates that all uploaded files in req.files have valid image magic bytes.
 */
export function validateMagicBytesMiddleware(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);

  if (files.length > MAX_PHOTOS) {
    return next(new BadRequestError("Maximum 4 photos allowed per upload."));
  }

  for (const file of files) {
    const detected = detectImageMagicBytes(file.buffer);
    if (!detected) {
      return next(
        new BadRequestError(
          `Invalid image format for file "${file.originalname || "upload"}". Allowed formats: JPEG, PNG, WebP, HEIC.`
        )
      );
    }
    file.detectedMimeType = detected;
  }

  next();
}

/**
 * Middleware for POST /api/reports/:id/photos
 * Accepts multipart form with max 4 files on 'photos' or 'photo' or 'files'.
 */
export const uploadPhotosMiddleware = [
  (req, res, next) => {
    multerUpload.fields([
      { name: "photos", maxCount: MAX_PHOTOS },
      { name: "photo", maxCount: MAX_PHOTOS },
      { name: "files", maxCount: MAX_PHOTOS },
      { name: "file", maxCount: MAX_PHOTOS },
    ])(req, res, (err) => {
      if (err) return handleMulterErrors(err, req, res, next);

      // Consolidate files from all accepted field names into req.uploadedFiles array
      const files = [];
      if (req.files) {
        for (const field of ["photos", "photo", "files", "file"]) {
          if (Array.isArray(req.files[field])) {
            files.push(...req.files[field]);
          }
        }
      }
      if (req.file) {
        files.push(req.file);
      }

      req.uploadedFiles = files;
      req.files = files; // Standardize req.files as array

      if (files.length === 0) {
        return next(new BadRequestError("No photos provided in upload request."));
      }

      if (files.length > MAX_PHOTOS) {
        return next(new BadRequestError("Maximum 4 photos allowed per upload."));
      }

      next();
    });
  },
  validateMagicBytesMiddleware,
];

/**
 * Middleware for report creation (POST /api/reports) which accepts EITHER
 * JSON payload OR multipart/form-data with photos and form fields.
 */
export const optionalReportUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  multerUpload.fields([
    { name: "photos", maxCount: MAX_PHOTOS },
    { name: "photo", maxCount: MAX_PHOTOS },
    { name: "files", maxCount: MAX_PHOTOS },
    { name: "file", maxCount: MAX_PHOTOS },
  ])(req, res, (err) => {
    if (err) return handleMulterErrors(err, req, res, next);

    const files = [];
    if (req.files) {
      for (const field of ["photos", "photo", "files", "file"]) {
        if (Array.isArray(req.files[field])) {
          files.push(...req.files[field]);
        }
      }
    }
    if (req.file) {
      files.push(req.file);
    }
    req.uploadedFiles = files;
    req.files = files;

    // Normalize multipart body fields for Zod validation:
    // 1. If location is a JSON string (e.g. from frontend form), parse it
    if (typeof req.body.location === "string") {
      try {
        req.body.location = JSON.parse(req.body.location);
      } catch (e) {
        // Leave as string if not valid JSON
      }
    }
    // 2. Handle nested location fields (location[address], location.address, etc.)
    if (!req.body.location || typeof req.body.location !== "object") {
      const address = req.body["location[address]"] || req.body["location.address"] || req.body.address;
      const area = req.body["location[area]"] || req.body["location.area"] || req.body.area;
      const lat = req.body["location[lat]"] || req.body["location.lat"] || req.body.lat;
      const lng = req.body["location[lng]"] || req.body["location.lng"] || req.body.lng;

      if (address) {
        req.body.location = {
          address: String(address),
          area: area ? String(area) : "Reported via app",
          lat: lat !== undefined && lat !== "" ? Number(lat) : null,
          lng: lng !== undefined && lng !== "" ? Number(lng) : null,
        };
      }
    }

    // Validate magic bytes for any attached photos
    if (files.length > 0) {
      return validateMagicBytesMiddleware(req, res, next);
    }

    next();
  });
};
