# Electronic Gradebook — User Stories

Written for people who do not program. Each story says **who** wants **what** and **why**, then how we know it works.
"Done" means it is built and has been checked; "Planned" means it is not built yet.

## 1. Who uses the gradebook

| Person | In plain words | What they can do |
|---|---|---|
| **Student** | Someone taking courses | Look at their own grades. Nothing else. |
| **Teacher** | Someone who teaches courses | Enter and correct grades, but only in their own courses and only for students enrolled in them. |
| **Administrator** | Office staff | See everything, enroll students in courses. |

The rules are enforced by the database itself, not only by the screens. Even if someone found a way around a screen, the database would still refuse.

## 2. Stories

### A. Signing in

**US-01 · Sign in.** As any user, I want to sign in with my email and password so that only I can see my information.
- *Given* I am not signed in, *when* I open the site, *then* I am sent to the sign-in page.
- *Given* I enter correct details, *then* I land on my own home page.
- Status: Done (uses Supabase accounts).

**US-02 · Land on the right page.** As a user, I want to arrive on a page made for my role, so I do not have to search for things.
- Student → "My grades". Teacher → "My courses". Administrator → "Administration".
- Status: Done.

**US-03 · Sign out.** As a user, I want to sign out so nobody else can use my session on a shared computer.
- Status: Done.

### B. Student

**US-04 · See my grades.** As a student, I want to see my grades grouped by course, with each course's average, so I know where I stand.
- *Then* I see every course I am enrolled in, each score with its date, and the average.
- Status: Done.

**US-05 · Notice weak results.** As a student, I want results below 50 to be clearly marked, so I know where I need help.
- *Then* the score is shown in red with a "Below 50" label (not only a colour).
- Status: Done.

**US-06 · Not see others, not change anything.** As a student, I must not be able to see other students' grades or change any mark.
- *Then* my page has no input boxes or buttons, and the database refuses any attempt.
- Status: Done.

### C. Teacher

**US-07 · See my courses.** As a teacher, I want a list of my courses with how many students and grades each has, so I can choose where to work.
- Status: Done.

**US-08 · Open a class gradebook.** As a teacher, I want one table: students down the side, assessments across the top, so I see the whole class at once.
- Status: Done.

**US-09 · Enter or correct a score.** As a teacher, I want to click a score, type, and press Enter, so entering grades is as quick as a spreadsheet.
- *Then* it saves by itself and shows "saved ✓". There is no Save button.
- *Given* I type 150 or a word, *then* I see a plain message ("Score must be between 0 and 100", "Enter a number like 72 or 72.5") and nothing is saved.
- Status: Done.

**US-10 · Add an assessment.** As a teacher, I want to add a new assessment (e.g. "Midterm") by typing its name and pressing Enter, so I can start grading it.
- Status: Done. The column appears immediately and becomes permanent once the first score is saved.

**US-11 · Only my own courses.** As a teacher, I must not be able to open or change another teacher's course.
- *Then* opening another teacher's course shows "not found", and the database refuses changes.
- Status: Done.

**US-12 · Only enrolled students.** As a teacher, I can only grade students who are enrolled in my course.
- Status: Done.

**US-13 · Find students at risk.** As a teacher, I want to tick one box to see only students with a result below 50.
- Status: Done. Averages and counts update as I edit.

### D. Administrator

**US-14 · Enroll a student.** As an administrator, I want to pick a student and a course and enroll them, so their teacher can start grading them.
- *Then* I see a confirmation. Enrolling twice shows "already enrolled".
- Status: Done.

**US-15 · Overview.** As an administrator, I want to see totals (students, teachers, courses, enrollments, grades), all courses with their teachers, and everyone's role.
- Status: Done.

**US-16 · Manage accounts from the screen.** As an administrator, I want to create and remove users in the app.
- Status: Planned. For now accounts are created by the seed command or in Supabase.

### E. Trust in the data

**US-17 · Valid scores only.** A score must be between 0 and 100. Enforced by the database.
- Status: Done.

**US-18 · One grade per assessment.** A student cannot have two grades with the same assessment name in a course.
- Status: Done.

**US-19 · Change history.** As an administrator, I want every grade change recorded (who, when, old and new value), so disputes can be settled.
- The record is written together with the grade (both succeed or both fail) and can never be edited or deleted by teachers.
- Status: Done (recorded; a screen to browse it is Planned).

### F. Never lose data

**US-20 · Automatic backup.** As the team, we want a regular copy of all data in a separate database.
- Status: Done (`npm run backup`, `npm run backup:watch` for every N minutes, old copies pruned).

**US-21 · Check a backup is good.** We want to compare a backup against the live data (row counts per table).
- Status: Done (`npm run backup:verify`).

**US-22 · Prove we can restore.** We want to restore a backup into a throw-away database and confirm it matches, without touching real data.
- Status: Done (`npm run backup:test-restore`).

**US-23 · Demo data.** As a presenter, I want to fill the system with realistic sample data in one command, and clear it again.
- Status: Done (`npm run db:seed`, `npm run db:seed:clear`).

## 3. Who can do what

| Action | Student | Teacher | Admin |
|---|---|---|---|
| See own grades | Yes | – | – |
| See grades in own courses | No | Yes | Yes |
| See other students/courses | No | No | Yes |
| Enter / change a grade | No | Own courses, enrolled students | Yes |
| Delete a grade | No | No | Yes |
| Enroll students | No | No | Yes |
| Edit / delete change history | No | No | No |

## 4. Not in scope (yet)

Password reset screens, creating users in the app, a screen for the change history, exporting grades, notifications.

## 5. Where each story is checked

| Stories | Automated test |
|---|---|
| US-04, 06 | `roles.test.ts` — "sees only their own grades", "cannot change a mark", "cannot add a grade", "cannot delete a grade" |
| US-09, 10, 11, 12 | "can change a grade in their own course…", "cannot change a grade in another teacher's course", "cannot grade a student who is not enrolled" |
| US-14 | "can enroll a student, after which a teacher can grade them", "cannot enroll students" (teacher) |
| US-17, 18 | "rejects a score above 100 / negative", "rejects a second grade with the same assessment name" |
| US-19 | "rolls back BOTH the grade and the audit entry…", "cannot rewrite the audit log" |
| US-05, 13, scoring helpers | `packages/shared/src/index.test.ts` |
| US-20–22 | Run manually against two databases (see README) |
| Screens (US-02, 04, 07–10, 13–15) | Checked by hand in a browser with sample data |
