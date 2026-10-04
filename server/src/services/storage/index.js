import { StorageDriver } from "./StorageDriver.js";
import { SupabaseStorage } from "./SupabaseStorage.js";
import { LocalDiskStorage } from "./LocalDiskStorage.js";

export { StorageDriver, SupabaseStorage, LocalDiskStorage };

let activeDriver = null;

export function initializeStorageDriver() {
  const driverType = (process.env.STORAGE_DRIVER || "supabase").toLowerCase();

  if (driverType === "local" || driverType === "disk") {
    activeDriver = new LocalDiskStorage();
    return activeDriver;
  }

  // Default: SupabaseStorage
  try {
    const supabaseDriver = new SupabaseStorage();
    if (supabaseDriver.isAvailable()) {
      activeDriver = supabaseDriver;
      return activeDriver;
    }
  } catch (err) {
    console.warn("[Storage] Failed to initialize SupabaseStorage, falling back to LocalDiskStorage:", err.message);
  }

  activeDriver = new LocalDiskStorage();
  return activeDriver;
}

export function getStorageDriver() {
  if (!activeDriver) {
    initializeStorageDriver();
  }
  return activeDriver;
}

export function setStorageDriver(driver) {
  activeDriver = driver;
  return activeDriver;
}

export const storage = {
  upload: (params) => getStorageDriver().upload(params),
  delete: (paths) => getStorageDriver().delete(paths),
  getUrl: (path) => getStorageDriver().getUrl(path),
  getSignedUrl: (path, expiresIn) => getStorageDriver().getSignedUrl(path, expiresIn),
  getBuffer: (path) => getStorageDriver().getBuffer(path),
  exists: (path) => getStorageDriver().exists(path),
  get driver() {
    return getStorageDriver();
  },
};

/**
 * Extracts relative storage path from a full URL or storage path string.
 */
export function extractStoragePath(urlOrPath, bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidence") {
  if (!urlOrPath) return "";
  const str = String(urlOrPath).trim();
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    return str.replace(/^\/+/, "").replace(/^uploads\//, "");
  }
  const match = str.match(new RegExp(`/${bucket}/([^?#]+)`));
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return "";
}

/**
 * Resolves a storage path or potentially expired/public URL to a fresh signed URL.
 */
export async function resolvePhotoUrl(urlOrPath, expiresIn = 3600) {
  if (!urlOrPath) return "";
  const str = String(urlOrPath).trim();
  if (str.startsWith("data:") || str.startsWith("/src/assets/") || str.startsWith("/uploads/")) {
    return str;
  }
  const driver = getStorageDriver();
  const path = extractStoragePath(str);
  if (path && typeof driver.getSignedUrl === "function") {
    try {
      const signed = await driver.getSignedUrl(path, expiresIn);
      if (signed) return signed;
    } catch {
      // Fallback
    }
  }
  return str;
}

/**
 * Resolves an array of photo URLs to fresh signed URLs.
 */
export async function resolvePhotoUrls(urls, expiresIn = 3600) {
  if (!Array.isArray(urls)) return [];
  return Promise.all(urls.map((u) => resolvePhotoUrl(u, expiresIn)));
}

