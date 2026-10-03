import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Reports Endpoints", () => {
  it("POST /api/reports - Citizen submits new report: runs AI pipeline, generates GW-XXXX and WO-XXXX", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "A huge branch snapped off the tree and is hanging dangerously over the school entrance",
        location: {
          address: "Maple Avenue & 2nd St",
          area: "Bloomfield",
          lat: 40.72,
          lng: -74.0,
        },
        photos: ["https://example.com/tree-branch.jpg"],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ref).toMatch(/^GW-\d+$/);
    expect(res.body.data.category).toBe("tree");
    expect(res.body.data.department).toBe("Parks & Forestry");
    expect(res.body.data.priority).toBe("High");
    expect(res.body.data.workOrder).toMatch(/^WO-\d+$/);
    expect(res.body.data.status).toBe("Assigned");
    expect(res.body.data.activity.length).toBeGreaterThan(0);
    expect(res.body.steps).toBeDefined();
    expect(res.body.steps.length).toBe(6);
  });

  it("POST /api/reports - returns 400 with VALIDATION_ERROR on short description", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "short",
        location: { address: "Somewhere" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("POST /api/reports - returns 400 when location address is missing", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "There is trash piled up behind the shops everywhere",
        location: { address: "" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/reports - returns all seeded reports matching frontend format", async () => {
    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(12);

    const first = res.body.data[0];
    expect(first.id).toBeDefined();
    expect(first.ref).toBeDefined();
    expect(first.location).toBeDefined();
    expect(first.location.address).toBeDefined();
    expect(first.ai).toBeDefined();
    expect(first.activity).toBeInstanceOf(Array);
  });

  it("GET /api/reports - filters by status, department, and category", async () => {
    const res = await request(app)
      .get("/api/reports")
      .query({ status: "Resolved", department: "Sanitation" });

    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.status === "Resolved")).toBe(true);
    expect(res.body.data.every((r) => r.department === "Sanitation")).toBe(true);
  });

  it("GET /api/reports/:id - retrieves report by reference ID (GW-2041)", async () => {
    const res = await request(app).get("/api/reports/GW-2041");
    expect(res.status).toBe(200);
    expect(res.body.data.ref).toBe("GW-2041");
    expect(res.body.data.category).toBe("garbage");
  });

  it("GET /api/reports/:id - retrieves report by internal ID (r1)", async () => {
    const res = await request(app).get("/api/reports/r1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("r1");
  });

  it("GET /api/reports/:id - returns 404 for unknown ID", async () => {
    const res = await request(app).get("/api/reports/GW-9999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("PATCH /api/reports/:id - updates status, assignee, and logs human activity", async () => {
    const res = await request(app)
      .patch("/api/reports/r2")
      .send({
        status: "In Progress",
        assignee: "M. Alvarez",
        note: "Dispatched cleaning truck.",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("In Progress");
    expect(res.body.data.assignee).toBe("M. Alvarez");

    const lastAct = res.body.data.activity[res.body.data.activity.length - 1];
    expect(lastAct.kind).toBe("human");
    expect(lastAct.text).toContain("Dispatched cleaning truck.");
  });

  it("PATCH /api/reports/:id - marking Resolved triggers Follow-up Agent activity", async () => {
    const res = await request(app)
      .patch("/api/reports/r3")
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Resolved");
    expect(res.body.data.resolvedAt).toBeDefined();

    const followUpAct = res.body.data.activity.find(
      (a) => a.who === "Follow-up Agent"
    );
    expect(followUpAct).toBeDefined();
    expect(followUpAct.text).toContain("Citizen notified and asked to confirm the fix.");
  });

  it("POST /api/reports/:id/activity - appends official note", async () => {
    const res = await request(app)
      .post("/api/reports/r1/activity")
      .send({
        who: "Inspector Dave",
        text: "Checked perimeter fence.",
      });

    expect(res.status).toBe(200);
    const lastAct = res.body.data.activity[res.body.data.activity.length - 1];
    expect(lastAct.who).toBe("Inspector Dave");
    expect(lastAct.text).toBe("Checked perimeter fence.");
  });

  it("POST /api/reports/:id/follow-up - triggers follow-up agent evaluation", async () => {
    const res = await request(app).post("/api/reports/r1/follow-up");
    expect(res.status).toBe(200);
    expect(res.body.data.evaluation).toBeDefined();
    expect(res.body.data.report).toBeDefined();
  });
});
