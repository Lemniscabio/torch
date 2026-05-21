// Loads .env from the backend root in dev. In production (Cloud Run),
// environment variables are injected directly — dotenv is a no-op when
// no file is present.

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3001",
  JWT_SECRET: process.env.JWT_SECRET || "torch-dev-secret-change-in-production",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM || "Lemnisca <shilpa@lemnisca.bio>",
};
