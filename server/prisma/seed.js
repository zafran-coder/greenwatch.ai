import { PrismaClient } from "@prisma/client";
import { SEED_USERS, SEED_REPORTS } from "../src/db/seedData.js";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Starting GreenWatch AI database seed...");

  // Seed Users
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        department: user.department,
        passwordHash: user.passwordHash,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        passwordHash: user.passwordHash,
      },
    });
  }
  console.log(`[Seed] Seeded ${SEED_USERS.length} users.`);

  // Seed Reports
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
          ai: r.ai
            ? {
                create: {
                  severity: r.ai.severity,
                  reason: r.ai.reason,
                  evidence: r.ai.evidence,
                  confidence: r.ai.confidence,
                  similarCount: r.ai.similar?.count || 0,
                  similarIds: JSON.stringify(r.ai.similar?.ids || []),
                },
              }
            : undefined,
          activity: {
            create: (r.activity || []).map((a) => ({
              kind: a.kind,
              who: a.who,
              text: a.text,
              createdAt: a.at ? new Date(a.at) : new Date(),
            })),
          },
          workOrder: r.workOrder
            ? {
                create: {
                  ref: r.workOrder,
                  department: r.department,
                  status: r.status === "Resolved" ? "Completed" : "In Progress",
                  assignedTo: r.assignee,
                  dueDate: r.dueDate ? new Date(r.dueDate) : null,
                },
              }
            : undefined,
        },
      });
    }
  }
  console.log(`[Seed] Seeded ${SEED_REPORTS.length} reports.`);
  console.log("[Seed] Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("[Seed Error]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
