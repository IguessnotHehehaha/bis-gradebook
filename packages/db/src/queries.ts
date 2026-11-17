import { PASS_MARK } from "@gradebook/shared";
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
  return withUser(userId, async (tx) => {
    const courses = await tx.course.findMany({
      where: { teacherId },
      include: { _count: { select: { enrollments: true, assessments: true } } },
      orderBy: { courseId: "asc" },
    });
    const grades = await tx.grade.findMany({
      where: { courseId: { in: courses.map((c) => c.courseId) } },
      select: { courseId: true, score: true },
    });
    return courses.map((c) => {
      const mine = grades.filter((g) => g.courseId === c.courseId);
      return {
        courseId: c.courseId,
        courseName: c.courseName,
        semester: c.semester,
        studentCount: c._count.enrollments,
        gradeCount: mine.length,
        lowCount: mine.filter((g) => g.score.toNumber() < PASS_MARK).length,
        assessmentCount: c._count.assessments,
        average: mine.length
          ? Math.round((mine.reduce((sum, g) => sum + g.score.toNumber(), 0) / mine.length) * 10) / 10
          : null,
      };
    });
  });
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
      const assessment = await tx.assessment.upsert({
        where: { courseId_assessmentName: { courseId, assessmentName } },
        update: {}, create: { courseId, assessmentName },
      });
      const assessmentId = assessment.assessmentId;
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

export interface AdminOverview {
  counts: { students: number; teachers: number; courses: number; enrollments: number; grades: number };
  courses: { courseId: number; courseName: string; semester: string; teacherName: string; enrolled: number }[];
  students: { studentId: number; fullName: string; email: string; groupName: string }[];
  grades: { gradeId: number; studentName: string; courseName: string; assessmentName: string; score: number; gradeDate: string }[];
  teachers: { teacherId: number; fullName: string }[];
  groups: { groupId: number; groupName: string }[];
  people: { id: string; email: string; role: string; name: string }[];
}

export async function getAdminOverview(userId: string): Promise<AdminOverview> {
  return withUser(userId, async (tx) => {
    const [students, teachers, groups, courses, enrollments, grades, users] = await Promise.all([
      tx.student.findMany({ include: { group: true }, orderBy: { fullName: "asc" } }),
      tx.teacher.findMany({ orderBy: { fullName: "asc" } }),
      tx.studentGroup.findMany({ orderBy: { groupName: "asc" } }),
      tx.course.findMany({
        include: { teacher: true, _count: { select: { enrollments: true } } },
        orderBy: { courseId: "asc" },
      }),
      tx.enrollment.count(),
      tx.grade.findMany({ include: { assessment: true, enrollment: { include: { course: true, student: true } } }, orderBy: [{ courseId: "asc" }, { studentId: "asc" }, { gradeId: "asc" }] }),
      tx.appUser.findMany({ include: { student: true, teacher: true }, orderBy: [{ role: "asc" }, { email: "asc" }] }),
    ]);
    return {
      counts: {
        students: students.length,
        teachers: teachers.length,
        courses: courses.length,
        enrollments,
        grades: grades.length,
      },
      courses: courses.map((c) => ({
        courseId: c.courseId,
        courseName: c.courseName,
        semester: c.semester,
        teacherName: c.teacher.fullName,
        enrolled: c._count.enrollments,
      })),
      students: students.map((s) => ({ studentId: s.studentId, fullName: s.fullName, email: s.email, groupName: s.group.groupName })),
      grades: grades.map((g) => ({
        gradeId: g.gradeId,
        studentName: g.enrollment.student.fullName,
        courseName: g.enrollment.course.courseName,
        assessmentName: g.assessment.assessmentName,
        score: g.score.toNumber(),
        gradeDate: iso(g.gradeDate),
      })),
      teachers: teachers.map((t) => ({ teacherId: t.teacherId, fullName: t.fullName })),
      groups: groups.map((g) => ({ groupId: g.groupId, groupName: g.groupName })),
      people: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role.toLowerCase(),
        name: u.student?.fullName ?? u.teacher?.fullName ?? "Administrator",
      })),
    };
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
    if (await tx.auditLog.count({ where: { changedBy: targetId } })) {
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
