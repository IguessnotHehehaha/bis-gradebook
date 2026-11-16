import { defineConfig } from "vitest/config";

// The role/security tests run against a REAL PostgreSQL database.
// Set TEST_DATABASE_URL to an empty database that already has the migrations applied.
// Without it the database tests are skipped.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    fileParallelism: false,
    testTimeout: 30000,
  },
});
