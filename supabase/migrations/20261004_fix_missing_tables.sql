-- =============================================================================
-- GreenWatch AI — Safe & Idempotent Supabase Schema Migration
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Ensure REPORTS table and any missing columns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'New',
  department TEXT NOT NULL,
  assignee TEXT,
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  work_order_ref TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai JSONB,
  activity JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS work_order_ref TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai JSONB;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS activity JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_department ON public.reports(department);
CREATE INDEX IF NOT EXISTS idx_reports_ref ON public.reports(ref);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. PHOTOS TABLE (Evidence Photos with Analysis Metadata)
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
-- 3. AGENT RUNS TABLE (Telemetry & Provider Tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id TEXT PRIMARY KEY DEFAULT ('run-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_ms INTEGER DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'fallback',
  fallback_reason TEXT,
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'fallback';
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS fallback_reason TEXT;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agent_runs_report_id ON public.agent_runs(report_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON public.agent_runs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. DUPLICATE LINKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duplicate_links (
  id TEXT PRIMARY KEY DEFAULT ('dup-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  duplicate_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  similarity_score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duplicate_links_report_id ON public.duplicate_links(report_id);

-- -----------------------------------------------------------------------------
-- 5. WORK ORDERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_orders (
  id TEXT PRIMARY KEY DEFAULT ('wo-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
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
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies: Public read & insert
DROP POLICY IF EXISTS "Public full access to reports" ON public.reports;
CREATE POLICY "Public full access to reports" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to photos" ON public.photos;
CREATE POLICY "Public full access to photos" ON public.photos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to agent_runs" ON public.agent_runs;
CREATE POLICY "Public full access to agent_runs" ON public.agent_runs
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to duplicate_links" ON public.duplicate_links;
CREATE POLICY "Public full access to duplicate_links" ON public.duplicate_links
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to work_orders" ON public.work_orders;
CREATE POLICY "Public full access to work_orders" ON public.work_orders
  FOR ALL USING (true) WITH CHECK (true);
