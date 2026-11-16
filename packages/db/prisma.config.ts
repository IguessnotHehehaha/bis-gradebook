import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, db pull ...) uses the DIRECT connection.
// The running app uses DATABASE_URL (see src/client.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed.ts",
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://missing:missing@localhost:5432/missing", // lets `prisma generate` run before .env exists
  },
});
