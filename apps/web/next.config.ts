import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// One .env file at the repository root is shared by the whole monorepo.
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  transpilePackages: ["@gradebook/db", "@gradebook/shared"],
  serverExternalPackages: ["pg"],
  // Middleware runs in the edge runtime, which only sees variables inlined at build time.
  env: { DEV_FAKE_AUTH: process.env.DEV_FAKE_AUTH ?? "false" },
};

export default nextConfig;
