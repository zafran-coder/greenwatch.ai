import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

// Helper to obtain an authenticated official session
async function getOfficialToken() {
  const loginRes = await request(app)
    .post("/api/admin/login")
    .send({ email: "admin@greenwatch.gov", password: "Password123!" });
  return loginRes.body.token;
}

async function getOfficialCookie() {
  const loginRes = await request(app)
    .post("/api/admin/login")
    .send({ email: "admin@greenwatch.gov", password: "Password123!" });
  return loginRes.headers["set-cookie"];
}

describe("Reports & Work Orders Endpoints", () => {
  // --- 1. POST /api/reports ---
  it("POST /api/reports - Happy path: Citizen submits report, runs 7-agent AI pipeline, generates GW-XXXX and WO-XXXX", async () => {
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
    expect(res.body.data.ref).toMatch(/^GW-\d{4}$/);
    expect(res.body.data.category).toBe("tree");
    expect(res.body.data.department).toBe("Parks & Forestry");
    expect(res.body.data.priority).toBe("High");
    expect(res.body.data.workOrder).toMatch(/^WO-\d{4}$/);
    expect(["Verified", "Assigned"]).toContain(res.body.data.status);
    expect(res.body.data.dueDate).toBeDefined();
    expect(res.body.data.slaDueAt).toBeDefined();
    expect(res.body.data.activity.length).toBeGreaterThan(0);
    expect(res.body.steps).toBeDefined();
    expect(res.body.steps.length).toBe(6);
  });

  it("POST /api/reports - Concurrent submissions get distinct sequential GW-XXXX references", async () => {
    const payload1 = {
      description: "Overflowing commercial garbage dumpster in the alley behind market",
      location: { address: "Market Lane 1", area: "Sector G-8" },
      photos: [],
    };
    const payload2 = {
      description: "Severely broken waterline leaking down the middle of residential road",
      location: { address: "Market Lane 2", area: "Sector G-8" },
      photos: [],
    };

    const [res1, res2] = await Promise.all([
      request(app).post("/api/reports").send(payload1),
      request(app).post("/api/reports").send(payload2),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const ref1 = res1.body.data.ref;
    const ref2 = res2.body.data.ref;

    expect(ref1).toMatch(/^GW-\d{4}$/);
    expect(ref2).toMatch(/^GW-\d{4}$/);
    expect(ref1).not.toBe(ref2);

    const num1 = parseInt(ref1.replace("GW-", ""), 10);
    const num2 = parseInt(ref2.replace("GW-", ""), 10);
    expect(Math.abs(num1 - num2)).toBe(1);
  });

  it("GET /api/reports/:id/pipeline - does NOT expose internal provider or fallbackReason in public response", async () => {
    const createRes = await request(app)
      .post("/api/reports")
      .send({
        description: "Dead tree limb hanging dangerously over road",
        location: { address: "Street 4", area: "F-6" },
        photos: [],
      });
    expect(createRes.status).toBe(201);

    const ref = createRes.body.data.ref;
    const pipelineRes = await request(app).get(`/api/reports/${ref}/pipeline`);
    expect(pipelineRes.status).toBe(200);

    const agentRuns = pipelineRes.body.data.agentRuns;
    expect(Array.isArray(agentRuns)).toBe(true);
    for (const run of agentRuns) {
      expect(run.provider).toBeUndefined();
      expect(run.fallbackReason).toBeUndefined();
      expect(run.fallback_reason).toBeUndefined();
    }
  });

  it("POST /api/reports - Validation error: returns 400 when description is under 10 chars", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "too short",
        location: { address: "Somewhere" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("POST /api/reports - Validation error: returns 400 when address is missing", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "There is trash piled up behind the market dumpsters everywhere",
        location: { address: "" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/reports - Honeypot detection: rejects spam bot submission with 400", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: "Bot generated text attempting to spam municipal portal",
        location: { address: "123 Fake St" },
        hp: "http://spam-link.ru", // honeypot field
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("honeypot");
  });

  it("POST /api/reports - Security: stores XSS and SQL injection payloads safely as raw strings without execution", async () => {
    const maliciousDescription =
      "<script>alert('xss');window.location='https://evil.com'</script>'; DROP TABLE reports; --";
    const res = await request(app)
      .post("/api/reports")
      .send({
        description: maliciousDescription,
        location: {
          address: "100 Malicious Way'; SELECT * FROM users; --",
          area: "<img src=x onerror=alert(1)>",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe(maliciousDescription);
    expect(res.body.data.location.address).toBe("100 Malicious Way'; SELECT * FROM users; --");

    // Retrieve report to ensure stored safely without corruption
    const getRes = await request(app).get(`/api/reports/${res.body.data.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.description).toBe(maliciousDescription);
  });

  // --- 2. GET /api/reports ---
  it("GET /api/reports - Happy path: returns seeded reports list with pagination and total count", async () => {
    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBe(12);

    const first = res.body.data[0];
    expect(first.id).toBeDefined();
    expect(first.ref).toBeDefined();
    expect(first.location.address).toBeDefined();
    expect(first.ai).toBeDefined();
    expect(first.activity).toBeInstanceOf(Array);
  });

  it("GET /api/reports - Filtering by status, category, department, and search query q", async () => {
    const res = await request(app)
      .get("/api/reports")
      .query({ status: "Resolved", department: "Sanitation", category: "garbage" });

    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.status === "Resolved")).toBe(true);
    expect(res.body.data.every((r) => r.department === "Sanitation")).toBe(true);
    expect(res.body.data.every((r) => r.category === "garbage")).toBe(true);

    const searchRes = await request(app)
      .get("/api/reports")
      .query({ q: "school" });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
  });

  it("GET /api/reports - Sorting by dueDate and priority", async () => {
    const resAsc = await request(app)
      .get("/api/reports")
      .query({ sortBy: "createdAt", sortOrder: "asc" });

    expect(resAsc.status).toBe(200);
    expect(resAsc.body.data.length).toBeGreaterThan(1);
    const firstDate = new Date(resAsc.body.data[0].createdAt).getTime();
    const secondDate = new Date(resAsc.body.data[1].createdAt).getTime();
    expect(firstDate).toBeLessThanOrEqual(secondDate);
  });

  it("GET /api/reports - Pagination: limits results and calculates totalPages", async () => {
    const res = await request(app)
      .get("/api/reports")
      .query({ page: 2, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(res.body.totalPages).toBe(3);
  });

  // --- 3. GET /api/reports/:id ---
  it("GET /api/reports/:id - Happy path: retrieves by ref (GW-2041) and internal ID (r1)", async () => {
    const resByRef = await request(app).get("/api/reports/GW-2041");
    expect(resByRef.status).toBe(200);
    expect(resByRef.body.data.ref).toBe("GW-2041");
    expect(resByRef.body.data.category).toBe("garbage");

    const resById = await request(app).get("/api/reports/r1");
    expect(resById.status).toBe(200);
    expect(resById.body.data.id).toBe("r1");
  });

  it("GET /api/reports/:id - Not found: returns 404 on unknown ID", async () => {
    const res = await request(app).get("/api/reports/GW-9999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  // --- 4. GET /api/track/:reference ---
  it("GET /api/track/:reference - Citizen-safe view: never leaks internal notes or contact information", async () => {
    const token = await getOfficialToken();

    // 1. Add an internal official note to r1
    await request(app)
      .post("/api/reports/r1/activity")
      .set("Authorization", `Bearer ${token}`)
      .send({
        text: "INTERNAL NOTE: Crew supervisor phone is 555-0199. Do not disclose.",
        isInternal: true,
      });

    // 2. Fetch via public track route
    const trackRes = await request(app).get("/api/track/GW-2041");
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.data).toBeDefined();

    const data = trackRes.body.data;
    expect(data.ref).toBe("GW-2041");
    expect(data.status).toBeDefined();
    expect(data.timeline).toBeInstanceOf(Array);
    expect(data.timeline.length).toBeGreaterThan(0);
    expect(data.activity).toBeInstanceOf(Array);

    // Verify: INTERNAL NOTE is NEVER leaked to citizen
    const hasInternalNote = data.activity.some((a) =>
      a.text.includes("INTERNAL NOTE") || a.isInternal === true
    );
    expect(hasInternalNote).toBe(false);

    // Verify: No contact info or sensitive personal emails/phones are leaked
    expect(data.contactInfo).toBeUndefined();
    expect(data.reporterEmail).toBeUndefined();
    expect(data.reporterPhone).toBeUndefined();
    expect(data.reporter).toBeUndefined();
  });

  it("GET /api/track/:reference - Not found: returns 404 for non-existent ticket", async () => {
    const res = await request(app).get("/api/track/GW-0000");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  // --- 5. Official Routes Require Authentication (401 without login, 200 with it) ---
  it("Official-only routes return 401 without authentication and 200 with login", async () => {
    // 1. Status patch without auth -> 401
    const unauthStatus = await request(app)
      .patch("/api/reports/r3/status")
      .send({ status: "In Progress" });
    expect(unauthStatus.status).toBe(401);
    expect(unauthStatus.body.error.code).toBe("UNAUTHORIZED");

    // 2. Work-order patch without auth -> 401
    const unauthWorkOrder = await request(app)
      .patch("/api/reports/r3/work-order")
      .send({ assignee: "M. Alvarez" });
    expect(unauthWorkOrder.status).toBe(401);

    // 3. Activity note without auth -> 401
    const unauthActivity = await request(app)
      .post("/api/reports/r3/activity")
      .send({ text: "Official note" });
    expect(unauthActivity.status).toBe(401);

    // 4. AI decision override without auth -> 401
    const unauthAi = await request(app)
      .patch("/api/reports/r3/ai")
      .send({ priority: "Low" });
    expect(unauthAi.status).toBe(401);

    // Now login and verify all succeed (200)
    const token = await getOfficialToken();

    const authStatus = await request(app)
      .patch("/api/reports/r3/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "In Progress" });
    expect(authStatus.status).toBe(200);

    const authWorkOrder = await request(app)
      .patch("/api/reports/r3/work-order")
      .set("Authorization", `Bearer ${token}`)
      .send({ assignee: "J. Okafor" });
    expect(authWorkOrder.status).toBe(200);

    const authActivity = await request(app)
      .post("/api/reports/r3/activity")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Official inspection note" });
    expect(authActivity.status).toBe(200);

    const authAi = await request(app)
      .patch("/api/reports/r3/ai")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "Medium", reason: "Reassessed site conditions" });
    expect(authAi.status).toBe(200);
  });

  it("Official-only routes succeed when using signed httpOnly cookie", async () => {
    const cookie = await getOfficialCookie();

    const res = await request(app)
      .post("/api/reports/r1/activity")
      .set("Cookie", cookie)
      .send({ text: "Signed cookie authenticated note" });

    expect(res.status).toBe(200);
    const lastAct = res.body.data.activity[res.body.data.activity.length - 1];
    expect(lastAct.text).toBe("Signed cookie authenticated note");
  });

  // --- 6. Work Orders & State Machine ---
  it("Work orders - Assigning official auto-promotes 'New' report to 'Assigned'", async () => {
    const token = await getOfficialToken();

    // r5 is seeded with status 'New'
    const getBefore = await request(app).get("/api/reports/r5");
    expect(getBefore.body.data.status).toBe("New");

    const res = await request(app)
      .patch("/api/reports/r5/work-order")
      .set("Authorization", `Bearer ${token}`)
      .send({ assignee: "M. Alvarez" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Assigned");
    expect(res.body.data.assignee).toBe("M. Alvarez");

    // Verifies ActivityLog entry written in same transaction
    const lastAct = res.body.data.activity[res.body.data.activity.length - 1];
    expect(lastAct.text).toContain("Assigned to M. Alvarez");
  });

  it("Work orders - Updating SLA date syncs dueDate and slaDueAt, logging activity", async () => {
    const token = await getOfficialToken();
    const newSla = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

    const res = await request(app)
      .patch("/api/reports/r1/work-order")
      .set("Authorization", `Bearer ${token}`)
      .send({ dueDate: newSla });

    expect(res.status).toBe(200);
    expect(res.body.data.dueDate).toBe(newSla);
    expect(res.body.data.slaDueAt).toBe(newSla);

    const lastAct = res.body.data.activity[res.body.data.activity.length - 1];
    expect(lastAct.text).toContain("SLA due date updated");
  });

  it("State machine - Legal transitions: Assigned -> In Progress -> Resolved sets resolvedAt and calls follow-up hook", async () => {
    const token = await getOfficialToken();

    // r3 is seeded as Assigned
    const step1 = await request(app)
      .patch("/api/reports/r3/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "In Progress" });
    expect(step1.status).toBe(200);
    expect(step1.body.data.status).toBe("In Progress");

    // In Progress -> Resolved
    const step2 = await request(app)
      .patch("/api/reports/r3/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Resolved" });

    expect(step2.status).toBe(200);
    expect(step2.body.data.status).toBe("Resolved");
    expect(step2.body.data.resolvedAt).toBeDefined();

    // Follow-up hook activity recorded
    const followUpAct = step2.body.data.activity.find(
      (a) => a.who === "Follow-up Agent" && a.text.includes("Citizen notified")
    );
    expect(followUpAct).toBeDefined();
  });

  it("State machine - Illegal moves return 409 Conflict: New -> Resolved", async () => {
    const token = await getOfficialToken();

    // r6 has status New; jumping straight to Resolved is illegal
    const res = await request(app)
      .patch("/api/reports/r6/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Resolved" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ILLEGAL_STATUS_TRANSITION");
    expect(res.body.error.message).toContain("Illegal status transition");
  });

  it("State machine - Illegal moves return 409 Conflict: In Progress -> Verified", async () => {
    const token = await getOfficialToken();

    // r1 is In Progress; reverting to Verified is illegal
    const res = await request(app)
      .patch("/api/reports/r1/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Verified" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ILLEGAL_STATUS_TRANSITION");
  });

  it("State machine - Illegal moves return 409 Conflict: Resolved -> New", async () => {
    const token = await getOfficialToken();

    // r8 is Resolved; moving back to New is illegal (only In Progress allowed for dispute)
    const res = await request(app)
      .patch("/api/reports/r8/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "New" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ILLEGAL_STATUS_TRANSITION");
  });

  it("PATCH /api/reports/:id - Returns 404 for unknown report ID", async () => {
    const token = await getOfficialToken();
    const res = await request(app)
      .patch("/api/reports/r9999")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "In Progress" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  // --- 7. Activity Logs ---
  it("GET /api/reports/:id/activity - Unauthenticated request excludes internal notes", async () => {
    const token = await getOfficialToken();

    // Add internal note
    await request(app)
      .post("/api/reports/r1/activity")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Confidential internal shift plan", isInternal: true });

    // Request as public unauthenticated user
    const publicRes = await request(app).get("/api/reports/r1/activity");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.some((a) => a.text.includes("Confidential internal shift plan"))).toBe(false);

    // Request as authenticated official
    const officialRes = await request(app)
      .get("/api/reports/r1/activity")
      .set("Authorization", `Bearer ${token}`);
    expect(officialRes.status).toBe(200);
    expect(officialRes.body.data.some((a) => a.text.includes("Confidential internal shift plan"))).toBe(true);
  });

  it("POST /api/reports/:id/activity - Returns 400 when activity text is empty", async () => {
    const token = await getOfficialToken();
    const res = await request(app)
      .post("/api/reports/r1/activity")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // --- 8. Follow-up Evaluation ---
  it("POST /api/reports/:id/follow-up - Triggers follow-up agent evaluation", async () => {
    const res = await request(app).post("/api/reports/r1/follow-up");
    expect(res.status).toBe(200);
    expect(res.body.data.evaluation).toBeDefined();
    expect(res.body.data.report).toBeDefined();
  });

  it("POST /api/reports/:id/follow-up - Returns 404 for unknown report", async () => {
    const res = await request(app).post("/api/reports/r9999/follow-up");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  // --- 9. Rate Limiting (429 Test) ---
  it("Rate Limiter - Returns 429 Too Many Requests when rate limit threshold exceeded", async () => {
    // Hit test rate limiter (threshold: 3 requests)
    const r1 = await request(app).get("/test/rate-limit");
    expect(r1.status).toBe(200);

    const r2 = await request(app).get("/test/rate-limit");
    expect(r2.status).toBe(200);

    const r3 = await request(app).get("/test/rate-limit");
    expect(r3.status).toBe(200);

    // 4th request must be throttled with 429
    const r4 = await request(app).get("/test/rate-limit");
    expect(r4.status).toBe(429);
    expect(r4.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  // --- 10. Security: No stack traces leaked ---
  it("Security - Error responses never contain stack traces", async () => {
    const res = await request(app).get("/api/reports/GW-INVALID");
    expect(res.status).toBe(404);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error.stack).toBeUndefined();
  });
});
