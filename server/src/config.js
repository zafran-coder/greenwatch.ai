import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://greenwatch:greenwatch_secret@localhost:5432/greenwatch_db?schema=public",
  jwt: {
    secret: process.env.JWT_SECRET || "greenwatch_dev_jwt_secret_key_random_secure_32chars_min",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || null,
  },
  supabase: {
    url: process.env.SUPABASE_URL || "https://kbrwjxonrllfysjorzvz.supabase.co",
    anonKey:
      process.env.SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticndqeG9ucmxsZnlzam9yenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMTY5NTIsImV4cCI6MjEwNjU5Mjk1Mn0.foPpz2s69djxIAoxwb5XYvjOTuUj5RP_I9BlkEyOpa4",
  },
};
