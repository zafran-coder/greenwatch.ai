import { createClient } from "@supabase/supabase-js";
import { config } from "../../config.js";
import { StorageDriver } from "./StorageDriver.js";

export class SupabaseStorage extends StorageDriver {
  /**
   * @param {Object} [options]
   * @param {string} [options.url]
   * @param {string} [options.key]
   * @param {string} [options.bucket='evidence']
   */
  constructor(options = {}) {
    super();
    this.url = config.supabase.url || options.url || process.env.SUPABASE_URL || "https://kbrwjxonrllfysjorzvz.supabase.co";
    // Server-side service-role key prioritized for backend storage operations
    const rawKey =
      options.key ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      config.supabase.serviceRoleKey ||
      process.env.SUPABASE_ANON_KEY ||
      config.supabase.anonKey;
    this.key = typeof rawKey === "string" ? rawKey.trim().replace(/^["']|["']$/g, "").trim() : null;
    this.bucket = options.bucket || process.env.SUPABASE_STORAGE_BUCKET || "evidence";

    if (this.url && this.key) {
      try {
        this.client = createClient(this.url, this.key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } catch (err) {
        console.warn("[SupabaseStorage createClient warning]:", err.message);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  isAvailable() {
    return Boolean(this.client);
  }

  async upload({ path, buffer, contentType = "image/webp" }) {
    if (!this.client) {
      throw new Error("SupabaseStorage client is not configured");
    }

    const cleanPath = path.replace(/^\/+/, "");
    
    // Convert Buffer to Blob for Vercel/Node native fetch compatibility
    // Native fetch handles Blobs correctly without 'duplex' issues
    const blob = new Blob([buffer], { type: contentType });

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(cleanPath, blob, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const signedUrl = await this.getSignedUrl(cleanPath, 86400); // 24h signed URL
    const url = signedUrl || (await this.getUrl(cleanPath));
    return {
      path: cleanPath,
      url,
    };
  }

  async getSignedUrl(path, expiresIn = 3600) {
    if (!this.client) return "";
    const cleanPath = path.replace(/^\/+/, "");
    try {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .createSignedUrl(cleanPath, expiresIn);
      if (error) {
        console.warn(`[SupabaseStorage] getSignedUrl notice for ${cleanPath}:`, error.message);
        return "";
      }
      return data?.signedUrl || "";
    } catch (err) {
      console.warn(`[SupabaseStorage] getSignedUrl error for ${cleanPath}:`, err.message);
      return "";
    }
  }

  async delete(paths) {
    if (!this.client) return;
    const pathList = (Array.isArray(paths) ? paths : [paths])
      .filter(Boolean)
      .map((p) => p.replace(/^\/+/, ""));

    if (pathList.length === 0) return;

    const { error } = await this.client.storage
      .from(this.bucket)
      .remove(pathList);

    if (error) {
      console.warn(`[SupabaseStorage] Delete warning for ${pathList.join(", ")}:`, error.message);
    }
  }

  getUrl(path) {
    if (!this.client) return "";
    const cleanPath = path.replace(/^\/+/, "");
    const { data } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(cleanPath);
    return data?.publicUrl || "";
  }

  async getBuffer(path) {
    if (!this.client) {
      throw new Error("SupabaseStorage client is not configured");
    }

    const cleanPath = path.replace(/^\/+/, "");
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(cleanPath);

    if (error) {
      throw new Error(`Supabase Storage download failed for "${cleanPath}": ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(path) {
    if (!this.client) return false;
    const cleanPath = path.replace(/^\/+/, "");
    const folder = cleanPath.includes("/") ? cleanPath.substring(0, cleanPath.lastIndexOf("/")) : "";
    const fileName = cleanPath.includes("/") ? cleanPath.substring(cleanPath.lastIndexOf("/") + 1) : cleanPath;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: fileName });

    if (error || !Array.isArray(data)) return false;
    return data.some((item) => item.name === fileName);
  }
}
