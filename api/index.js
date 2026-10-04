import { app } from "../server/src/app.js";

const requiredEnv = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "STORAGE_DRIVER",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "NODE_ENV"
];

const missingEnv = requiredEnv.filter((v) => !process.env[v]);
if (missingEnv.length > 0) {
  console.log("MISSING ENV VARS:", missingEnv.join(", "));
}

export default app;
