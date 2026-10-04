import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173",
  cookieSecret:
    process.env.COOKIE_SECRET || "greenwatch_cookie_secret_secure_signing_key_32chars",
  admin: {
    email: process.env.ADMIN_EMAIL || "admin@greenwatch.gov",
    password: process.env.ADMIN_PASSWORD || null,
  },
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://greenwatch:greenwatch_secret@localhost:5432/greenwatch_db?schema=public",
  jwt: {
    secret: process.env.JWT_SECRET || "greenwatch_dev_jwt_secret_key_random_secure_32chars_min",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  },
  cronSecret: process.env.CRON_SECRET || "greenwatch_cron_secret",
  supabase: {
    url: process.env.SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "evidence",
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || "supabase",
  },
};
