# Electronic Gradebook (TypeScript monorepo)

Next.js + React web app, Prisma ORM, Supabase (Postgres + Auth). Roles (student / teacher / admin) are enforced inside the database with Row Level Security.
Plain-language requirements: [docs/USER_STORIES.md](docs/USER_STORIES.md).

```
apps/web         Next.js app (screens, login, server actions)
packages/db      Prisma schema, migrations (incl. RLS), queries, seed, backup scripts, DB tests
packages/shared  Rules shared by screens and server (pass mark 50, score validation) + tests
docs/            User stories
```

## Setup A — with Supabase (the real setup)

1. Create a Supabase project. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL` pooled connection string, `DIRECT_URL` direct/session string (migrations and backups need the direct one)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project settings → API)
2. `npm install`
3. `npm run db:migrate` (creates tables, roles, policies)
4. `npm run db:seed` (sample data + a Supabase login for everyone; password is `SEED_PASSWORD`, default `Gradebook123!`)
5. `npm run dev` → http://localhost:3000

Demo logins: `admin@univ.kz`, `a.serikova@univ.kz` (teacher), `student001@univ.kz` … `student020@univ.kz`.

## Setup B — local only, no Supabase

For development without an account.

1. `docker compose --profile local up -d local_db` (Postgres on port 5432), and set both URLs in `.env` to it, e.g. `postgresql://postgres:postgres@localhost:5432/gradebook`.
2. In `.env` set `DEV_FAKE_AUTH=true`.
3. `npm install && npm run db:migrate && npm run db:seed && npm run dev`
4. The login page then shows a "sign in as" list. This shortcut is **development only** and is hard-disabled in production builds.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Run / build / serve the web app |
| `npm test` | Unit tests; database role tests run when `TEST_DATABASE_URL` points at a scratch Postgres |
| `npm run typecheck` | Type-check all packages |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` / `db:seed:clear` | Add / wipe sample data |
| `npm run backup` | One backup of the `public` schema into `backups/` and the backup database |
| `npm run backup:watch` | Repeat every `BACKUP_INTERVAL_MINUTES`, keep `BACKUP_KEEP` files |
| `npm run backup:verify` | Compare live and backup row counts |
| `npm run backup:test-restore` | Restore the newest dump into a throw-away database and compare |

The backup database (`BACKUP_DATABASE_URL`) comes from `docker compose up -d backup_db`.

## How security works

- Every table has Row Level Security. Students read only their rows; teachers read and write only courses they teach and students enrolled in them; admins do everything; the audit log is append-only.
- The app runs each query "as" the signed-in user (`withUser`: sets the user id and switches to the `authenticated` role for that transaction), so the database makes the decision.
- Anonymous access (the public Supabase key) has no privileges.
- A grade needs an enrollment (composite foreign key), a score 0–100 (check constraint), and is unique per student/course/assessment.

## Things to know

- **Migrations are hand-written** in Prisma's format, because the environment they were made in could not run `prisma migrate`. On your machine run `npx prisma migrate status` inside `packages/db`; if it reports drift, tell the team.
- **Backups need `pg_dump`/`pg_restore` at least as new as the server** (Supabase is on a recent major version) and a direct/session connection, not the transaction pooler.
- **Not yet tested against a live Supabase project**: sign-in, session cookies, middleware. Everything else was run against real PostgreSQL 16. Docker files were not executed.
- Known gaps: no user-management screen, no password reset, no screen for the audit log.
