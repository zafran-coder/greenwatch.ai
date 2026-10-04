import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { SEED_USERS, SEED_REPORTS } from "../src/db/seedData.js";
import { config } from "../src/config.js";

async function seedSupabase() {
  const sbUrl = process.env.SUPABASE_URL || config.supabase?.url;
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    config.supabase?.serviceRoleKey ||
    process.env.SUPABASE_ANON_KEY ||
    config.supabase?.anonKey;

  if (!sbUrl || !sbKey) {
    console.log("[Seed] Supabase URL or key not configured. Skipping Supabase REST seed.");
    return false;
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[Seed] Connecting to Supabase project at ${sbUrl}...`);

  // 1. Seed Users
  const userRows = SEED_USERS.map((u) => ({
    id: u.id,
    email: u.email.toLowerCase(),
    password_hash: u.passwordHash,
    name: u.name,
    role: u.role,
    department: u.department || null,
  }));

  const { error: userErr } = await supabase
    .from("users")
    .upsert(userRows, { onConflict: "id" });

  if (userErr) {
    console.warn("[Seed] Warning upserting users to Supabase:", userErr.message);
  } else {
    console.log(`[Seed] Successfully seeded/verified ${userRows.length} users in Supabase.`);
  }

  // 2. Seed Reports
  const reportRows = SEED_REPORTS.map((r) => ({
    id: r.id,
    ref: r.ref,
    category: r.category,
    description: r.description,
    address: r.location.address,
    area: r.location.area || "Reported via app",
    lat: r.location.lat,
    lng: r.location.lng,
    priority: r.priority,
    status: r.status,
    department: r.department,
    assignee: r.assignee || null,
    due_date: r.dueDate ? new Date(r.dueDate).toISOString() : null,
    resolved_at: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
    work_order_ref: r.workOrder || null,
    photos: r.photos || [],
    ai: r.ai || null,
    activity: (r.activity || []).map((a) => ({
      kind: a.kind,
      who: a.who,
      text: a.text,
      at: a.at || new Date().toISOString(),
      isInternal: Boolean(a.isInternal),
    })),
    created_at: new Date(r.createdAt).toISOString(),
    updated_at: new Date(r.updatedAt || r.createdAt).toISOString(),
  }));

  const { error: reportErr } = await supabase
    .from("reports")
    .upsert(reportRows, { onConflict: "id" });

  if (reportErr) {
    console.warn("[Seed] Warning upserting reports to Supabase:", reportErr.message);
  } else {
    console.log(`[Seed] Successfully seeded/verified ${reportRows.length} reports in Supabase.`);
  }

  return true;
}

async function seedPrisma() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log("[Seed] Connecting to PostgreSQL via Prisma...");

    for (const user of SEED_USERS) {
      await prisma.user.upsert({
        where: { email: user.email.toLowerCase() },
        update: {
          name: user.name,
          role: user.role,
          department: user.department,
          passwordHash: user.passwordHash,
        },
        create: {
          id: user.id,
          email: user.email.toLowerCase(),
          name: user.name,
          role: user.role,
          department: user.department,
          passwordHash: user.passwordHash,
        },
      });
    }

    for (const r of SEED_REPORTS) {
      const existing = await prisma.report.findUnique({ where: { ref: r.ref } });
      if (!existing) {
        await prisma.report.create({
          data: {
            id: r.id,
            ref: r.ref,
            category: r.category,
            description: r.description,
            address: r.location.address,
            area: r.location.area || "Reported via app",
            lat: r.location.lat,
            lng: r.location.lng,
            priority: r.priority,
            status: r.status,
            department: r.department,
            assignee: r.assignee,
            dueDate: r.dueDate ? new Date(r.dueDate) : null,
            resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
            workOrderRef: r.workOrder,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            photos: {
              create: (r.photos || []).map((url) => ({ url })),
            },
            activity: {
              create: (r.activity || []).map((a) => ({
                kind: a.kind,
                who: a.who,
                text: a.text,
                createdAt: a.at ? new Date(a.at) : new Date(),
              })),
            },
          },
        });
      }
    }

    await prisma.$disconnect();
    console.log("[Seed] Prisma PostgreSQL database seed verified.");
    return true;
  } catch (err) {
    console.warn("[Seed] Notice: Prisma seed skipped or errored:", err.message);
    return false;
  }
}

async function main() {
  console.log("=================================================");
  console.log("GreenWatch AI — Idempotent Database Seed Execution");
  console.log("=================================================");

  const supabaseSuccess = await seedSupabase();
  const prismaSuccess = await seedPrisma();

  if (!supabaseSuccess && !prismaSuccess) {
    console.log("[Seed] No remote database configured. In-memory data store will initialize with seed data on server launch.");
  }

  console.log("[Seed] All done!");
}

main().catch((err) => {
  console.error("[Seed Failure]:", err);
  process.exit(1);
});
