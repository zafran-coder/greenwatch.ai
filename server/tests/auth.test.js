import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Auth Endpoints", () => {
  it("POST /api/auth/login - succeeds with valid seeded official credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "m.alvarez@greenwatch.gov", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("m.alvarez@greenwatch.gov");
    expect(res.body.data.user.role).toBe("OFFICIAL");
  });

  it("POST /api/auth/login - returns 401 on incorrect password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "m.alvarez@greenwatch.gov", password: "WrongPassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("UNAUTHORIZED");
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
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("new.official@greenwatch.gov");
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

  it("GET /api/auth/me - returns user profile with valid Bearer token", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@greenwatch.gov", password: "Password123!" });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe("admin@greenwatch.gov");
    expect(meRes.body.data.user.role).toBe("ADMIN");
  });

  it("GET /api/auth/me - returns 401 when token is missing", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
