import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { supabase, checkSupabaseConnection } from "../lib/supabase.js";
import { SEED_USERS, SEED_REPORTS } from "./seedData.js";

export const prisma = new PrismaClient();

let isPrismaConnected = false;
let isSupabaseActive = false;

// Attempt initial connection to Prisma in the background
async function checkPrismaConnection() {
  try {
    await prisma.$connect();
    isPrismaConnected = true;
    console.log("[Database] Connected to PostgreSQL via Prisma.");
  } catch (err) {
    isPrismaConnected = false;
  }
}

// Check connectivity to Supabase
export async function refreshSupabaseStatus() {
  if (!supabase) {
    isSupabaseActive = false;
    return false;
  }
  try {
    const status = await checkSupabaseConnection();
    isSupabaseActive = Boolean(status.connected && status.tablesInitialized);
    if (isSupabaseActive) {
      console.log("[Database] Connected to live Supabase database with initialized tables.");
      // Synchronize sequence numbers with live database to prevent duplicate key collisions
      try {
        const { data: latestReports } = await supabase
          .from("reports")
          .select("ref, work_order_ref")
          .order("created_at", { ascending: false })
          .limit(50);
        if (Array.isArray(latestReports)) {
          for (const row of latestReports) {
            const rMatch = String(row.ref || "").match(/^GW-(\d{4})$/);
            if (rMatch) {
              const rNum = parseInt(rMatch[1], 10);
              if (rNum > (inMemoryDb._refSeq || 0)) inMemoryDb._refSeq = rNum;
            }
            const wMatch = String(row.work_order_ref || "").match(/^WO-(\d{4})$/);
            if (wMatch) {
              const wNum = parseInt(wMatch[1], 10);
              if (wNum > (inMemoryDb._woSeq || 0)) inMemoryDb._woSeq = wNum;
            }
          }
        }
      } catch (seqErr) {
        console.warn("[Database] Sequence sync notice:", seqErr.message);
      }
    } else if (status.connected) {
      console.log(
        "[Database] Supabase project connected! Tables not yet migrated — using high-fidelity in-memory store until 'supabase_schema.sql' is run."
      );
    }
    return isSupabaseActive;
  } catch (e) {
    isSupabaseActive = false;
    return false;
  }
}

checkPrismaConnection();
refreshSupabaseStatus();

