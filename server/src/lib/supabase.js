import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

function getSafeSupabaseClient() {
  const url = config.supabase.url;
  const key = config.supabase.anonKey;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (err) {
    console.warn("[supabase.js createClient warning]:", err.message);
    return null;
  }
}

export const supabase = getSafeSupabaseClient();

/**
 * Check connectivity to Supabase project.
 */
export async function checkSupabaseConnection() {
  if (!supabase) return { connected: false, message: "Supabase client not configured" };

  try {
    // Attempt lightweight ping to verify project connectivity
    const { error } = await supabase.from("reports").select("id").limit(1);
    if (error && error.code === "PGRST205") {
      // Table doesn't exist yet, but project and credentials are 100% connected
      return {
        connected: true,
        tablesInitialized: false,
        message: "Connected to Supabase project. Tables pending migration.",
      };
    }
    if (error) {
      return { connected: false, message: error.message };
    }
    return {
      connected: true,
      tablesInitialized: true,
      message: "Connected to Supabase project with initialized schema.",
    };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}
