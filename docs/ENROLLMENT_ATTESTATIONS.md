# Student enrollment and two attestations

Based on repository commit cf7e5f1 (current main when prepared).

## Behaviour

- Students see the course catalogue, teacher and semester, and can enroll themselves.
- Student id is resolved from the authenticated account. The form sends course id only.
- The enrollment primary key rejects duplicate registration, including concurrent attempts. No capacity, prerequisites, deadlines, withdrawal or approval workflow is introduced.
- Existing enrollments are respected. Newly enrolled courses appear immediately, even without grades.
- Teachers enter Attestation 1 and Attestation 2 independently, each 0–100 with up to two decimals, for enrolled students in their own courses.
- These are explicit teacher-entered course scores, not automatic averages of ordinary assignments. Existing assignments and grades are unchanged.
- Average = (Attestation 1 + Attestation 2) / 2, rounded to two decimal places. If either mark is missing, show a dash. A score of zero is a real score.
- English and Russian labels are included. Existing themes and team UI changes are retained.
- Each attestation row stores its last editor and update timestamp. There is no separate revision-history UI for attestations.

## Database

New `attestation_results` table:

| Column | Meaning |
| --- | --- |
| student_id, course_id | Composite foreign key to enrollment |
| attestation_number | 1 or 2 only |
| score | Numeric 0–100 |
| changed_by | Last editor, FK to app_users |
| updated_at | Last save time |

Primary key: (student_id, course_id, attestation_number). One result per student/course/period. Average is derived, not redundantly stored.

RLS: students read their own results; course teachers read/write their course; admins read/write all. Anonymous access is denied. Students may insert only their own enrollment, and still cannot edit/delete enrollments. Students can read all course metadata to choose a course, but not others' grades or enrollments.

## Apply in VS Code

1. Stop the development server (Ctrl+C).
2. Ensure the latest main has been pulled. The base includes the earlier normalization and the team's theme/locale updates.
3. Extract the update ZIP into the repository root, merging folders and replacing the included files. The ZIP contains changed files only and no credentials. Keep your existing `.env`.
4. Keep a current backup. This migration is additive and does not change existing grades/groups.
5. Run from the root, one command at a time:

```powershell
npm install
npm run db:generate
npm run typecheck
npm run db:migrate
npm run dev
```

The root `.env` must point to the intended Supabase project. `db:migrate` applies pending migrations using DIRECT_URL and records them in Prisma history. Do not also run migration SQL manually. Do not use migrate reset, db push, or db:seed:clear for this update. No reseeding is required.

If a command fails, stop and inspect the error.

## Manual acceptance checks

1. As a student, open My grades and find Course registration. Pick a course not yet joined; Enroll should become Enrolled.
2. Refresh: enrollment remains. Existing enrollments are already marked; no duplicate rows should appear.
3. As the course teacher, open the course. The student appears in the roster and new attestation table.
4. Enter 80 for A1, Save: average is a dash. Enter 90 for A2, Save: average is 85.
5. Refresh, then sign in as the student: the same marks and average appear.
6. Changing A1 to zero must produce an average of 45, not a dash.
7. Negative scores and scores over 100 must be refused.
8. As another teacher, the course and results remain inaccessible. Students cannot edit attestations.
9. Existing grades, course screens, themes and language switching should continue working.

## Show in Supabase

Open Table Editor: `enrollments` shows new registrations, `attestation_results` shows saved A1/A2 scores. The computed mean is visible on the website, or via SQL Editor:

```sql
SELECT e.student_id, e.course_id,
       MAX(a.score) FILTER (WHERE a.attestation_number = 1) AS attestation_1,
       MAX(a.score) FILTER (WHERE a.attestation_number = 2) AS attestation_2,
       CASE WHEN COUNT(a.score) = 2 THEN ROUND(AVG(a.score), 2) END AS average
FROM public.enrollments e
LEFT JOIN public.attestation_results a
  ON a.student_id = e.student_id AND a.course_id = e.course_id
GROUP BY e.student_id, e.course_id
ORDER BY e.course_id, e.student_id;
```

SQL Editor normally runs with administrative privileges. For the demonstration filter to a test student if necessary.

## Validation before delivery

- All workspace TypeScript checks passed.
- Production Next.js build passed.
- Shared tests: 16 passed, including missing marks, zero, rounding and score/period validation.
- Database integration tests were extended for self-enrollment and attestations; they require TEST_DATABASE_URL to a disposable PostgreSQL database and were skipped in this environment.
- All migration SQL was separately executed in PGlite (embedded PostgreSQL). Verified student course discovery, self-enrollment, duplicate/forged enrollment rejection, teacher/student permissions, attestation insert/update/read, score/period constraints, enrollment FK and arithmetic means. This is not a live Supabase test.

## GitHub after checks

Review `git status` and stage the source changes, the new migration, and this guide. Keep `.env`, credentials and CSV backups out of Git.

```powershell
git add apps/web/src/app/student apps/web/src/app/teacher apps/web/src/lib/i18n/en.ts apps/web/src/lib/i18n/ru.ts packages/db/prisma packages/db/src packages/db/scripts/seed.ts packages/db/test/roles.test.ts packages/shared/src docs/ENROLLMENT_ATTESTATIONS.md
git commit -m "Add student self-enrollment and course attestations"
git push
```

GitHub stores code and migration files; Supabase stores data. Git push does not migrate Supabase. Teammates sharing the already migrated database still need npm install and npm run db:generate after pulling.
