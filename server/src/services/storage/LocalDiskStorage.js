import fs from "fs";
import path from "path";
import { StorageDriver } from "./StorageDriver.js";

export class LocalDiskStorage extends StorageDriver {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseDir] - Local directory on disk
   * @param {string} [options.baseUrl='/uploads'] - URL prefix
   */
  constructor(options = {}) {
    super();
    this.baseDir = path.resolve(
      options.baseDir || process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads")
    );
    this.baseUrl = (options.baseUrl || "/uploads").replace(/\/+$/, "");
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _resolveSafePath(filePath) {
    // Strip leading slashes and normalize
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const safePath = path.resolve(this.baseDir, normalized);
    if (!safePath.startsWith(this.baseDir)) {
      throw new Error("Security violation: Path traversal detected");
    }
    return safePath;
  }

  async upload({ path: targetPath, buffer, contentType = "image/webp" }) {
    const cleanPath = targetPath.replace(/^\/+/, "");
    const fullPath = this._resolveSafePath(cleanPath);

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    const url = this.getUrl(cleanPath);
    return {
      path: cleanPath.replace(/\\/g, "/"),
      url,
    };
  }

  async delete(paths) {
    const pathList = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
    for (const p of pathList) {
      try {
        const fullPath = this._resolveSafePath(p.replace(/^\/+/, ""));
        await fs.promises.unlink(fullPath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.warn(`[LocalDiskStorage] Delete error for ${p}:`, err.message);
        }
      }
    }
  }

  getUrl(targetPath) {
    const cleanPath = targetPath.replace(/^\/+/, "").replace(/\\/g, "/");
    return `${this.baseUrl}/${cleanPath}`;
  }

  async getSignedUrl(targetPath, expiresIn = 3600) {
    return this.getUrl(targetPath);
  }

  async getBuffer(targetPath) {
    const fullPath = this._resolveSafePath(targetPath.replace(/^\/+/, ""));
    return fs.promises.readFile(fullPath);
  }

  async exists(targetPath) {
    try {
      const fullPath = this._resolveSafePath(targetPath.replace(/^\/+/, ""));
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
