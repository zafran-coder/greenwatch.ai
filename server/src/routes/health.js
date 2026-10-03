import { Router } from "express";
import { config } from "../config.js";
import { checkSupabaseConnection } from "../lib/supabase.js";
import { db, refreshSupabaseStatus } from "../db/client.js";

export const healthRouter = Router();

healthRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GreenWatch AI Municipal API",
    version: "1.0.0",
    database: {
      provider: db.isSupabaseActive ? "supabase" : db.isPrismaConnected ? "prisma" : "in-memory",
    },
  });
});

healthRouter.get("/supabase-status", async (req, res) => {
  await refreshSupabaseStatus();
  const supabaseInfo = await checkSupabaseConnection();
  res.status(200).json({
    status: "ok",
    supabase: {
      url: config.supabase?.url || null,
      ...supabaseInfo,
      activeProvider: db.isSupabaseActive ? "supabase" : "in-memory-fallback",
      migrationFile: "supabase_schema.sql",
    },
  });
});
