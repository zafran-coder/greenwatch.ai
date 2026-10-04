import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Dashboard & Analytics Endpoints", () => {
  it("GET /api/health - returns 200 ok and system metadata", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toContain("GreenWatch AI");
  });

  // Hand-checked assertion 1 against seed data:
  // Fresh = 4 (r5 New, r6 New, r7 New, r2 Verified)
  // In-Progress / Active = 4 (r1 In Progress, r3 Assigned, r4 In Progress, r10 In Progress)
  // Overdue = 2 (r1 past due, r10 past due)
  // Resolved Today = 2 (r8, r9 resolved today; r11, r12 resolved earlier)
  it("GET /api/dashboard/kpis - returns exact hand-checked KPIs against seed", async () => {
    const res = await request(app).get("/api/dashboard/kpis");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const { fresh, inProgress, overdue, resolvedToday } = res.body.data;
    expect(fresh).toBe(4);
    expect(inProgress).toBe(4);
    expect(overdue).toBe(2);
    expect(resolvedToday).toBe(2);
  });

  it("GET /api/analytics/kpis - alias returns exact KPI counts", async () => {
    const res = await request(app).get("/api/analytics/kpis");
    expect(res.status).toBe(200);
    expect(res.body.fresh).toBe(4);
    expect(res.body.overdue).toBe(2);
    expect(res.body.resolvedToday).toBe(2);
  });

  it("GET /api/dashboard/attention - returns open overdue and high priority reports", async () => {
    const res = await request(app).get("/api/dashboard/attention");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Every report in attention must not be resolved
    expect(res.body.data.every((r) => r.status !== "Resolved")).toBe(true);
  });

  // Hand-checked assertion 2 against seed data:
  // garbage = 3 (r1, r2, r8)
  // tree = 2 (r3, r10)
  // water = 2 (r4, r9)
  // park = 2 (r5, r11)
  // blocked = 2 (r6, r12)
  // plants = 1 (r7)
  // Total = 12
  it("GET /api/analytics/categories - returns exact hand-checked category counts against seed", async () => {
    const res = await request(app).get("/api/analytics/categories");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const categories = res.body.data;
    expect(categories.garbage).toBe(3);
    expect(categories.tree).toBe(2);
    expect(categories.water).toBe(2);
    expect(categories.park).toBe(2);
    expect(categories.blocked).toBe(2);
    expect(categories.plants).toBe(1);

    const sum = Object.values(categories).reduce((a, b) => a + b, 0);
    expect(sum).toBe(12);
  });

  it("GET /api/analytics/trend - returns 14-day zero-filled trend array", async () => {
    const res = await request(app).get("/api/analytics/trend");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(14);

    for (const point of res.body.data) {
      expect(point.date).toBeDefined();
      expect(point.day).toBeDefined();
      expect(typeof point.filed).toBe("number");
      expect(typeof point.resolved).toBe("number");
      expect(point.filed).toBeGreaterThanOrEqual(0);
      expect(point.resolved).toBeGreaterThanOrEqual(0);
    }
  });

  it("GET /trend - alias route returns 14-day zero-filled trend", async () => {
    const res = await request(app).get("/trend");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(14);
  });

  it("GET /api/analytics/departments - returns municipal department SLA rates and totals", async () => {
    const res = await request(app).get("/api/analytics/departments");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(4);

    const names = res.body.data.map((d) => d.name);
    expect(names).toContain("Sanitation");
    expect(names).toContain("Parks & Forestry");
    expect(names).toContain("Water Utility");
    expect(names).toContain("Public Works");

    for (const dept of res.body.data) {
      expect(dept.total).toBeGreaterThan(0);
      expect(typeof dept.rate).toBe("number");
    }
  });

  it("GET /departments - alias route returns department performance", async () => {
    const res = await request(app).get("/departments");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(4);
  });

  it("GET /api/officials - returns directory of seeded municipal officials", async () => {
    const res = await request(app).get("/api/officials");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(8);

    // Password hashes must never leak in officials directory
    for (const official of res.body.data) {
      expect(official.id).toBeDefined();
      expect(official.name).toBeDefined();
      expect(official.department).toBeDefined();
      expect(official.role).toBe("OFFICIAL");
      expect(official.passwordHash).toBeUndefined();
    }
  });

  it("GET /api/unknown-route - returns 404 with unified error format", async () => {
    const res = await request(app).get("/api/non-existent-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBeDefined();
  });
});
