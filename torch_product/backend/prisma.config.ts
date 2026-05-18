import path from "node:path";
import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

// Explicitly load .env from the backend directory before Prisma reads any env vars
loadEnv({ path: path.join(__dirname, ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  migrate: {
    async adapter() {
      const url = process.env.DATABASE_URL ?? "";
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaPg({ connectionString: url });
    },
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
