import { Router } from "express";
import { config } from "../config.js";
import { checkSupabaseConnection } from "../lib/supabase.js";
import { db, refreshSupabaseStatus } from "../db/client.js";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  let dbStatus = "ok";
  let dbProvider = "in-memory";
  let dbDetails = null;

  try {
    if (db.isSupabaseActive) {
      await refreshSupabaseStatus();
      const sbCheck = await checkSupabaseConnection();
      dbProvider = "supabase";
      dbStatus = sbCheck.connected ? "ok" : "degraded";
      dbDetails = sbCheck.message;
    } else if (db.isPrismaConnected) {
      dbProvider = "prisma";
      dbStatus = "ok";
    } else {
      dbProvider = "in-memory";
      dbStatus = "ok";
    }
  } catch (err) {
    dbStatus = "error";
    dbDetails = err.message;
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GreenWatch AI Municipal API",
    version: "1.0.0",
    database: {
      status: dbStatus,
      provider: dbProvider,
      ...(dbDetails ? { details: dbDetails } : {}),
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
