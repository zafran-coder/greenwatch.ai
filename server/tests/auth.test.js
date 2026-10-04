import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Admin & Auth Endpoints", () => {
  it("POST /api/admin/login - succeeds with environment admin credentials and sets signed cookie", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin@greenwatch.gov", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("admin@greenwatch.gov");
    expect(res.body.user.role).toBe("ADMIN");

    // Verify signed httpOnly cookie is set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes("admin_token="))).toBe(true);
    expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.includes("SameSite=Lax"))).toBe(true);
  });

  it("POST /api/admin/login - returns 400 with VALIDATION_ERROR on missing fields", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/admin/login - returns 401 on incorrect credentials", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin@greenwatch.gov", password: "WrongAdminPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/admin/logout - clears admin_token cookie", async () => {
    const res = await request(app).post("/api/admin/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers["set-cookie"];
    expect(cookies.some((c) => c.includes("admin_token=;"))).toBe(true);
  });

  it("GET /api/admin/me - returns admin profile when authenticated with cookie", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin@greenwatch.gov", password: "Password123!" });

    const cookie = loginRes.headers["set-cookie"];

    const meRes = await request(app)
      .get("/api/admin/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("admin@greenwatch.gov");
    expect(meRes.body.user.role).toBe("ADMIN");
  });

  it("GET /api/admin/me - returns admin profile when authenticated with Bearer token", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin@greenwatch.gov", password: "Password123!" });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("admin@greenwatch.gov");
    expect(meRes.body.user.role).toBe("ADMIN");
  });

  it("GET /api/admin/me - returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/admin/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/config - returns { adminRequired: true }", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body.adminRequired).toBe(true);
  });

  it("POST /api/auth/login - succeeds with seeded official credentials and sets cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "m.alvarez@greenwatch.gov", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("m.alvarez@greenwatch.gov");
    expect(res.body.user.role).toBe("OFFICIAL");
  });

  it("POST /api/auth/register - registers new user successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "New Official",
        email: "new.official@greenwatch.gov",
        password: "SecurePassword123!",
        role: "OFFICIAL",
        department: "Sanitation",
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("new.official@greenwatch.gov");
  });

  it("POST /api/auth/register - returns 409 when registering duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate",
        email: "m.alvarez@greenwatch.gov",
        password: "Password123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});