// --- In-Memory Repository Store ---
class InMemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = JSON.parse(JSON.stringify(SEED_USERS));
    this.photos = [];
    this.agentRuns = [];
    this.duplicateLinks = [];
    this.followUps = [];
    this.reports = JSON.parse(JSON.stringify(SEED_REPORTS)).map((r) => ({
      ...r,
      slaDueAt: r.slaDueAt || r.dueDate || null,
      dueDate: r.dueDate || r.slaDueAt || null,
      activity: (r.activity || []).map((a) => ({
        ...a,
        isInternal: Boolean(a.isInternal),
      })),
    }));
  }

  // --- Users & Officials ---
  async findUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  async findUserById(id) {
    return this.users.find((u) => u.id === id) || null;
  }

  async findOfficials() {
    return this.users
      .filter((u) => u.role === "OFFICIAL")
      .map(({ passwordHash, ...rest }) => rest);
  }

  async createUser(data) {
    const user = {
      id: `u-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    this.users.push(user);
    return user;
  }

  // --- Reports ---
  async findReports({
    status,
    category,
    priority,
    department,
    q,
    sortBy = "createdAt",
    sortOrder = "desc",
    skip = 0,
    take = 50,
  } = {}) {
    let list = [...this.reports];

    if (status && status !== "All") {
      list = list.filter((r) => r.status === status);
    }
    if (category && category !== "All") {
      list = list.filter((r) => r.category === category);
    }
    if (priority && priority !== "All") {
      list = list.filter((r) => r.priority === priority);
    }
    if (department && department !== "All") {
      list = list.filter((r) => r.department === department);
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) => {
        const hay = `${r.ref} ${r.category} ${r.location?.address || ""} ${r.location?.area || ""} ${r.department} ${r.assignee || ""} ${r.description}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    if (sortBy) {
      list.sort((a, b) => {
        let valA = a[sortBy] ?? (sortBy === "slaDueAt" ? a.dueDate : "");
        let valB = b[sortBy] ?? (sortBy === "slaDueAt" ? b.dueDate : "");
        if (sortBy === "createdAt" || sortBy === "dueDate" || sortBy === "slaDueAt") {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    const total = list.length;
    const items = list.slice(skip, skip + take);
    return { items, total };
  }

  async findReportById(id) {
    return this.reports.find((r) => r.id === id) || null;
  }

  async findReportByRef(ref) {
    const normalized = String(ref || "").trim().toLowerCase();
    return (
      this.reports.find((r) => r.ref.toLowerCase() === normalized) || null
    );
  }

  async createReport(data) {
    const now = new Date().toISOString();
    const dueDate = data.dueDate || data.slaDueAt || null;
    const report = {
      ...data,
      id: data.id || `r${Date.now().toString(36)}`,
      createdAt: data.createdAt || now,
      updatedAt: now,
      dueDate,
      slaDueAt: dueDate,
      resolvedAt: data.resolvedAt || null,
      activity: (data.activity || []).map((a) => ({
        ...a,
        isInternal: Boolean(a.isInternal),
        at: a.at || now,
      })),
      photos: data.photos || [],
      ai: data.ai || null,
    };
    this.reports.unshift(report);
    return report;
  }

  async updateReport(id, patch, activityEntry = null) {
    const idx = this.reports.findIndex((r) => r.id === id || r.ref === id);
    if (idx === -1) return null;

    const current = this.reports[idx];
    const now = new Date().toISOString();

    const updated = {
      ...current,
      ...patch,
      updatedAt: now,
      activity: activityEntry
        ? [
            ...current.activity,
            {
              kind: activityEntry.kind || "human",
              who: activityEntry.who || "Official",
              text: activityEntry.text,
              isInternal: Boolean(activityEntry.isInternal),
              at: activityEntry.at || now,
            },
          ]
        : current.activity,
    };

    if (patch.slaDueAt !== undefined) {
      updated.slaDueAt = patch.slaDueAt ? new Date(patch.slaDueAt).toISOString() : null;
      updated.dueDate = updated.slaDueAt;
    }
    if (patch.dueDate !== undefined) {
      updated.dueDate = patch.dueDate ? new Date(patch.dueDate).toISOString() : null;
      updated.slaDueAt = updated.dueDate;
    }

    if (patch.status === "Resolved" && !updated.resolvedAt) {
      updated.resolvedAt = now;
    } else if (patch.status && patch.status !== "Resolved") {
      updated.resolvedAt = null;
    }

    this.reports[idx] = updated;
    return updated;
  }

  async addActivity(id, entry) {
    return this.updateReport(id, {}, entry);
  }

  // --- Photos ---
  async createPhoto(data) {
    const photo = {
      id: data.id || `photo-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      reportId: data.reportId,
      path: data.path,
      url: data.url,
      thumbnailPath: data.thumbnailPath || null,
      thumbnailUrl: data.thumbnailUrl || null,
      size: data.size || 0,
      width: data.width || 0,
      height: data.height || 0,
      evidenceAnalysis: data.evidenceAnalysis || {},
      createdAt: data.createdAt || new Date().toISOString(),
    };
    this.photos.push(photo);
    return photo;
  }

  async findPhotosByReportId(reportId) {
    return this.photos.filter((p) => p.reportId === reportId);
  }

  async findPhotoById(id) {
    return this.photos.find((p) => p.id === id) || null;
  }

  async deletePhotoById(id) {
    const idx = this.photos.findIndex((p) => p.id === id);
    if (idx !== -1) {
      return this.photos.splice(idx, 1)[0];
    }
    return null;
  }

  async deletePhotosByReportId(reportId) {
    const toDelete = this.photos.filter((p) => p.reportId === reportId);
    this.photos = this.photos.filter((p) => p.reportId !== reportId);
    return toDelete;
  }

  async deleteReport(id) {
    const idx = this.reports.findIndex((r) => r.id === id || r.ref === id);
    if (idx === -1) return null;
    const report = this.reports.splice(idx, 1)[0];
    const deletedPhotos = await this.deletePhotosByReportId(report.id);
    return { report, deletedPhotos };
  }

  // --- Agent Runs ---
  async createAgentRun(data) {
    const row = {
      id: data.id || `ar-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      reportId: data.reportId,
      agentName: data.agentName,
      status: data.status || "completed",
      provider: data.provider || "fallback",
      fallbackReason: data.fallbackReason ?? null,
      durationMs: data.durationMs || 0,
      input: data.input || null,
      output: data.output || null,
      error: data.error || null,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    this.agentRuns.push(row);
    return row;
  }

  async findAgentRunsByReportId(reportId) {
    return this.agentRuns.filter((r) => r.reportId === reportId);
  }

  // --- Duplicate Links ---
  async createDuplicateLink(data) {
    const row = {
      id: data.id || `dl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      reportId: data.reportId,
      targetReportId: data.targetReportId,
      similarityScore: data.similarityScore || 0,
      distanceMeters: data.distanceMeters ?? null,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    this.duplicateLinks.push(row);
    return row;
  }

  async findDuplicateLinksByReportId(reportId) {
    return this.duplicateLinks.filter(
      (d) => d.reportId === reportId || d.targetReportId === reportId
    );
  }

  // --- Follow Ups ---
  async createFollowUp(data) {
    const row = {
      id: data.id || `fu-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      reportId: data.reportId,
      status: data.status || "pending",
      confirmed: data.confirmed ?? null,
      comment: data.comment || null,
      resolvedAt: data.resolvedAt || null,
      verifiedAt: data.verifiedAt || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.followUps.push(row);
    return row;
  }

  async findFollowUpByReportId(reportId) {
    return this.followUps.find((f) => f.reportId === reportId) || null;
  }

  async findFollowUpByRef(ref) {
    const report = await this.findReportByRef(ref);
    if (!report) return null;
    return this.findFollowUpByReportId(report.id);
  }

  async updateFollowUp(idOrReportId, patch) {
    const idx = this.followUps.findIndex(
      (f) => f.id === idOrReportId || f.reportId === idOrReportId
    );
    if (idx === -1) {
      return this.createFollowUp({ reportId: idOrReportId, ...patch });
    }
    this.followUps[idx] = {
      ...this.followUps[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return this.followUps[idx];
  }

  // --- ID Generator Helpers ---
  nextRef() {
    const max = this.reports.reduce((m, r) => {
      const match = String(r.ref || "").match(/^GW-(\d{4})$/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 2045);
    this._refSeq = Math.max(this._refSeq || 0, max) + 1;
    while (this.reports.some((r) => r.ref === `GW-${String(this._refSeq).padStart(4, "0")}`)) {
      this._refSeq++;
    }
    return `GW-${String(this._refSeq).padStart(4, "0")}`;
  }

  nextWorkOrder() {
    const max = this.reports.reduce((m, r) => {
      const match = String(r.workOrder || "").match(/^WO-(\d{4})$/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 1195);
    this._woSeq = Math.max(this._woSeq || 0, max) + 1;
    while (this.reports.some((r) => r.workOrder === `WO-${String(this._woSeq).padStart(4, "0")}`)) {
      this._woSeq++;
    }
    return `WO-${String(this._woSeq).padStart(4, "0")}`;
  }
}

export const inMemoryDb = new InMemoryStore();

// Format a Prisma report entity into the frontend report shape
function shouldUseInMemory() {
  return config.nodeEnv === "test" || process.env.NODE_ENV === "test";
}

// Format a Prisma report entity into the frontend report shape
function formatPrismaReport(r) {
  if (!r) return null;
  const dueDateStr = r.dueDate ? r.dueDate.toISOString() : null;
  return {
    id: r.id,
    ref: r.ref,
    category: r.category,
    description: r.description,
    location: {
      address: r.address,
      area: r.area,
      lat: r.lat,
      lng: r.lng,
    },
    photos: r.photos ? r.photos.map((p) => p.url) : [],
    priority: r.priority,
    status: r.status,
    department: r.department,
    assignee: r.assignee || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    dueDate: dueDateStr,
    slaDueAt: dueDateStr,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    workOrder: r.workOrderRef || (r.workOrder ? r.workOrder.ref : null),
    ai: r.ai
      ? {
          severity: r.ai.severity,
          reason: r.ai.reason,
          evidence: r.ai.evidence,
          confidence: r.ai.confidence,
          similar: {
            count: r.ai.similarCount,
            ids: (() => {
              try {
                return JSON.parse(r.ai.similarIds || "[]");
              } catch (e) {
                return [];
              }
            })(),
          },
        }
      : null,
    activity: r.activity
      ? r.activity.map((a) => ({
          kind: a.kind,
          who: a.who,
          text: a.text,
          isInternal: Boolean(a.isInternal),
          at: a.createdAt.toISOString(),
        }))
      : [],
  };
}

// Format a Supabase report row into the frontend report shape
function formatSupabaseReport(r) {
  if (!r) return null;
  const dueDateStr = r.due_date ? new Date(r.due_date).toISOString() : null;
  return {
    id: r.id,
    ref: r.ref,
    category: r.category,
    description: r.description,
    location: {
      address: r.address || "",
      area: r.area || "",
      lat: r.lat,
      lng: r.lng,
    },
    photos: Array.isArray(r.photos) ? r.photos : [],
    priority: r.priority,
    status: r.status,
    department: r.department,
    assignee: r.assignee || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    dueDate: dueDateStr,
    slaDueAt: dueDateStr,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    workOrder: r.work_order_ref || null,
    ai: r.ai || null,
    activity: Array.isArray(r.activity)
      ? r.activity.map((a) => ({
          ...a,
          isInternal: Boolean(a.isInternal),
        }))
      : [],
  };
}

// Format a Prisma photo entity into uniform API shape
function formatPrismaPhoto(p) {
  if (!p) return null;
  let evidenceAnalysis = {};
  try {
    if (typeof p.evidenceAnalysis === "string") {
      evidenceAnalysis = JSON.parse(p.evidenceAnalysis || "{}");
    } else if (p.evidenceAnalysis && typeof p.evidenceAnalysis === "object") {
      evidenceAnalysis = p.evidenceAnalysis;
    }
  } catch (e) {
    evidenceAnalysis = {};
  }

  return {
    id: p.id,
    reportId: p.reportId,
    path: p.path || "",
    url: p.url,
    thumbnailPath: p.thumbnailPath || null,
    thumbnailUrl: p.thumbnailUrl || null,
    size: p.size || 0,
    width: p.width || 0,
    height: p.height || 0,
    evidenceAnalysis,
    createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
  };
}

// Format a Supabase photo row into uniform API shape
function formatSupabasePhoto(p) {
  if (!p) return null;
  let evidenceAnalysis = {};
  try {
    if (typeof p.evidence_analysis === "string") {
      evidenceAnalysis = JSON.parse(p.evidence_analysis || "{}");
    } else if (p.evidence_analysis && typeof p.evidence_analysis === "object") {
      evidenceAnalysis = p.evidence_analysis;
    }
  } catch (e) {
    evidenceAnalysis = {};
  }

  return {
    id: p.id,
    reportId: p.report_id || p.reportId,
    path: p.path || "",
    url: p.url,
    thumbnailPath: p.thumbnail_path || p.thumbnailPath || null,
    thumbnailUrl: p.thumbnail_url || p.thumbnailUrl || null,
    size: p.size || 0,
    width: p.width || 0,
    height: p.height || 0,
    evidenceAnalysis,
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
  };
}

// Unified Database Access Interface
export const db = {
  get isPrismaConnected() {
    return isPrismaConnected;
  },

  get isSupabaseActive() {
    return isSupabaseActive;
  },

  async findOfficials() {
    if (shouldUseInMemory()) {
      return inMemoryDb.findOfficials();
    }
    if (isPrismaConnected) {
      try {
        const users = await prisma.user.findMany({
          where: { role: "OFFICIAL" },
          select: { id: true, name: true, email: true, role: true, department: true },
        });
        return users;
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findOfficials();
  },

  async findUserByEmail(email) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findUserByEmail(email);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .ilike("email", email.trim())
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            email: data.email,
            passwordHash: data.password_hash,
            name: data.name,
            role: data.role,
            department: data.department,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        return await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findUserByEmail(email);
  },

  async findUserById(id) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findUserById(id);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            email: data.email,
            passwordHash: data.password_hash,
            name: data.name,
            role: data.role,
            department: data.department,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        return await prisma.user.findUnique({ where: { id } });
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findUserById(id);
  },

  async createUser(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createUser(data);
    }
    if (isSupabaseActive && supabase) {
      try {
        const row = {
          id: data.id || `u-${Date.now().toString(36)}`,
          email: data.email.toLowerCase(),
          password_hash: data.passwordHash,
          name: data.name,
          role: data.role || "OFFICIAL",
          department: data.department || null,
        };
        const { data: created, error } = await supabase
          .from("users")
          .insert([row])
          .select()
          .single();

        if (!error && created) {
          return {
            id: created.id,
            email: created.email,
            passwordHash: created.password_hash,
            name: created.name,
            role: created.role,
            department: created.department,
          };
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        return await prisma.user.create({ data });
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.createUser(data);
  },

  async findReports(filters = {}) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findReports(filters);
    }
    if (isSupabaseActive && supabase) {
      try {
        let query = supabase.from("reports").select("*", { count: "exact" });

        if (filters.status && filters.status !== "All") {
          query = query.eq("status", filters.status);
        }
        if (filters.category && filters.category !== "All") {
          query = query.eq("category", filters.category);
        }
        if (filters.priority && filters.priority !== "All") {
          query = query.eq("priority", filters.priority);
        }
        if (filters.department && filters.department !== "All") {
          query = query.eq("department", filters.department);
        }
        if (filters.q && filters.q.trim()) {
          const term = `%${filters.q.trim()}%`;
          query = query.or(
            `ref.ilike.${term},description.ilike.${term},address.ilike.${term},area.ilike.${term}`
          );
        }

        query = query.order("created_at", { ascending: false });

        const skip = filters.skip || 0;
        const take = filters.take || 50;
        query = query.range(skip, skip + take - 1);

        const { data, count, error } = await query;
        if (!error && data) {
          return {
            items: data.map(formatSupabaseReport),
            total: count !== null ? count : data.length,
          };
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const where = {};
        if (filters.status && filters.status !== "All") where.status = filters.status;
        if (filters.category && filters.category !== "All") where.category = filters.category;
        if (filters.priority && filters.priority !== "All") where.priority = filters.priority;
        if (filters.department && filters.department !== "All") where.department = filters.department;
        if (filters.q && filters.q.trim()) {
          where.OR = [
            { ref: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { address: { contains: filters.q, mode: "insensitive" } },
            { area: { contains: filters.q, mode: "insensitive" } },
          ];
        }

        const [items, total] = await Promise.all([
          prisma.report.findMany({
            where,
            include: { photos: true, ai: true, activity: true, workOrder: true },
            orderBy: { createdAt: "desc" },
            skip: filters.skip || 0,
            take: filters.take || 50,
          }),
          prisma.report.count({ where }),
        ]);

        return { items: items.map(formatPrismaReport), total };
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findReports(filters);
  },

  async findReportById(id) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findReportById(id);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          return formatSupabaseReport(data);
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const r = await prisma.report.findUnique({
          where: { id },
          include: { photos: true, ai: true, activity: true, workOrder: true },
        });
        if (r) return formatPrismaReport(r);
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findReportById(id);
  },

  async findReportByRef(ref) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findReportByRef(ref);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .ilike("ref", ref.trim())
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          return formatSupabaseReport(data[0]);
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const r = await prisma.report.findFirst({
          where: { ref: { equals: ref, mode: "insensitive" } },
          include: { photos: true, ai: true, activity: true, workOrder: true },
        });
        if (r) return formatPrismaReport(r);
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.findReportByRef(ref);
  },

  async createReport(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createReport(data);
    }
    if (isSupabaseActive && supabase) {
      try {
        const now = new Date().toISOString();
        const row = {
          id: data.id || `r${Date.now().toString(36)}`,
          ref: data.ref,
          category: data.category,
          description: data.description,
          address: data.location?.address || "",
          area: data.location?.area || "Reported via app",
          lat: data.location?.lat ?? null,
          lng: data.location?.lng ?? null,
          priority: data.priority || "Medium",
          status: data.status || "New",
          department: data.department,
          assignee: data.assignee || null,
          due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          resolved_at: data.resolvedAt ? new Date(data.resolvedAt).toISOString() : null,
          work_order_ref: data.workOrder || null,
          photos: data.photos || [],
          ai: data.ai || null,
          activity: data.activity || [],
          created_at: data.createdAt || now,
          updated_at: now,
        };

        const { data: created, error } = await supabase
          .from("reports")
          .insert([row])
          .select()
          .single();

        if (error) {
          console.warn("[Supabase createReport Warning]:", error.message);
          // If unique ref collision occurs, increment sequence and retry
          if (error.code === "23505") {
            inMemoryDb._refSeq = (inMemoryDb._refSeq || 2046) + 1;
            inMemoryDb._woSeq = (inMemoryDb._woSeq || 1197) + 1;
            row.ref = `GW-${String(inMemoryDb._refSeq).padStart(4, "0")}`;
            row.work_order_ref = `WO-${String(inMemoryDb._woSeq).padStart(4, "0")}`;
            const { data: retried, error: retryError } = await supabase
              .from("reports")
              .insert([row])
              .select()
              .single();
            if (!retryError && retried) {
              return formatSupabaseReport(retried);
            }
          }
        } else if (created) {
          return formatSupabaseReport(created);
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const created = await prisma.report.create({
          data: {
            id: data.id,
            ref: data.ref,
            category: data.category,
            description: data.description,
            address: data.location.address,
            area: data.location.area || "Reported via app",
            lat: data.location.lat,
            lng: data.location.lng,
            priority: data.priority,
            status: data.status,
            department: data.department,
            assignee: data.assignee,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            workOrderRef: data.workOrder,
            photos: {
              create: (data.photos || []).map((url) => ({ url })),
            },
            ai: data.ai
              ? {
                  create: {
                    severity: data.ai.severity,
                    reason: data.ai.reason,
                    evidence: data.ai.evidence,
                    confidence: data.ai.confidence,
                    similarCount: data.ai.similar?.count || 0,
                    similarIds: JSON.stringify(data.ai.similar?.ids || []),
                  },
                }
              : undefined,
            activity: {
              create: (data.activity || []).map((a) => ({
                kind: a.kind,
                who: a.who,
                text: a.text,
                createdAt: a.at ? new Date(a.at) : new Date(),
              })),
            },
          },
          include: { photos: true, ai: true, activity: true, workOrder: true },
        });
        return formatPrismaReport(created);
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.createReport(data);
  },

  async updateReport(id, patch, activityEntry = null) {
    if (shouldUseInMemory()) {
      return inMemoryDb.updateReport(id, patch, activityEntry);
    }
    if (isSupabaseActive && supabase) {
      try {
        let currentActivity = [];
        if (activityEntry) {
          const { data: current } = await supabase
            .from("reports")
            .select("activity")
            .eq("id", id)
            .maybeSingle();

          if (current && Array.isArray(current.activity)) {
            currentActivity = current.activity;
          }
        }

        const updateData = {
          updated_at: new Date().toISOString(),
        };

        if (patch.status !== undefined) {
          updateData.status = patch.status;
          updateData.resolved_at = patch.status === "Resolved" ? new Date().toISOString() : null;
        }
        if (patch.priority !== undefined) updateData.priority = patch.priority;
        if (patch.department !== undefined) updateData.department = patch.department;
        if (patch.assignee !== undefined) updateData.assignee = patch.assignee;
        if (patch.dueDate !== undefined) updateData.due_date = patch.dueDate;
        if (patch.workOrder !== undefined) updateData.work_order_ref = patch.workOrder;
        if (patch.photos !== undefined) updateData.photos = patch.photos;
        if (patch.ai !== undefined) updateData.ai = patch.ai;

        if (activityEntry) {
          updateData.activity = [
            ...currentActivity,
            {
              kind: activityEntry.kind || "human",
              who: activityEntry.who || "Official",
              text: activityEntry.text,
              isInternal: Boolean(activityEntry.isInternal),
              at: activityEntry.at || new Date().toISOString(),
            },
          ];
        }

        const { data: updated, error } = await supabase
          .from("reports")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (!error && updated) {
          return formatSupabaseReport(updated);
        }
      } catch (err) {
        console.warn("[Supabase query fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const updateData = {};
        if (patch.status !== undefined) {
          updateData.status = patch.status;
          updateData.resolvedAt = patch.status === "Resolved" ? new Date() : null;
        }
        if (patch.priority !== undefined) updateData.priority = patch.priority;
        if (patch.department !== undefined) updateData.department = patch.department;
        if (patch.assignee !== undefined) updateData.assignee = patch.assignee;
        if (activityEntry) {
          updateData.activity = {
            create: {
              kind: activityEntry.kind || "human",
              who: activityEntry.who || "Official",
              text: activityEntry.text,
            },
          };
        }

        const updated = await prisma.report.update({
          where: { id },
          data: updateData,
          include: { photos: true, ai: true, activity: true, workOrder: true },
        });
        return formatPrismaReport(updated);
      } catch (err) {
        console.warn("[Prisma Error - fallback to in-memory]:", err.message);
      }
    }
    return inMemoryDb.updateReport(id, patch, activityEntry);
  },

  async addActivity(id, entry) {
    return this.updateReport(id, {}, entry);
  },

  // --- Photo Operations ---
  async createPhoto(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createPhoto(data);
    }

    if (isSupabaseActive && supabase) {
      try {
        const row = {
          id: data.id || `photo-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
          report_id: data.reportId,
          path: data.path,
          url: data.url,
          thumbnail_path: data.thumbnailPath || null,
          thumbnail_url: data.thumbnailUrl || null,
          size: data.size || 0,
          width: data.width || 0,
          height: data.height || 0,
          evidence_analysis: data.evidenceAnalysis || {},
          created_at: data.createdAt || new Date().toISOString(),
        };

        const { data: created, error } = await supabase
          .from("photos")
          .insert([row])
          .select()
          .single();

        if (!error && created) {
          return formatSupabasePhoto(created);
        }
      } catch (err) {
        console.warn("[Supabase createPhoto fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const created = await prisma.photo.create({
          data: {
            id: data.id,
            reportId: data.reportId,
            path: data.path,
            url: data.url,
            thumbnailPath: data.thumbnailPath,
            thumbnailUrl: data.thumbnailUrl,
            size: data.size || 0,
            width: data.width || 0,
            height: data.height || 0,
            evidenceAnalysis: data.evidenceAnalysis || {},
          },
        });
        return formatPrismaPhoto(created);
      } catch (err) {
        console.warn("[Prisma createPhoto fallback to in-memory]:", err.message);
      }
    }

    return inMemoryDb.createPhoto(data);
  },

  async findPhotosByReportId(reportId) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findPhotosByReportId(reportId);
    }

    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("photos")
          .select("*")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data)) {
          return data.map(formatSupabasePhoto);
        }
      } catch (err) {
        console.warn("[Supabase findPhotosByReportId fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const photos = await prisma.photo.findMany({
          where: { reportId },
          orderBy: { createdAt: "asc" },
        });
        return photos.map(formatPrismaPhoto);
      } catch (err) {
        console.warn("[Prisma findPhotosByReportId fallback to in-memory]:", err.message);
      }
    }

    return inMemoryDb.findPhotosByReportId(reportId);
  },

  async findPhotoById(id) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findPhotoById(id);
    }

    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("photos")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          return formatSupabasePhoto(data);
        }
      } catch (err) {
        console.warn("[Supabase findPhotoById fallback to in-memory]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        const photo = await prisma.photo.findUnique({ where: { id } });
        if (photo) return formatPrismaPhoto(photo);
      } catch (err) {
        console.warn("[Prisma findPhotoById fallback to in-memory]:", err.message);
      }
    }

    return inMemoryDb.findPhotoById(id);
  },

  async deletePhotoById(id) {
    const current = await this.findPhotoById(id);
    if (!current) return null;

    if (isSupabaseActive && supabase) {
      try {
        await supabase.from("photos").delete().eq("id", id);
      } catch (err) {
        console.warn("[Supabase deletePhotoById fallback]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        await prisma.photo.delete({ where: { id } });
      } catch (err) {
        console.warn("[Prisma deletePhotoById fallback]:", err.message);
      }
    }

    inMemoryDb.deletePhotoById(id);
    return current;
  },

  async deletePhotosByReportId(reportId) {
    const existing = await this.findPhotosByReportId(reportId);

    if (isSupabaseActive && supabase) {
      try {
        await supabase.from("photos").delete().eq("report_id", reportId);
      } catch (err) {
        console.warn("[Supabase deletePhotosByReportId fallback]:", err.message);
      }
    }

    if (isPrismaConnected) {
      try {
        await prisma.photo.deleteMany({ where: { reportId } });
      } catch (err) {
        console.warn("[Prisma deletePhotosByReportId fallback]:", err.message);
      }
    }

    inMemoryDb.deletePhotosByReportId(reportId);
    return existing;
  },

  async deleteReport(id) {
    // 1. Fetch existing photos to enable file deletion from storage
    const photos = await this.findPhotosByReportId(id);
    let deletedReport = null;

    if (shouldUseInMemory()) {
      return inMemoryDb.deleteReport(id);
    }

    if (isSupabaseActive && supabase) {
      try {
        const { data: report } = await supabase
          .from("reports")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (report) {
          await supabase.from("photos").delete().eq("report_id", id);
          await supabase.from("reports").delete().eq("id", id);
          deletedReport = formatSupabaseReport(report);
        }
      } catch (err) {
        console.warn("[Supabase deleteReport fallback]:", err.message);
      }
    }

    if (!deletedReport && isPrismaConnected) {
      try {
        const report = await prisma.report.delete({
          where: { id },
          include: { photos: true },
        });
        deletedReport = formatPrismaReport(report);
      } catch (err) {
        console.warn("[Prisma deleteReport fallback]:", err.message);
      }
    }

    if (!deletedReport) {
      return inMemoryDb.deleteReport(id);
    }

    inMemoryDb.deleteReport(id);
    return {
      report: deletedReport,
      deletedPhotos: photos,
    };
  },

  // --- Agent Runs ---
  async createAgentRun(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createAgentRun(data);
    }
    if (isSupabaseActive && supabase) {
      try {
        const row = {
          report_id: data.reportId,
          agent_name: data.agentName,
          status: data.status || "completed",
          provider: data.provider || "fallback",
          fallback_reason: data.fallbackReason ?? null,
          duration_ms: data.durationMs || 0,
          input: data.input || null,
          output: data.output || null,
          error: data.error || null,
        };
        const { data: created, error } = await supabase
          .from("agent_runs")
          .insert([row])
          .select()
          .maybeSingle();
        if (!error && created) return created;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.createAgentRun(data);
  },

  async findAgentRunsByReportId(reportId) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findAgentRunsByReportId(reportId);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("agent_runs")
          .select("*")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.findAgentRunsByReportId(reportId);
  },

  // --- Duplicate Links ---
  async createDuplicateLink(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createDuplicateLink(data);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data: created, error } = await supabase
          .from("duplicate_links")
          .insert([data])
          .select()
          .maybeSingle();
        if (!error && created) return created;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.createDuplicateLink(data);
  },

  async findDuplicateLinksByReportId(reportId) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findDuplicateLinksByReportId(reportId);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("duplicate_links")
          .select("*")
          .or(`report_id.eq.${reportId},target_report_id.eq.${reportId}`);
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.findDuplicateLinksByReportId(reportId);
  },

  // --- Follow Ups ---
  async createFollowUp(data) {
    if (shouldUseInMemory()) {
      return inMemoryDb.createFollowUp(data);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data: created, error } = await supabase
          .from("follow_ups")
          .insert([data])
          .select()
          .maybeSingle();
        if (!error && created) return created;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.createFollowUp(data);
  },

  async findFollowUpByReportId(reportId) {
    if (shouldUseInMemory()) {
      return inMemoryDb.findFollowUpByReportId(reportId);
    }
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("follow_ups")
          .select("*")
          .eq("report_id", reportId)
          .maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        // Fallback
      }
    }
    return inMemoryDb.findFollowUpByReportId(reportId);
  },

  async findFollowUpByRef(ref) {
    const report = await this.findReportByRef(ref);
    if (!report) return null;
    return this.findFollowUpByReportId(report.id);
  },

  async updateFollowUp(idOrReportId, patch) {
    return inMemoryDb.updateFollowUp(idOrReportId, patch);
  },

  nextRef() {
    return inMemoryDb.nextRef();
  },

  nextWorkOrder() {
    return inMemoryDb.nextWorkOrder();
  },
};
