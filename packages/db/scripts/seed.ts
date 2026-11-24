/**
 * Fills the database with demo data: 4 teachers, 5 courses, 20 students, enrollments,
 * ~200 grades and one login per person. Safe to run again (no duplicates).
 *
 *   npm run db:seed          add/refresh demo data
 *   npm run db:seed:clear    wipe all gradebook data first, then seed
 *
 * With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set, real Supabase Auth users are created
 * (password = SEED_PASSWORD). Without them, stable local ids are used (dev fake login only).
 */
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "../src/client";
import { UserRole, type Prisma } from "../src/generated/client";

const PASSWORD = process.env.SEED_PASSWORD ?? "Gradebook123!";

const TEACHERS = [
  ["Aigul Serikova", "a.serikova@univ.kz", "Computer Science"],
  ["Marat Omarov", "m.omarov@univ.kz", "Mathematics"],
  ["Dina Bekova", "d.bekova@univ.kz", "Information Systems"],
  ["Yerlan Akhmetov", "y.akhmetov@univ.kz", "Physics"],
] as const;

const COURSES = [
  ["Databases", "Fall 2026", 0],
  ["Python Programming", "Fall 2026", 0],
  ["Calculus", "Fall 2026", 1],
  ["Information Systems Design", "Fall 2026", 2],
  ["Physics I", "Fall 2026", 3],
] as const;

const FIRST = ["Aruzhan", "Dias", "Amina", "Nursultan", "Madina", "Ilyas", "Zarina", "Alikhan", "Aigerim", "Timur", "Dana", "Rustem", "Aliya", "Bauyrzhan", "Sabina", "Daniyar"];
const LAST = ["Kenzhebayev", "Sadykova", "Tulegenov", "Ismailova", "Nurpeisov", "Abdrakhmanova", "Zhumabayev", "Kasymova", "Orazov", "Baimukhanova"];
const GROUPS = ["IS-24-1", "IS-24-2", "CS-24-1"];
const ASSESSMENTS = ["Quiz 1", "Quiz 2", "Midterm", "Project", "Final Exam"];
const STUDENT_COUNT = 20;
const ADMIN_EMAIL = "admin@univ.kz";

// Small deterministic random generator: everyone who seeds gets the same data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const triangular = (lo: number, hi: number, mode: number) => {
  const u = rng();
  const c = (mode - lo) / (hi - lo);
  return u < c ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
};

