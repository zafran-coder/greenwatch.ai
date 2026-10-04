import { app } from "./app.js";
import { config } from "./config.js";
import { refreshSupabaseStatus } from "./db/client.js";

await refreshSupabaseStatus().catch((err) => {
  console.warn("[Server] Initial database connectivity check notice:", err.message);
});

const server = app.listen(config.port, () => {
  console.log(`[GreenWatch AI Server] Running on http://localhost:${config.port}`);
  console.log(`[Environment] ${config.nodeEnv}`);
});

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("[Server] Closed.");
    process.exit(0);
  });
});
