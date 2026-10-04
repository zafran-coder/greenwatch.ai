import { beforeEach } from "vitest";
import { inMemoryDb } from "../src/db/client.js";
import { config } from "../src/config.js";

// Ensure test environment has standard admin credentials for test suites
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@greenwatch.gov";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password123!";
config.admin.email = process.env.ADMIN_EMAIL;
config.admin.password = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  inMemoryDb.reset();
});

