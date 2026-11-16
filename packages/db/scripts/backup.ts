/**
 * Backup logic: copy the MAIN database into a separate BACKUP database.
 *
 *   npm run backup               one backup now
 *   npm run backup:watch         repeat every BACKUP_INTERVAL_MINUTES
 *   npm run backup:verify        compare row counts main vs backup
 *   npm run backup:test-restore  restore newest dump into a scratch database and compare
 *
 * Each run: 1) pg_dump the main database into backups/*.dump
 *           2) pg_restore it into the backup database in ONE transaction
 *           3) compare row counts   4) keep only the newest BACKUP_KEEP dump files
 *
 * Needs the PostgreSQL client tools (pg_dump, pg_restore) in the same major version as
 * your Supabase database or newer.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pgConnection } from "../src/connection";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(repoRoot, "backups");
const keep = Number(process.env.BACKUP_KEEP ?? 10);
const intervalMinutes = Number(process.env.BACKUP_INTERVAL_MINUTES ?? 60);
const SCRATCH_DB = "gradebook_restore_test";

function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  return value;
}
// pg_dump needs a direct or session connection (not the transaction pooler).
const mainUrl = () => need("DIRECT_URL (or DATABASE_URL)", process.env.DIRECT_URL ?? process.env.DATABASE_URL);
const backupUrl = () => need("BACKUP_DATABASE_URL", process.env.BACKUP_DATABASE_URL);

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) =>
      reject(new Error(`Could not run ${cmd}. Install the PostgreSQL client tools (see README). ${e.message}`)),
    );
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (exit ${code}): ${err.trim()}`))));
  });
}

function capture(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`Could not run ${cmd}. ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} failed (exit ${code}): ${err.trim()}`))));
  });
}

/**
 * Restores a dump into `dbUrl` WITHOUT touching the `public` schema itself (no DROP/CREATE SCHEMA),
 * so it is safe on hosted databases where `public` is managed by the platform. Only our tables,
 * functions and policies inside it are replaced.
 */
async function restoreDump(file: string, dbUrl: string, replaceExisting: boolean) {
  const listing = await capture("pg_restore", ["--list", file]);
  const kept = listing.split("\n").filter((line) => !/\bSCHEMA\b.*\bpublic\b/.test(line)).join("\n");
  const listFile = `${file}.list`;
  fs.writeFileSync(listFile, kept);
  try {
    await run("pg_restore", [
      ...(replaceExisting ? ["--clean", "--if-exists"] : []),
      "--no-owner", "--no-privileges", "--single-transaction",
      "--use-list", listFile, "--dbname", dbUrl, file,
    ]);
  } finally {
    fs.rmSync(listFile, { force: true });
  }
}

async function withClient<T>(url: string, work: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client(pgConnection(url));
  await c.connect();
  try {
    return await work(c);
  } finally {
    await c.end();
  }
}

/** Makes a plain Postgres understand the Supabase roles/auth.uid() used by our policies. */
async function applyAuthStub(url: string) {
  const sql = fs.readFileSync(path.join(here, "../sql/auth_stub.sql"), "utf8");
  await withClient(url, (c) => c.query(sql));
}

async function countRows(url: string): Promise<Record<string, number>> {
  return withClient(url, async (c) => {
    const tables = await c.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations' order by 1",
    );
    const out: Record<string, number> = {};
    for (const { tablename } of tables.rows) {
      const r = await c.query<{ n: string }>(`select count(*)::text as n from public."${tablename}"`);
      out[tablename] = Number(r.rows[0].n);
    }
    return out;
  });
}

function compare(a: Record<string, number>, b: Record<string, number>): { same: boolean; lines: string[] } {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const lines = names.map((t) => `${a[t] === b[t] ? "OK  " : "DIFF"} ${t}: main=${a[t] ?? "-"} copy=${b[t] ?? "-"}`);
  return { same: names.every((t) => a[t] === b[t]), lines };
}

const dumps = () => (fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter((f) => /^gradebook_.*\.dump$/.test(f)).sort() : []);

async function backupOnce() {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `gradebook_${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

  await run("pg_dump", ["--format=custom", "--schema=public", "--no-owner", "--no-privileges", "--file", file, "--dbname", mainUrl()]);
  await applyAuthStub(backupUrl());
  await restoreDump(file, backupUrl(), true);

  const [main, copy] = await Promise.all([countRows(mainUrl()), countRows(backupUrl())]);
  const result = compare(main, copy);
  if (!result.same) throw new Error(`Backup does not match the main database!\n${result.lines.join("\n")}`);

  const all = dumps();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.unlinkSync(path.join(backupDir, old));

  console.log(`Backup OK -> ${path.basename(file)} | rows: ${JSON.stringify(main)}`);
}

async function verify() {
  const result = compare(await countRows(mainUrl()), await countRows(backupUrl()));
  console.log(result.lines.join("\n"));
  if (!result.same) throw new Error("Backup differs from the main database.");
  console.log("Backup matches the main database.");
}

async function testRestore() {
  const latest = dumps().at(-1);
  if (!latest) throw new Error("No dump files found. Run `npm run backup` first.");
  const file = path.join(backupDir, latest);

  const adminUrl = new URL(backupUrl());
  adminUrl.pathname = "/postgres";
  const scratchUrl = new URL(backupUrl());
  scratchUrl.pathname = `/${SCRATCH_DB}`;

  let restored: Record<string, number>;
  await withClient(adminUrl.toString(), async (c) => {
    await c.query(`drop database if exists ${SCRATCH_DB}`);
    await c.query(`create database ${SCRATCH_DB}`);
  });
  try {
    await applyAuthStub(scratchUrl.toString());
    await restoreDump(file, scratchUrl.toString(), false);
    restored = await countRows(scratchUrl.toString());
  } finally {
    await withClient(adminUrl.toString(), (c) => c.query(`drop database if exists ${SCRATCH_DB} with (force)`));
  }

  const result = compare(await countRows(mainUrl()), restored);
  console.log(`Restored ${latest} into a scratch database:\n${result.lines.join("\n")}`);
  if (!result.same) throw new Error("Restored copy differs from the main database (data may have changed since this dump).");
  console.log("Restore test PASSED: the restored copy matches the main database.");
}

async function watch() {
  console.log(`Backup scheduler started: every ${intervalMinutes} min, keeping ${keep} dump files.`);
  for (;;) {
    try {
      await backupOnce();
    } catch (e) {
      console.error(`Backup FAILED: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMinutes * 60_000));
  }
}

const commands: Record<string, () => Promise<void>> = {
  once: backupOnce,
  verify,
  "test-restore": testRestore,
  watch,
};

const cmd = process.argv[2] ?? "once";
if (!commands[cmd]) {
  console.error(`Unknown command "${cmd}". Use: ${Object.keys(commands).join(" | ")}`);
  process.exit(1);
}
commands[cmd]().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
