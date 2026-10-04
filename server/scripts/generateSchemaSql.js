import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SEED_USERS, SEED_REPORTS } from "../src/db/seedData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeJson(obj) {
  if (obj === null || obj === undefined) return "NULL";
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

let sql = `-- =============================================================================
-- GreenWatch AI — Supabase Database Schema & Seed Migration
-- Project: GreenWatch AI (Civic Engagement & Municipal Operations)
-- Target: Supabase PostgreSQL (PostgREST + Storage + RLS)
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OFFICIAL', -- 'OFFICIAL' | 'ADMIN'
  department TEXT, -- 'Sanitation' | 'Parks & Forestry' | 'Water Utility' | 'Public Works'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist even if users table was previously initialized
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'OFFICIAL';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- -----------------------------------------------------------------------------
-- 2. REPORTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL, -- 'GW-XXXX'
  category TEXT NOT NULL, -- 'garbage' | 'tree' | 'water' | 'plants' | 'park' | 'blocked'
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  priority TEXT NOT NULL DEFAULT 'Medium', -- 'High' | 'Medium' | 'Low'
  status TEXT NOT NULL DEFAULT 'New', -- 'New' | 'Verified' | 'Assigned' | 'In Progress' | 'Resolved'
  department TEXT NOT NULL, -- 'Sanitation' | 'Parks & Forestry' | 'Water Utility' | 'Public Works'
  assignee TEXT, -- Display name of official (e.g. 'M. Alvarez')
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  work_order_ref TEXT, -- 'WO-XXXX'
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai JSONB,
  activity JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast queries and filters
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_department ON public.reports(department);
CREATE INDEX IF NOT EXISTS idx_reports_ref ON public.reports(ref);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. WORK ORDERS TABLE (Relational tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_orders (
  id TEXT PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  report_id TEXT REFERENCES public.reports(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  assigned_to TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. PHOTOS TABLE (Evidence Photos with Analysis Metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_path TEXT,
  thumbnail_url TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  evidence_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 0;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 0;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 0;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS evidence_analysis JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_photos_report_id ON public.photos(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos(created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security: NO public/anon policies. All direct client access denied.
-- Only the Express server (service_role / direct DB connection) accesses data.
-- -----------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to reports" ON public.reports;
DROP POLICY IF EXISTS "Anonymous can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Public can view reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated can update reports" ON public.reports;

DROP POLICY IF EXISTS "Public full access to users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;

DROP POLICY IF EXISTS "Public full access to work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Public can view work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated can manage work_orders" ON public.work_orders;

DROP POLICY IF EXISTS "Public full access to photos" ON public.photos;

-- -----------------------------------------------------------------------------
-- 6. STORAGE BUCKET FOR EVIDENCE PHOTOS
-- Private bucket with no anon listing or public policies
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('evidence', 'evidence', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Notice: storage.buckets already configured or handled by Supabase Storage.';
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public read from evidence bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Public upload to evidence bucket" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Notice: storage.objects policies updated.';
END $$;

-- -----------------------------------------------------------------------------
-- 7. SEED USERS
-- -----------------------------------------------------------------------------
`;

for (const u of SEED_USERS) {
  sql += `INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES (${escapeSql(u.id)}, ${escapeSql(u.email)}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.name)}, ${escapeSql(u.role)}, ${escapeSql(u.department)})
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
`;
}

sql += `
-- -----------------------------------------------------------------------------
-- 8. SEED REPORTS (Initial 12 Municipal Reports)
-- -----------------------------------------------------------------------------
`;

for (const r of SEED_REPORTS) {
  sql += `INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  ${escapeSql(r.id)},
  ${escapeSql(r.ref)},
  ${escapeSql(r.category)},
  ${escapeSql(r.description)},
  ${escapeSql(r.location?.address)},
  ${escapeSql(r.location?.area)},
  ${r.location?.lat ?? "NULL"},
  ${r.location?.lng ?? "NULL"},
  ${escapeSql(r.priority)},
  ${escapeSql(r.status)},
  ${escapeSql(r.department)},
  ${escapeSql(r.assignee)},
  ${r.dueDate ? escapeSql(r.dueDate) : "NULL"},
  ${r.resolvedAt ? escapeSql(r.resolvedAt) : "NULL"},
  ${escapeSql(r.workOrder)},
  ${escapeJson(r.photos || [])},
  ${escapeJson(r.ai || null)},
  ${escapeJson(r.activity || [])},
  ${escapeSql(r.createdAt)},
  ${escapeSql(r.updatedAt)}
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
`;
}

// Write to root supabase_schema.sql and supabase/migrations
const rootPath = path.resolve(__dirname, "../../supabase_schema.sql");
const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
fs.mkdirSync(migrationDir, { recursive: true });
const migrationPath = path.resolve(migrationDir, "20261003_init.sql");

fs.writeFileSync(rootPath, sql, "utf-8");
fs.writeFileSync(migrationPath, sql, "utf-8");

console.log("Successfully generated:", rootPath);
console.log("Successfully generated:", migrationPath);
