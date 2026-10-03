import { beforeEach } from "vitest";
import { inMemoryDb } from "../src/db/client.js";

beforeEach(() => {
  inMemoryDb.reset();
});
