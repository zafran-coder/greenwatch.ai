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
    this.reports = JSON.parse(JSON.stringify(SEED_REPORTS));
  }

  // --- Users ---
  async findUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  async findUserById(id) {
    return this.users.find((u) => u.id === id) || null;
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
  async findReports({ status, category, priority, department, q, skip = 0, take = 50 } = {}) {
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
    const report = {
      ...data,
      id: data.id || `r${Date.now().toString(36)}`,
      createdAt: data.createdAt || now,
      updatedAt: now,
      resolvedAt: data.resolvedAt || null,
      activity: data.activity || [],
      photos: data.photos || [],
      ai: data.ai || null,
    };
    this.reports.unshift(report);
    return report;
  }

  async updateReport(id, patch, activityEntry = null) {
    const idx = this.reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const current = this.reports[idx];
    const now = new Date().toISOString();

    const updated = {
      ...current,
      ...patch,
      updatedAt: now,
      activity: activityEntry
        ? [...current.activity, { ...activityEntry, at: now }]
        : current.activity,
    };

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

  // --- ID Generator Helpers ---
  nextRef() {
    const max = this.reports.reduce(
      (m, r) => Math.max(m, parseInt(String(r.ref || "").replace(/\D/g, ""), 10) || 0),
      2000
    );
    return `GW-${max + 1}`;
  }

  nextWorkOrder() {
    const max = this.reports.reduce(
      (m, r) => Math.max(m, parseInt(String(r.workOrder || "").replace(/\D/g, ""), 10) || 0),
      1180
    );
    return `WO-${max + 1}`;
  }
}

export const inMemoryDb = new InMemoryStore();

// Format a Prisma report entity into the frontend report shape
function formatPrismaReport(r) {
  if (!r) return null;
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
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
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
          at: a.createdAt.toISOString(),
        }))
      : [],
  };
}

// Format a Supabase report row into the frontend report shape
function formatSupabaseReport(r) {
  if (!r) return null;
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
    dueDate: r.due_date ? new Date(r.due_date).toISOString() : null,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    workOrder: r.work_order_ref || null,
    ai: r.ai || null,
    activity: Array.isArray(r.activity) ? r.activity : [],
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

  async findUserByEmail(email) {
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
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .ilike("ref", ref.trim())
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

        if (!error && created) {
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
              at: new Date().toISOString(),
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

  nextRef() {
    return inMemoryDb.nextRef();
  },

  nextWorkOrder() {
    return inMemoryDb.nextWorkOrder();
  },
};
