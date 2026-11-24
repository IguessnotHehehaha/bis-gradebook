import { PASS_MARK } from "@gradebook/shared";
import type { Prisma } from "./generated/client";
import { withUser } from "./withUser";

// All functions take the signed-in person's id and run through `withUser`, so the
// database applies the access rules. Results are plain objects (numbers and strings)
// that can be passed straight to React components.

const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------- Student ----------

export interface StudentGradeRow {
  gradeId: number;
  courseId: number;
  courseName: string;
  semester: string;
  teacherName: string;
  assessmentName: string;
  score: number;
  gradeDate: string;
}

export async function getStudentGrades(userId: string, studentId: number): Promise<StudentGradeRow[]> {
  return withUser(userId, async (tx) => {
    const rows = await tx.grade.findMany({
      where: { studentId },
      include: { assessment: true, enrollment: { include: { course: { include: { teacher: true } } } } },
      orderBy: [{ courseId: "asc" }, { gradeId: "asc" }],
    });
    return rows.map((g) => ({
      gradeId: g.gradeId,
      courseId: g.courseId,
      courseName: g.enrollment.course.courseName,
      semester: g.enrollment.course.semester,
      teacherName: g.enrollment.course.teacher.fullName,
      assessmentName: g.assessment.assessmentName,
      score: g.score.toNumber(),
      gradeDate: iso(g.gradeDate),
    }));
  });
}

// ---------- Teacher ----------

export interface TeacherCourseSummary {
  courseId: number;
  courseName: string;
  semester: string;
  studentCount: number;
  gradeCount: number;
  lowCount: number;
  assessmentCount: number;
  average: number | null;
}

export async function getTeacherCourses(userId: string, teacherId: number): Promise<TeacherCourseSummary[]> {
  return withUser(userId, (tx) => tx.$queryRaw<TeacherCourseSummary[]>`
    SELECT c.course_id AS "courseId", c.course_name AS "courseName", c.semester,
           (SELECT count(*)::integer FROM enrollments e WHERE e.course_id = c.course_id) AS "studentCount",
           (SELECT count(*)::integer FROM assessments a WHERE a.course_id = c.course_id) AS "assessmentCount",
           stats."gradeCount", stats."lowCount", stats.average
    FROM courses c
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS "gradeCount",
             (count(*) FILTER (WHERE g.score < ${PASS_MARK}))::integer AS "lowCount",
             round(avg(g.score), 1)::double precision AS average
      FROM grades g WHERE g.course_id = c.course_id
    ) stats
    WHERE c.teacher_id = ${teacherId}
    ORDER BY c.course_id
  `);
}

export interface Gradebook {
  course: { courseId: number; courseName: string; semester: string; teacherId: number };
  students: { studentId: number; fullName: string; groupName: string }[];
  /** Assessment names in the order they were first used. */
  assessments: string[];
  /** key = `${studentId}:${assessmentName}` */
  scores: Record<string, number>;
}

export const scoreKey = (studentId: number, assessmentName: string) => `${studentId}:${assessmentName}`;

/** Returns null when the course does not exist OR the person is not allowed to see it. */
export async function getGradebook(userId: string, courseId: number): Promise<Gradebook | null> {
  return withUser(userId, async (tx) => {
    const course = await tx.course.findUnique({
      where: { courseId },
      include: { assessments: { orderBy: { assessmentId: "asc" } }, enrollments: { include: { student: { include: { group: true } } }, orderBy: { student: { fullName: "asc" } } } },
    });
    if (!course) return null;
    const grades = await tx.grade.findMany({ where: { courseId }, include: { assessment: true }, orderBy: { gradeId: "asc" } });
    const assessments = course.assessments.map((a) => a.assessmentName);
    const scores: Record<string, number> = {};
    for (const g of grades) {
      scores[scoreKey(g.studentId, g.assessment.assessmentName)] = g.score.toNumber();
    }
    return {
      course: {
        courseId: course.courseId,
        courseName: course.courseName,
        semester: course.semester,
        teacherId: course.teacherId,
      },
      students: course.enrollments.map((e) => ({
        studentId: e.student.studentId,
        fullName: e.student.fullName,
        groupName: e.student.group.groupName,
      })),
      assessments,
      scores,
    };
  });
}

// ---------- Saving a grade (grade + audit entry = one transaction) ----------

export type SaveResult = { ok: true; score: number; changed: boolean } | { ok: false; error: string };

