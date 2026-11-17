# Assessments and student groups

## Changes

- `student_groups(group_id, group_name)` stores distinct group names. `students.group_id` is a required foreign key; the old `students.group_name` column is removed after backfill.
- `assessments(assessment_id, course_id, assessment_name)` stores course assessments independently of grades. Names are unique within a course.
- `grades.assessment_id` replaces `grades.assessment_name`. A composite foreign key also checks that the assessment belongs to the grade's course. The enrollment foreign key and 0–100 score check remain.
- Audit assessment names remain historical snapshots; existing audit entries are unchanged.
- Existing names are preserved exactly. Case/space variants are not automatically merged.
- The teacher's Add assessment form now persists a database record even without any grades.
- RLS protects both new tables. Teachers create/update assessments only in their own courses. Students read assessments only in enrolled courses and cannot write them. Group names are visible only for students the current user can see; administrators manage groups.

## Apply on your computer (PowerShell / VS Code)

1. Stop the development server with Ctrl+C.
2. Extract the supplied archive into the repository root, merging `apps`, `packages`, and `docs`. It contains changed files only, not a replacement repository. Keep your existing `.env`.
3. Back up the database before applying the migration (Supabase backup or `pg_dump` using the direct/session connection). The existing `npm run backup` can be used if its PostgreSQL tools and backup database have already been configured.
4. From the repository root run:

```powershell
npm install
npm run db:generate
npm run typecheck
npm run db:migrate
npm run dev
```

`db:migrate` uses DIRECT_URL (or DATABASE_URL fallback) from the root `.env` and records the migration in Prisma history. Do not also execute the SQL manually. Do not use `db push`, `migrate reset`, or `db:seed:clear` for this update. No reseeding is needed.

If any command fails, stop and inspect the error before continuing. Do not mark a failed migration as applied without investigating.

## Check after applying

- Open a teacher's course. Existing students, group names and scores should still appear.
- Add a uniquely named assessment without entering any scores. Refresh: the column should remain.
- Enter a grade, refresh, and inspect the student's page.
- Inspect Supabase Table Editor: `student_groups`, `assessments`, `students.group_id`, and `grades.assessment_id` should exist.
- Confirm existing student, grade and audit counts match the pre-migration counts.

## Commit after verification

```powershell
git status
git add apps/web/src/app/teacher packages/db/prisma packages/db/src/queries.ts packages/db/scripts/seed.ts packages/db/test/roles.test.ts docs/NORMALIZATION.md
git commit -m "Normalize assessments and student groups"
git push
```

Supabase stores the database changes; GitHub stores the source and migration files. Neither automatically updates the other.

## Validation performed before delivery

- TypeScript typecheck passed for all workspaces.
- Production Next.js build passed.
- 12 shared unit tests passed.
- The 32 PostgreSQL integration tests were updated, but skipped here because TEST_DATABASE_URL was not available.
- The migration was separately executed with both earlier migrations and sample legacy data in PGlite (embedded PostgreSQL). Verified preserved grades/group assignments, empty assessments, teacher/student RLS, duplicate assessment rejection, and cross-course/nonexistent-group foreign key rejection. This does not replace a live Supabase check.
