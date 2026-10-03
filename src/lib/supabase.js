import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kbrwjxonrllfysjorzvz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticndqeG9ucmxsZnlzam9yenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMTY5NTIsImV4cCI6MjEwNjU5Mjk1Mn0.foPpz2s69djxIAoxwb5XYvjOTuUj5RP_I9BlkEyOpa4";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Upload photo evidence to Supabase Storage bucket ('evidence').
 * Falls back to object URL if bucket is uninitialized.
 */
export async function uploadEvidencePhoto(file) {
  if (!supabase) return null;
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      console.warn("[Supabase Storage] Upload error, using local preview:", uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn("[Supabase Storage] Error:", err.message);
    return null;
  }
}
