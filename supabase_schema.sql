-- =============================================================================
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
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Enables anonymous citizen reports + tracking, and official dashboard management
-- -----------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to reports" ON public.reports;
CREATE POLICY "Public full access to reports" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to users" ON public.users;
CREATE POLICY "Public full access to users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to work_orders" ON public.work_orders;
CREATE POLICY "Public full access to work_orders" ON public.work_orders
  FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. STORAGE BUCKET FOR EVIDENCE PHOTOS
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read from evidence bucket" ON storage.objects;
CREATE POLICY "Public read from evidence bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence');

DROP POLICY IF EXISTS "Public upload to evidence bucket" ON storage.objects;
CREATE POLICY "Public upload to evidence bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'evidence');

-- -----------------------------------------------------------------------------
-- 6. SEED USERS
-- -----------------------------------------------------------------------------
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-admin', 'admin@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'City Operations Admin', 'ADMIN', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-alvarez', 'm.alvarez@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'M. Alvarez', 'OFFICIAL', 'Sanitation')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-chen', 's.chen@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'S. Chen', 'OFFICIAL', 'Sanitation')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-okafor', 'j.okafor@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'J. Okafor', 'OFFICIAL', 'Parks & Forestry')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-novak', 'l.novak@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'L. Novak', 'OFFICIAL', 'Parks & Forestry')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-kapoor', 'r.kapoor@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'R. Kapoor', 'OFFICIAL', 'Water Utility')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-nguyen', 't.nguyen@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'T. Nguyen', 'OFFICIAL', 'Water Utility')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-petrova', 'd.petrova@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'D. Petrova', 'OFFICIAL', 'Public Works')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
INSERT INTO public.users (id, email, password_hash, name, role, department)
VALUES ('u-mensah', 'a.mensah@greenwatch.gov', '$2b$10$FLiVrw6fJ6VtXMQg2IYiZOtTdKBVsFmdksV9yqii2zGtzur0kSt5K', 'A. Mensah', 'OFFICIAL', 'Public Works')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- -----------------------------------------------------------------------------
-- 7. SEED REPORTS (Initial 12 Municipal Reports)
-- -----------------------------------------------------------------------------
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r1',
  'GW-2041',
  'garbage',
  'Six or seven garbage bags dumped behind the market dumpsters — third time this month. The smell is getting bad and the pile is starting to block the storm drain.',
  'Market Court, behind Block C dumpsters',
  'Riverside District',
  40.7123,
  -74.0021,
  'High',
  'In Progress',
  'Sanitation',
  'M. Alvarez',
  '2026-10-03T04:02:56.121Z',
  NULL,
  'WO-1187',
  '["/src/assets/garbage.jpg"]'::jsonb,
  '{"severity":"High","reason":"Public health and environmental risk","evidence":"Good","confidence":94,"similar":{"count":2,"ids":["r8"]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Illegal Garbage Dumping (94% confidence).","at":"2026-09-30T06:02:56.121Z"},{"kind":"agent","who":"Evidence Agent","text":"1 photo verified, matches the report. Evidence quality: Good.","at":"2026-09-30T07:02:56.121Z"},{"kind":"agent","who":"Duplicate Detection","text":"2 similar reports found in this area. Linked, not merged.","at":"2026-09-30T07:02:56.121Z"},{"kind":"agent","who":"Priority Agent","text":"Priority set to High — public health and environmental risk.","at":"2026-09-30T07:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Sanitation. Work order WO-1187 created.","at":"2026-09-30T07:02:56.121Z"},{"kind":"human","who":"M. Alvarez","text":"Crew scheduled for tomorrow morning.","at":"2026-10-02T14:02:56.121Z"},{"kind":"agent","who":"Follow-up Agent","text":"Update requested from the Sanitation team — report is past its due date.","at":"2026-10-03T04:02:56.121Z"}]'::jsonb,
  '2026-09-30T06:02:56.120Z',
  '2026-10-03T04:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r2',
  'GW-2040',
  'garbage',
  'Pile of construction debris and two old mattresses left on the walkway. It''s been here since the weekend and people are adding to it.',
  'Riverside Walkway, near Pier 3',
  'Riverside District',
  40.7089,
  -74.0112,
  'Medium',
  'Verified',
  'Sanitation',
  NULL,
  '2026-10-05T10:02:56.121Z',
  NULL,
  'WO-1191',
  '["/src/assets/garbage.jpg"]'::jsonb,
  '{"severity":"Medium","reason":"Waste accumulation in a busy public area","evidence":"Good","confidence":91,"similar":{"count":1,"ids":["r8"]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Illegal Garbage Dumping (91% confidence).","at":"2026-10-02T08:02:56.121Z"},{"kind":"agent","who":"Evidence Agent","text":"Photo verified. Evidence quality: Good.","at":"2026-10-02T08:02:56.121Z"},{"kind":"agent","who":"Priority Agent","text":"Priority set to Medium — no immediate safety risk.","at":"2026-10-02T08:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Sanitation. Work order WO-1191 created, awaiting pickup.","at":"2026-10-02T08:02:56.121Z"}]'::jsonb,
  '2026-10-02T08:02:56.121Z',
  '2026-10-02T10:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r3',
  'GW-2039',
  'tree',
  'A large branch split off the old elm and is hanging right over the school crossing. It creaks in the wind — could come down any time.',
  'Elm Street, crossing near Bloom School',
  'Bloomfield',
  40.7212,
  -73.9987,
  'High',
  'Assigned',
  'Parks & Forestry',
  'J. Okafor',
  '2026-10-04T00:02:56.121Z',
  NULL,
  'WO-1192',
  '["/src/assets/tree.jpg"]'::jsonb,
  '{"severity":"High","reason":"Safety hazard near a school crossing","evidence":"Good","confidence":96,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Fallen / Damaged Tree (96% confidence).","at":"2026-10-02T12:02:56.121Z"},{"kind":"agent","who":"Priority Agent","text":"Priority set to High — safety hazard near a school crossing.","at":"2026-10-02T12:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Parks & Forestry. Work order WO-1192 created.","at":"2026-10-02T12:02:56.121Z"},{"kind":"human","who":"J. Okafor","text":"Arborist crew dispatched, will secure the crossing first.","at":"2026-10-03T06:02:56.121Z"}]'::jsonb,
  '2026-10-02T12:02:56.121Z',
  '2026-10-03T06:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r4',
  'GW-2037',
  'water',
  'Water has been gushing out of the ground at the corner since last night. Running down the whole street — thousands of litres wasted.',
  'Rosewood Lane & 5th Avenue',
  'Old Town',
  40.7156,
  -73.9965,
  'High',
  'In Progress',
  'Water Utility',
  'R. Kapoor',
  '2026-10-04T10:02:56.121Z',
  NULL,
  'WO-1189',
  '["/src/assets/water.jpg"]'::jsonb,
  '{"severity":"High","reason":"Active water loss — damage and waste risk","evidence":"Good","confidence":95,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Water Leakage / Wastage (95% confidence).","at":"2026-10-01T09:02:56.121Z"},{"kind":"agent","who":"Priority Agent","text":"Priority set to High — active water loss.","at":"2026-10-01T09:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Water Utility. Work order WO-1189 created.","at":"2026-10-01T09:02:56.121Z"},{"kind":"human","who":"R. Kapoor","text":"Valve isolated on the north side. Excavation crew on site.","at":"2026-10-03T01:02:56.121Z"}]'::jsonb,
  '2026-10-01T09:02:56.121Z',
  '2026-10-03T01:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r5',
  'GW-2036',
  'park',
  'The bins at the east playground are overflowing and there is litter all over the grass. Kids play right next to it.',
  'Riverside Park, east playground',
  'Riverside District',
  40.7104,
  -74.0098,
  'Medium',
  'New',
  'Sanitation',
  NULL,
  '2026-10-06T10:02:56.121Z',
  NULL,
  'WO-1194',
  '[]'::jsonb,
  '{"severity":"Medium","reason":"Hygiene concern in a children''s play area","evidence":"Needs more info","confidence":82,"similar":{"count":1,"ids":["r11"]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Dirty Park (82% confidence).","at":"2026-10-03T01:02:56.121Z"},{"kind":"agent","who":"Evidence Agent","text":"No photos attached — evidence quality: Needs more info.","at":"2026-10-03T02:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Sanitation. Work order WO-1194 created.","at":"2026-10-03T02:02:56.121Z"}]'::jsonb,
  '2026-10-03T01:02:56.121Z',
  '2026-10-03T02:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r6',
  'GW-2035',
  'blocked',
  'The side gate of the community garden has been chained shut for two weeks. Elderly residents used that entrance every morning.',
  'Community Garden, Hill Road gate',
  'Hill District',
  40.7244,
  -74.0041,
  'Medium',
  'New',
  'Public Works',
  NULL,
  '2026-10-07T10:02:56.121Z',
  NULL,
  'WO-1195',
  '["/src/assets/blocked.jpg"]'::jsonb,
  '{"severity":"Medium","reason":"Public green space inaccessible to residents","evidence":"Needs more info","confidence":78,"similar":{"count":1,"ids":["r12"]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Blocked Green Area (78% confidence).","at":"2026-10-02T19:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Public Works. Work order WO-1195 created.","at":"2026-10-02T19:02:56.121Z"}]'::jsonb,
  '2026-10-02T19:02:56.121Z',
  '2026-10-02T19:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r7',
  'GW-2033',
  'plants',
  'The flower beds around the fountain are trampled flat. Needs replanting and maybe a low barrier so it doesn''t happen again.',
  'Central Plaza, fountain beds',
  'City Center',
  40.7178,
  -74.0008,
  'Low',
  'New',
  'Parks & Forestry',
  NULL,
  '2026-10-08T10:02:56.121Z',
  NULL,
  'WO-1196',
  '["/src/assets/plants.jpg"]'::jsonb,
  '{"severity":"Low","reason":"Cosmetic damage to maintained greenery","evidence":"Good","confidence":86,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Triage Agent","text":"Classified as Damaged Plants (86% confidence).","at":"2026-10-02T05:02:56.121Z"},{"kind":"agent","who":"Routing Agent","text":"Routed to Parks & Forestry. Work order WO-1196 created.","at":"2026-10-02T05:02:56.121Z"}]'::jsonb,
  '2026-10-02T05:02:56.121Z',
  '2026-10-02T05:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r8',
  'GW-2031',
  'garbage',
  'Cardboard boxes and food waste dumped in the rear alley behind the market. Blocking the delivery entrance.',
  'Lakeside Market, rear alley',
  'Lakeside',
  40.7052,
  -74.0154,
  'Medium',
  'Resolved',
  'Sanitation',
  'S. Chen',
  '2026-10-05T10:02:56.121Z',
  '2026-10-03T07:02:56.121Z',
  'WO-1181',
  '["/src/assets/garbage.jpg"]'::jsonb,
  '{"severity":"Medium","reason":"Waste accumulation in a busy public area","evidence":"Good","confidence":92,"similar":{"count":1,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Routing Agent","text":"Routed to Sanitation. Work order WO-1181 created.","at":"2026-09-27T10:02:56.121Z"},{"kind":"human","who":"S. Chen","text":"Alley cleared and washed. Anti-dumping sign requested.","at":"2026-10-03T05:02:56.121Z"},{"kind":"human","who":"S. Chen","text":"Marked as Resolved.","at":"2026-10-03T07:02:56.121Z"},{"kind":"agent","who":"Follow-up Agent","text":"Citizen notified and asked to confirm the fix.","at":"2026-10-03T07:02:56.121Z"}]'::jsonb,
  '2026-09-27T10:02:56.121Z',
  '2026-10-03T07:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r9',
  'GW-2028',
  'water',
  'Sprinkler on the Willow Court verge runs all night — the timer seems stuck open. Water flows straight into the gutter.',
  'Willow Court, green verge',
  'Willowbend',
  40.7013,
  -73.9923,
  'Low',
  'Resolved',
  'Water Utility',
  'T. Nguyen',
  '2026-10-04T10:02:56.121Z',
  '2026-10-03T04:02:56.121Z',
  'WO-1179',
  '["/src/assets/water.jpg"]'::jsonb,
  '{"severity":"Low","reason":"Steady water waste, no damage risk","evidence":"Good","confidence":89,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Routing Agent","text":"Routed to Water Utility. Work order WO-1179 created.","at":"2026-09-28T10:02:56.121Z"},{"kind":"human","who":"T. Nguyen","text":"Timer valve replaced. Marked as Resolved.","at":"2026-10-03T04:02:56.121Z"},{"kind":"agent","who":"Follow-up Agent","text":"Citizen notified. No re-report in 24h — loop closed.","at":"2026-10-03T05:02:56.121Z"}]'::jsonb,
  '2026-09-28T10:02:56.121Z',
  '2026-10-03T04:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r10',
  'GW-2025',
  'tree',
  'Heavy cracked branch hanging over the bus stop roof. It creaks loudly in the wind and commuters are standing underneath it.',
  'Bus stop 12, Northgate Avenue',
  'Northgate',
  40.7291,
  -74.0069,
  'Medium',
  'In Progress',
  'Parks & Forestry',
  'L. Novak',
  '2026-10-02T10:02:56.121Z',
  NULL,
  'WO-1176',
  '["/src/assets/tree.jpg"]'::jsonb,
  '{"severity":"Medium","reason":"Obstruction risk in a shared public space","evidence":"Good","confidence":90,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Routing Agent","text":"Routed to Parks & Forestry. Work order WO-1176 created.","at":"2026-09-29T10:02:56.121Z"},{"kind":"human","who":"L. Novak","text":"Inspected — needs a cherry picker, scheduled this week.","at":"2026-10-01T07:02:56.121Z"},{"kind":"agent","who":"Follow-up Agent","text":"Escalated: no update for 48h and report is past due. Reminder sent to crew supervisor.","at":"2026-10-03T08:02:56.121Z"}]'::jsonb,
  '2026-09-29T10:02:56.121Z',
  '2026-10-01T07:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r11',
  'GW-2022',
  'park',
  'Dog park bins haven''t been emptied in days. Waste bags are piling up near the entrance and the smell reaches the footpath.',
  'Northgate dog park, main gate',
  'Northgate',
  40.7302,
  -74.0089,
  'High',
  'Resolved',
  'Sanitation',
  'M. Alvarez',
  '2026-09-28T10:02:56.121Z',
  '2026-10-02T08:02:56.121Z',
  'WO-1170',
  '["/src/assets/park.jpg"]'::jsonb,
  '{"severity":"High","reason":"Public health concern at a busy park entrance","evidence":"Good","confidence":93,"similar":{"count":2,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Routing Agent","text":"Routed to Sanitation. Work order WO-1170 created.","at":"2026-09-26T10:02:56.121Z"},{"kind":"agent","who":"Follow-up Agent","text":"Update requested from the Sanitation team.","at":"2026-09-30T10:02:56.121Z"},{"kind":"human","who":"M. Alvarez","text":"Bins emptied, extra pickup scheduled twice a week. Marked as Resolved.","at":"2026-10-02T08:02:56.121Z"}]'::jsonb,
  '2026-09-26T10:02:56.121Z',
  '2026-10-02T08:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
