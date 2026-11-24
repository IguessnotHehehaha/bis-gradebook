import { attestationAverage } from "@gradebook/shared";
import { withUser } from "./withUser";

export interface AttestationSummary {
  studentId: number;
  courseId: number;
  first: number | null;
  second: number | null;
  average: number | null;
}

export async function getAttestations(userId: string, courseId?: number): Promise<AttestationSummary[]> {
  return withUser(userId, async (tx) => {
    const enrollments = await tx.enrollment.findMany({
      where: courseId === undefined ? {} : { courseId },
      include: { attestations: true },
      orderBy: [{ courseId: "asc" }, { studentId: "asc" }],
    });
    return enrollments.map((e) => {
      const first = e.attestations.find((a) => a.attestationNumber === 1)?.score.toNumber() ?? null;
      const second = e.attestations.find((a) => a.attestationNumber === 2)?.score.toNumber() ?? null;
      return { studentId: e.studentId, courseId: e.courseId, first, second, average: attestationAverage(first, second) };
    });
  });
}

export async function saveAttestation(userId: string, input: {
  studentId: number; courseId: number; attestationNumber: number; score: number;
}): Promise<{ ok: true } | { ok: false }> {
  if (![input.studentId, input.courseId].every((n) => Number.isInteger(n) && n > 0) ||
      ![1, 2].includes(input.attestationNumber) || !Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    return { ok: false };
  }
  try {
    await withUser(userId, async (tx) => {
      await tx.attestationResult.upsert({
        where: { studentId_courseId_attestationNumber: {
          studentId: input.studentId, courseId: input.courseId, attestationNumber: input.attestationNumber,
        } },
        create: { ...input, changedBy: userId },
        update: { score: input.score, changedBy: userId, updatedAt: new Date() },
      });
    });
    return { ok: true };
  } catch { return { ok: false }; }
}

/** Includes ungraded enrollments so newly joined courses are visible immediately. */
export async function getStudentCourseCatalogue(userId: string) {
  return withUser(userId, async (tx) => {
    const self = await tx.appUser.findUnique({ where: { id: userId } });
    if (!self || self.role !== "STUDENT" || self.studentId === null) return [];
    const courses = await tx.course.findMany({
      include: { teacher: true, enrollments: { where: { studentId: self.studentId } } },
      orderBy: [{ semester: "desc" }, { courseName: "asc" }, { courseId: "asc" }],
    });
    return courses.map((c) => ({
      courseId: c.courseId, courseName: c.courseName, semester: c.semester,
      teacherName: c.teacher.fullName, enrolled: c.enrollments.length > 0,
    }));
  });
}

/** Student id always comes from the signed-in account, never from browser input. */
export async function selfEnroll(userId: string, courseId: number): Promise<"enrolled" | "already" | "failed"> {
  if (!Number.isInteger(courseId) || courseId <= 0) return "failed";
  try {
    return await withUser(userId, async (tx) => {
      const self = await tx.appUser.findUnique({ where: { id: userId } });
      if (!self || self.role !== "STUDENT" || self.studentId === null) return "failed";
      await tx.enrollment.create({ data: { courseId, studentId: self.studentId } });
      return "enrolled";
    });
  } catch (error) {
    return /P2002|unique|duplicate/i.test(String(error)) ? "already" : "failed";
  }
}