function explain(e: unknown): string {
  const msg = e instanceof Error ? `${e.message} ${(e as { cause?: { message?: string } }).cause?.message ?? ""}` : String(e);
  if (/row-level security/i.test(msg)) return "You are not allowed to change this grade.";
  if (/foreign key|P2003/i.test(msg)) return "This student is not enrolled in the course.";
  if (/grade_score_0_to_100|check constraint/i.test(msg)) return "Score must be between 0 and 100.";
  return "Could not save the grade. Please try again.";
}

/**
 * Creates or updates one grade AND writes the audit entry in the same transaction.
 * If either step fails, neither is saved.
 */
export async function saveGradeScore(
  userId: string,
  input: { studentId: number; courseId: number; assessmentName: string; score: number },
): Promise<SaveResult> {
  const { studentId, courseId, assessmentName, score } = input;
  try {
    return await withUser(userId, async (tx) => {
      const assessmentKey = { courseId, assessmentName };
      const assessmentQuery = {
        where: { courseId_assessmentName: assessmentKey },
        select: { assessmentId: true },
      };
      let assessment = await tx.assessment.findUnique(assessmentQuery);
      if (!assessment) {
        await tx.assessment.createMany({ data: [assessmentKey], skipDuplicates: true });
        assessment = await tx.assessment.findUniqueOrThrow(assessmentQuery);
      }
      const { assessmentId } = assessment;
      // Serialize edits to this cell so audit entries record the actual previous score.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${studentId}::integer, ${assessmentId}::integer)`;
      const existing = await tx.grade.findUnique({
        where: { studentId_assessmentId: { studentId, assessmentId } },
      });
      if (existing && existing.score.toNumber() === score) {
        return { ok: true as const, score, changed: false };
      }
      const grade = existing
        ? await tx.grade.update({ where: { gradeId: existing.gradeId }, data: { score } })
        : await tx.grade.create({ data: { studentId, courseId, assessmentId, score } });
      await tx.auditLog.create({
        data: {
          gradeId: grade.gradeId,
          courseId,
          studentId,
          action: existing ? "UPDATE" : "CREATE",
          assessmentName,
          oldScore: existing ? existing.score : null,
          newScore: score,
          changedBy: userId,
        },
      });
      return { ok: true as const, score, changed: true };
    });
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

// ---------- Admin ----------

function adminPage(total: number, requested: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Number.isSafeInteger(requested) ? Math.min(pageCount, Math.max(1, requested)) : 1;
  return { total, page, pageCount, skip: (page - 1) * size, take: size };
}

export function getAdminCounts(userId: string) {
  return withUser(userId, async (tx) => {
    const [students, teachers, courses, enrollments, grades] = await Promise.all([
      tx.student.count(), tx.teacher.count(), tx.course.count(), tx.enrollment.count(), tx.grade.count(),
    ]);
    return { students, teachers, courses, enrollments, grades };
  });
}

const groupOptions = { select: { groupId: true, groupName: true }, orderBy: { groupName: "asc" } } as const;
const courseOptions = {
  select: { courseId: true, courseName: true, semester: true },
  orderBy: [{ courseName: "asc" }, { courseId: "asc" }],
} satisfies Prisma.CourseFindManyArgs;

export function getAdminStudents(userId: string, filters: { search: string; groupId?: number; courseId?: number; page: number }) {
  const search = filters.search.replace(/[\\%_]/g, "\\$&");
  const where: Prisma.StudentWhereInput = {
    groupId: filters.groupId,
    enrollments: filters.courseId === undefined ? undefined : { some: { courseId: filters.courseId } },
    OR: search ? [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] : undefined,
  };
  return withUser(userId, async (tx) => {
    const [total, groups, courses] = await Promise.all([
      tx.student.count({ where }),
      tx.studentGroup.findMany(groupOptions),
      tx.course.findMany(courseOptions),
    ]);
    const pagination = adminPage(total, filters.page, 15);
    const students = await tx.student.findMany({
      where, skip: pagination.skip, take: pagination.take,
      orderBy: [{ fullName: "asc" }, { studentId: "asc" }],
      select: { studentId: true, fullName: true, email: true, group: { select: { groupName: true } } },
    });
    return { pagination, students, groups, courses };
  });
}

export function getAdminCourses(userId: string) {
  return withUser(userId, async (tx) => {
    const [courses, teachers, students] = await Promise.all([
      tx.course.findMany({
        select: { ...courseOptions.select, teacher: { select: { fullName: true } }, _count: { select: { enrollments: true } } },
        orderBy: courseOptions.orderBy,
      }),
      tx.teacher.findMany({ select: { teacherId: true, fullName: true }, orderBy: { fullName: "asc" } }),
      tx.student.findMany({ select: { studentId: true, fullName: true, email: true }, orderBy: [{ fullName: "asc" }, { studentId: "asc" }] }),
    ]);
    return { courses, teachers, students };
  });
}

export function getAdminGrades(userId: string, requested: number, studentId?: number) {
  const where = { studentId };
  return withUser(userId, async (tx) => {
    const total = await tx.grade.count({ where });
    const pagination = adminPage(total, requested, 50);
    const rows = await tx.grade.findMany({
      where, skip: pagination.skip, take: pagination.take,
      orderBy: [{ courseId: "asc" }, { studentId: "asc" }, { gradeId: "asc" }],
      select: {
        gradeId: true, score: true, gradeDate: true,
        assessment: { select: { assessmentName: true } },
        enrollment: { select: { course: { select: { courseName: true } }, student: { select: { fullName: true } } } },
      },
    });
    return {
      pagination,
      grades: rows.map((g) => ({
        gradeId: g.gradeId,
        studentName: g.enrollment.student.fullName,
        courseName: g.enrollment.course.courseName,
        assessmentName: g.assessment.assessmentName,
        score: g.score.toNumber(),
        gradeDate: iso(g.gradeDate),
      })),
    };
  });
}

export function getAdminAccounts(userId: string, requested: number) {
  return withUser(userId, async (tx) => {
    const pagination = adminPage(await tx.appUser.count(), requested, 15);
    const users = await tx.appUser.findMany({
      skip: pagination.skip, take: pagination.take,
      select: {
        id: true, email: true, role: true,
        student: { select: { fullName: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    });
    return { pagination, users: users.map((u) => ({
      id: u.id, email: u.email, role: u.role.toLowerCase(),
      name: u.student?.fullName ?? u.teacher?.fullName,
    })) };
  });
}

export async function createManagedStudent(userId: string, input: { id: string; email: string; name: string; groupId: number }) {
  return withUser(userId, async (tx) => {
    const student = await tx.student.create({ data: { email: input.email, fullName: input.name, groupId: input.groupId } });
    await tx.appUser.create({ data: { id: input.id, email: input.email, role: "STUDENT", studentId: student.studentId } });
    return student.studentId;
  });
}

export async function createManagedTeacher(userId: string, input: { id: string; email: string; name: string; department: string }) {
  return withUser(userId, async (tx) => {
    const teacher = await tx.teacher.create({ data: { email: input.email, fullName: input.name, department: input.department } });
    await tx.appUser.create({ data: { id: input.id, email: input.email, role: "TEACHER", teacherId: teacher.teacherId } });
    return teacher.teacherId;
  });
}

export async function createManagedCourse(userId: string, input: { courseName: string; semester: string; teacherId: number }) {
  return withUser(userId, (tx) => tx.course.create({ data: input }));
}

export async function deleteManagedUser(userId: string, targetId: string) {
  return withUser(userId, async (tx) => {
    if (userId === targetId) throw new Error("You cannot delete your own account.");
    const target = await tx.appUser.findUnique({ where: { id: targetId } });
    if (!target) throw new Error("This user no longer exists.");
    if (target.role === "ADMIN" && await tx.appUser.count({ where: { role: "ADMIN" } }) <= 1) {
      throw new Error("The last administrator cannot be deleted.");
    }
    if (await tx.auditLog.findFirst({ where: { changedBy: targetId }, select: { auditId: true } })) {
      throw new Error("This account is referenced by the grade change history and cannot be deleted.");
    }
    await tx.appUser.delete({ where: { id: targetId } });
    return { email: target.email };
  });
}

export async function enrollStudent(
  userId: string,
  studentId: number,
  courseId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await withUser(userId, (tx) => tx.enrollment.create({ data: { studentId, courseId } }));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate|P2002/i.test(msg)) return { ok: false, error: "This student is already enrolled." };
    if (/row-level security/i.test(msg)) return { ok: false, error: "Only an administrator can enroll students." };
    return { ok: false, error: "Could not enroll the student." };
  }
}

/** Persist an assessment even before any grades have been entered. */
export async function createAssessment(userId: string, courseId: number, assessmentName: string) {
  if (!Number.isInteger(courseId) || courseId <= 0 || !assessmentName.trim() || assessmentName.trim().length > 60) {
    return { ok: false as const, error: "Enter a course and an assessment name (1–60 characters)." };
  }
  try {
    await withUser(userId, (tx) => tx.assessment.create({ data: { courseId, assessmentName: assessmentName.trim() } }));
    return { ok: true as const };
  } catch (error) {
    if (/unique|P2002/i.test(String(error))) return { ok: false as const, error: "That assessment already exists." };
    return { ok: false as const, error: "Could not create the assessment. Check your course permissions." };
  }
}
