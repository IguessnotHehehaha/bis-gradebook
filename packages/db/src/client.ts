import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { pgConnection } from "./connection";

const g = globalThis as unknown as { __gradebookPrisma?: PrismaClient };

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  return new PrismaClient({ adapter: new PrismaPg(pgConnection(url)) });
}

function instance(): PrismaClient {
  return (g.__gradebookPrisma ??= create());
}

/**
 * Prisma client for trusted server code (seed, sign-in lookup, backups). It connects as the
 * database owner and therefore BYPASSES row level security. Application code that acts for a
 * signed-in person must use `withUser()` instead.
 *
 * Created lazily so that building the app does not need a database.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = instance();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