function localUuid(email: string): string {
  const h = crypto.createHash("sha1").update(`gradebook:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

let supabase: SupabaseClient | null = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const teacherData = TEACHERS.map(([fullName, email, department]) => ({ fullName, email, department }));
const studentData = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
  email: `student${String(i + 1).padStart(3, "0")}@univ.kz`,
  fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
  groupName: GROUPS[i % GROUPS.length],
}));
const demoEmails = [ADMIN_EMAIL, ...teacherData.map((t) => t.email), ...studentData.map((s) => s.email)];

async function resolveLogins() {
  const auth = supabase?.auth.admin;
  if (!auth) return new Map(demoEmails.map((email) => [email, localUuid(email)]));

  const profiles = await prisma.appUser.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true, email: true, role: true },
  });
  const knownProfiles = new Map(profiles.map((profile) => [profile.email, profile]));
  const wanted = new Set(demoEmails);
  const logins = new Map<string, string>();
  for (let page = 1; logins.size < wanted.size; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) {
      const email = user.email?.toLowerCase();
      if (!email || !wanted.has(email)) continue;
      const expectedRole = email === ADMIN_EMAIL ? UserRole.ADMIN :
        teacherData.some((teacher) => teacher.email === email) ? UserRole.TEACHER : UserRole.STUDENT;
      const profile = knownProfiles.get(email);
      if (expectedRole !== UserRole.STUDENT &&
          !(profile?.id === user.id && profile.role === expectedRole) &&
          user.app_metadata.gradebook_seed !== true) {
        throw new Error(`Existing Auth account ${email} is not linked to the expected staff role. Review it before seeding.`);
      }
      logins.set(email, user.id);
    }
    if (data.nextPage === null) break;
  }

  const missing = demoEmails.filter((email) => !logins.has(email));
  console.log(`Auth: ${logins.size} existing demo logins, ${missing.length} to create.`);
  for (let i = 0; i < missing.length; i += 5) {
    const batch = await Promise.allSettled(missing.slice(i, i + 5).map(async (email) => {
      const { data, error } = await auth.createUser({
        email, password: PASSWORD, email_confirm: true, app_metadata: { gradebook_seed: true },
      });
      if (error) throw new Error(`Could not create demo login ${email}: ${error.code ?? error.name}`);
      logins.set(email, data.user.id);
    }));
    const failed = batch.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  }
  return logins;
}

async function clearGradebook(tx: Prisma.TransactionClient) {
  await tx.attestationResult.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.grade.deleteMany();
  await tx.enrollment.deleteMany();
  await tx.appUser.deleteMany();
  await tx.assessment.deleteMany();
  await tx.course.deleteMany();
  await tx.student.deleteMany();
  await tx.teacher.deleteMany();
  await tx.studentGroup.deleteMany();
}

async function seedGradebook(tx: Prisma.TransactionClient, logins: Map<string, string>, clear: boolean) {
  // Courses have no unique name/semester constraint. Serialize concurrent seed runs.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(912679311::bigint)`;
  if (clear) await clearGradebook(tx);

  await tx.teacher.createMany({ data: teacherData, skipDuplicates: true });
  const teacherRows = await tx.teacher.findMany({ where: { email: { in: teacherData.map((t) => t.email) } } });
  const teachers = teacherData.map(({ email }) => teacherRows.find((row) => row.email === email)!);

  const existingCourses = await tx.course.findMany({
    where: { OR: COURSES.map(([courseName, semester]) => ({ courseName, semester })) },
    orderBy: { courseId: "asc" },
  });
  const missingCourses = COURSES.filter(([name, semester]) =>
    !existingCourses.some((course) => course.courseName === name && course.semester === semester));
  if (missingCourses.length) {
    existingCourses.push(...await tx.course.createManyAndReturn({
      data: missingCourses.map(([courseName, semester, teacher]) => ({ courseName, semester, teacherId: teachers[teacher].teacherId })),
    }));
  }
  const courses = COURSES.map(([name, semester]) =>
    existingCourses.find((course) => course.courseName === name && course.semester === semester)!);

  await tx.studentGroup.createMany({ data: GROUPS.map((groupName) => ({ groupName })), skipDuplicates: true });
  const groups = await tx.studentGroup.findMany({ where: { groupName: { in: [...GROUPS] } } });
  await tx.student.createMany({
    data: studentData.map(({ email, fullName, groupName }) => ({
      email, fullName, groupId: groups.find((group) => group.groupName === groupName)!.groupId,
    })),
    skipDuplicates: true,
  });
  const studentRows = await tx.student.findMany({ where: { email: { in: studentData.map((s) => s.email) } } });
  const students = studentData.map(({ email }) => studentRows.find((row) => row.email === email)!);

  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const demoGrades: { studentId: number; courseId: number; assessmentName: string; score: number }[] = [];
  const assessmentData = new Map<string, Prisma.AssessmentCreateManyInput>();
  for (const { studentId } of students) {
    const picked = [...courses].sort(() => rng() - 0.5).slice(0, 3);
    for (const { courseId } of picked) {
      enrollments.push({ studentId, courseId });
      const howMany = 2 + Math.floor(rng() * 4);
      for (const assessmentName of ASSESSMENTS.slice(0, howMany)) {
        const score = Math.min(100, Math.max(0, Math.round(triangular(20, 100, 72) * 10) / 10));
        demoGrades.push({ studentId, courseId, assessmentName, score });
        assessmentData.set(`${courseId}:${assessmentName}`, { courseId, assessmentName });
      }
    }
  }

  await tx.enrollment.createMany({ data: enrollments, skipDuplicates: true });
  await tx.assessment.createMany({ data: [...assessmentData.values()], skipDuplicates: true });
  const assessments = await tx.assessment.findMany({
    where: { courseId: { in: courses.map((course) => course.courseId) }, assessmentName: { in: ASSESSMENTS } },
  });
  const assessmentIds = new Map(assessments.map((row) => [`${row.courseId}:${row.assessmentName}`, row.assessmentId]));
  const { count: newGrades } = await tx.grade.createMany({
    data: demoGrades.map(({ courseId, assessmentName, ...grade }) => ({
      ...grade, courseId, assessmentId: assessmentIds.get(`${courseId}:${assessmentName}`)!,
    })),
    skipDuplicates: true,
  });

  const appUsers = [
    { email: ADMIN_EMAIL, role: UserRole.ADMIN, studentId: null, teacherId: null },
    ...teachers.map(({ email, teacherId }) => ({ email, role: UserRole.TEACHER, teacherId, studentId: null })),
    ...students.map(({ email, studentId }) => ({ email, role: UserRole.STUDENT, studentId, teacherId: null })),
  ].map((user) => ({ ...user, id: logins.get(user.email)! }));
  const existingUsers = await tx.appUser.findMany({ where: { email: { in: demoEmails } } });
  const usersByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  await tx.appUser.createMany({ data: appUsers.filter((user) => !usersByEmail.has(user.email)) });
  for (const user of appUsers) {
    const current = usersByEmail.get(user.email);
    if (current && (current.id !== user.id || current.role !== user.role ||
        current.teacherId !== user.teacherId || current.studentId !== user.studentId)) {
      // The audit log follows a changed local user ID via ON UPDATE CASCADE.
      await tx.appUser.update({ where: { id: current.id }, data: user });
    }
  }
  return newGrades;
}

async function main() {
  console.log("Seed: checking demo logins.");
  const logins = await resolveLogins();
  const clear = process.argv.includes("--clear");
  console.log(clear ? "Seed: clearing and rebuilding gradebook in one transaction." : "Seed: inserting missing demo data in batches.");
  const newGrades = await prisma.$transaction((tx) => seedGradebook(tx, logins, clear), { timeout: 60_000 });
  console.log(`Seed OK: ${newGrades} new grades. Existing passwords are retained; new logins use SEED_PASSWORD.`);
  console.log(`Demo logins: ${ADMIN_EMAIL}, ${TEACHERS[0][1]}, ${TEACHERS[1][1]}, ${studentData[0].email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
