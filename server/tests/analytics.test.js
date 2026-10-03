import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Analytics & Health Endpoints", () => {
  it("GET /api/health - returns 200 ok and system metadata", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toContain("GreenWatch AI");
  });

  it("GET /api/analytics - returns statistics, 14-day trend, dept rates, and platform summary", async () => {
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const { stats, trend14, deptRates, platform } = res.body.data;
    expect(stats.fresh).toBeDefined();
    expect(stats.active).toBeDefined();
    expect(stats.overdue).toBeDefined();

    expect(trend14).toBeInstanceOf(Array);
    expect(trend14.length).toBe(14);
    expect(trend14[0].day).toBeDefined();
    expect(trend14[0].filed).toBeDefined();
    expect(trend14[0].resolved).toBeDefined();

    expect(deptRates).toBeInstanceOf(Array);
    expect(deptRates.length).toBe(4);

    expect(platform.totalFiled).toBeGreaterThan(1000);
    expect(platform.resolvedPct).toBeGreaterThan(50);
  });

  it("GET /api/unknown-route - returns 404 with unified error format", async () => {
    const res = await request(app).get("/api/non-existent-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBeDefined();
  });
});
