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
import { UserRole } from "../src/generated/client";

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

async function ensureLogin(email: string): Promise<string> {
  if (!supabase) return localUuid(email);
  const created = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  // Already exists: find it.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Could not create or find a Supabase user for ${email}: ${created.error?.message}`);
}

async function ensureAppUser(email: string, role: UserRole, link: { studentId?: number; teacherId?: number }) {
  const id = await ensureLogin(email);
  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing && existing.id !== id) {
    // e.g. earlier seeded locally, now seeding against Supabase: replace the row.
    await prisma.auditLog.deleteMany({ where: { changedBy: existing.id } });
    await prisma.appUser.delete({ where: { id: existing.id } });
  }
  await prisma.appUser.upsert({
    where: { id },
    update: { email, role, ...link },
    create: { id, email, role, ...link },
  });
}

async function main() {
  if (process.argv.includes("--clear")) {
    await prisma.attestationResult.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.grade.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.appUser.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.course.deleteMany();
    await prisma.student.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.studentGroup.deleteMany();
    console.log("Cleared existing data.");
  }

  const teachers = [];
  for (const [fullName, email, department] of TEACHERS) {
    teachers.push(await prisma.teacher.upsert({ where: { email }, update: {}, create: { fullName, email, department } }));
  }

  const courses = [];
  for (const [courseName, semester, t] of COURSES) {
    const found = await prisma.course.findFirst({ where: { courseName, semester } });
    courses.push(found ?? (await prisma.course.create({ data: { courseName, semester, teacherId: teachers[t].teacherId } })));
  }

  const groups = await Promise.all(GROUPS.map((groupName) =>
    prisma.studentGroup.upsert({ where: { groupName }, update: {}, create: { groupName } }),
  ));
  const students = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const email = `student${String(i + 1).padStart(3, "0")}@univ.kz`;
    students.push(
      await prisma.student.upsert({
        where: { email },
        update: {},
        create: {
          fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
          email,
          groupId: groups[i % groups.length].groupId,
        },
      }),
    );
  }

  // Each student takes 3 courses.
  let newGrades = 0;
  for (const s of students) {
    const picked = [...courses].sort(() => rng() - 0.5).slice(0, 3);
    for (const c of picked) {
      await prisma.enrollment.createMany({ data: [{ studentId: s.studentId, courseId: c.courseId }], skipDuplicates: true });
      const howMany = 2 + Math.floor(rng() * 4);
      for (const assessmentName of ASSESSMENTS.slice(0, howMany)) {
        const score = Math.min(100, Math.max(0, Math.round(triangular(20, 100, 72) * 10) / 10));
        const assessment = await prisma.assessment.upsert({
          where: { courseId_assessmentName: { courseId: c.courseId, assessmentName } },
          update: {}, create: { courseId: c.courseId, assessmentName },
        });
        const assessmentId = assessment.assessmentId;
        const key = { studentId_assessmentId: { studentId: s.studentId, assessmentId } };
        const before = await prisma.grade.findUnique({ where: key });
        if (!before) {
          await prisma.grade.create({ data: { studentId: s.studentId, courseId: c.courseId, assessmentId, score } });
          newGrades++;
        }
      }
    }
  }

  // Logins + roles
  await ensureAppUser(ADMIN_EMAIL, UserRole.ADMIN, {});
  for (const t of teachers) await ensureAppUser(t.email, UserRole.TEACHER, { teacherId: t.teacherId });
  for (const s of students) await ensureAppUser(s.email, UserRole.STUDENT, { studentId: s.studentId });

  const low = await prisma.grade.count({ where: { score: { lt: 50 } } });
  const total = await prisma.grade.count();
  console.log(
    `Seed OK: ${teachers.length} teachers, ${courses.length} courses, ${students.length} students, ` +
      `${newGrades} new grades (${total} total, ${low} below 50).`,
  );
  console.log(supabase ? "Created/updated Supabase Auth users." : "No Supabase service key: using local ids (dev fake login).");
  console.log(`\nDemo logins (password: ${PASSWORD})`);
  console.log(`  admin    ${ADMIN_EMAIL}`);
  console.log(`  teacher  ${TEACHERS[0][1]}  (teaches Databases, Python Programming)`);
  console.log(`  student  student001@univ.kz`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