INSERT INTO public.reports (
  id, ref, category, description, address, area, lat, lng,
  priority, status, department, assignee, due_date, resolved_at,
  work_order_ref, photos, ai, activity, created_at, updated_at
) VALUES (
  'r12',
  'GW-2019',
  'blocked',
  'Scaffolding from the facade works blocks the pocket park entrance, so the whole walkway is unusable.',
  'Fern Pocket Park, north entrance',
  'Old Town',
  40.7143,
  -73.9944,
  'Low',
  'Resolved',
  'Public Works',
  'D. Petrova',
  '2026-09-29T10:02:56.121Z',
  '2026-09-29T10:02:56.121Z',
  'WO-1162',
  '["/src/assets/blocked.jpg"]'::jsonb,
  '{"severity":"Low","reason":"Temporary obstruction, alternate path available","evidence":"Good","confidence":84,"similar":{"count":0,"ids":[]}}'::jsonb,
  '[{"kind":"agent","who":"Routing Agent","text":"Routed to Public Works. Work order WO-1162 created.","at":"2026-09-24T10:02:56.121Z"},{"kind":"human","who":"D. Petrova","text":"Contractor re-secured the walkway, entrance reopened. Marked as Resolved.","at":"2026-09-29T10:02:56.121Z"}]'::jsonb,
  '2026-09-24T10:02:56.121Z',
  '2026-09-29T10:02:56.121Z'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  department = EXCLUDED.department,
  assignee = EXCLUDED.assignee,
  updated_at = EXCLUDED.updated_at;
