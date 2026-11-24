import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, saveGradeScore, withUser, getGradebook, getStudentGrades, getAdminStudents, getTeacherCourses, createAssessment, selfEnroll, getStudentCourseCatalogue, getAttestations, saveAttestation } from "../src";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const run = enabled ? describe : describe.skip;

// Fixed ids so the tests are easy to read.
const U = {
  s1: "00000000-0000-4000-8000-000000000001",
  s2: "00000000-0000-4000-8000-000000000002",
  t1: "00000000-0000-4000-8000-000000000011",
  t2: "00000000-0000-4000-8000-000000000012",
  admin: "00000000-0000-4000-8000-0000000000aa",
  stranger: "00000000-0000-4000-8000-0000000000ff",
};

/*
 * Fixture
 *   Teacher 1 teaches Course 1; Teacher 2 teaches Course 2.
 *   Student 1 is in Course 1.  Student 2 is in Courses 1 and 2.  Student 3 is in no course.
 */
beforeAll(async () => {
  if (!enabled) return;
  await prisma.$executeRawUnsafe(
    "TRUNCATE attestation_results, audit_log, grades, assessments, enrollments, app_users, courses, students, teachers, student_groups RESTART IDENTITY CASCADE",
  );
  await prisma.teacher.createMany({
    data: [
      { fullName: "Teacher One", email: "t1@x.kz", department: "CS" },
      { fullName: "Teacher Two", email: "t2@x.kz", department: "Math" },
    ],
  });
  await prisma.studentGroup.createMany({ data: [{ groupName: "G1" }, { groupName: "G2" }] });
  await prisma.student.createMany({
    data: [
      { fullName: "Student One", email: "s1@x.kz", groupId: 1 },
      { fullName: "Student Two", email: "s2@x.kz", groupId: 1 },
      { fullName: "Student Three", email: "s3@x.kz", groupId: 2 },
    ],
  });
  await prisma.course.createMany({
    data: [
      { courseName: "Databases", semester: "Fall", teacherId: 1 },
      { courseName: "Calculus", semester: "Fall", teacherId: 2 },
    ],
  });
  await prisma.enrollment.createMany({
    data: [
      { studentId: 1, courseId: 1 },
      { studentId: 2, courseId: 1 },
      { studentId: 2, courseId: 2 },
    ],
  });
  await prisma.assessment.createMany({ data: [
    { courseId: 1, assessmentName: "Quiz 1" },
    { courseId: 2, assessmentName: "Quiz 1" },
  ] });
  await prisma.grade.createMany({
    data: [
      { studentId: 1, courseId: 1, assessmentId: 1, score: 40 },
      { studentId: 2, courseId: 1, assessmentId: 1, score: 80 },
      { studentId: 2, courseId: 2, assessmentId: 2, score: 60 },
    ],
  });
  await prisma.appUser.createMany({
    data: [
      { id: U.s1, email: "s1@x.kz", role: "STUDENT", studentId: 1 },
      { id: U.s2, email: "s2@x.kz", role: "STUDENT", studentId: 2 },
      { id: U.t1, email: "t1@x.kz", role: "TEACHER", teacherId: 1 },
      { id: U.t2, email: "t2@x.kz", role: "TEACHER", teacherId: 2 },
      { id: U.admin, email: "admin@x.kz", role: "ADMIN" },
    ],
  });
});

afterAll(async () => {
  if (enabled) await prisma.$disconnect();
});

run("student role", () => {
  it("sees only their own grades", async () => {
    const rows = await getStudentGrades(U.s1, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ assessmentName: "Quiz 1", score: 40 });
  });

  it("cannot read another student's grades even when asking for them", async () => {
    const rows = await getStudentGrades(U.s1, 2);
    expect(rows).toHaveLength(0);
  });

  it("cannot change a mark", async () => {
    const res = await withUser(U.s1, (tx) =>
      tx.grade.updateMany({ where: { gradeId: 1 }, data: { score: 100 } }),
    );
    expect(res.count).toBe(0);
    const g = await prisma.grade.findUniqueOrThrow({ where: { gradeId: 1 } });
    expect(g.score.toNumber()).toBe(40);
  });

  it("cannot add a grade", async () => {
    await expect(
      withUser(U.s1, (tx) =>
        tx.grade.create({ data: { studentId: 1, courseId: 1, assessmentId: 1, score: 100 } }),
      ),
    ).rejects.toThrow();
  });

  it("cannot delete a grade", async () => {
    const res = await withUser(U.s1, (tx) => tx.grade.deleteMany({ where: { gradeId: 1 } }));
    expect(res.count).toBe(0);
  });

  it("cannot go through the save function either", async () => {
    const res = await saveGradeScore(U.s1, { studentId: 1, courseId: 1, assessmentName: "Quiz 1", score: 100 });
    expect(res.ok).toBe(false);
    const g = await prisma.grade.findUniqueOrThrow({ where: { gradeId: 1 } });
    expect(g.score.toNumber()).toBe(40);
  });
});

run("teacher role", () => {
  it("sees only their own courses", async () => {
    const courses = await getTeacherCourses(U.t1, 1);
    expect(courses).toMatchObject([{
      courseId: 1,
      gradeCount: 2,
      lowCount: 1,
      average: 60,
      studentCount: 2,
      assessmentCount: 1,
    }]);
    const other = await getTeacherCourses(U.t1, 2);
    expect(other).toHaveLength(0);
  });

  it("sees the gradebook of their own course, with only enrolled students", async () => {
    const book = await getGradebook(U.t1, 1);
    expect(book?.students.map((s) => s.studentId)).toEqual([1, 2]);
  });

  it("cannot open another teacher's gradebook", async () => {
    expect(await getGradebook(U.t1, 2)).toBeNull();
  });

  it("can change a grade in their own course, and the change is audited", async () => {
    const res = await saveGradeScore(U.t1, { studentId: 1, courseId: 1, assessmentName: "Quiz 1", score: 45 });
    expect(res).toEqual({ ok: true, score: 45, changed: true });
    const audit = await prisma.auditLog.findFirstOrThrow({ orderBy: { auditId: "desc" } });
    expect(audit.action).toBe("UPDATE");
    expect(audit.oldScore?.toNumber()).toBe(40);
    expect(audit.newScore?.toNumber()).toBe(45);
    expect(audit.changedBy).toBe(U.t1);
  });

  it("can add a new assessment for an enrolled student", async () => {
    const res = await saveGradeScore(U.t1, { studentId: 2, courseId: 1, assessmentName: "Midterm", score: 71.5 });
    expect(res.ok).toBe(true);
    const g = await prisma.grade.findFirstOrThrow({ where: { assessment: { assessmentName: "Midterm" } } });
    expect(g.score.toNumber()).toBe(71.5);
  });

  it("cannot change a grade in another teacher's course", async () => {
    const before = await prisma.grade.count();
    const res = await saveGradeScore(U.t1, { studentId: 2, courseId: 2, assessmentName: "Quiz 1", score: 99 });
    expect(res.ok).toBe(false);
    const g = await prisma.grade.findFirstOrThrow({ where: { studentId: 2, courseId: 2 } });
    expect(g.score.toNumber()).toBe(60);
    expect(await prisma.grade.count()).toBe(before);
  });

  it("cannot add a grade in another teacher's course", async () => {
    const res = await saveGradeScore(U.t1, { studentId: 2, courseId: 2, assessmentName: "Sneaky", score: 90 });
    expect(res.ok).toBe(false);
  });

  it("cannot grade a student who is not enrolled in the course", async () => {
    const res = await saveGradeScore(U.t1, { studentId: 3, courseId: 1, assessmentName: "Quiz 1", score: 90 });
    expect(res).toEqual({ ok: false, error: "This student is not enrolled in the course." });
  });

  it("rolls back BOTH the grade and the audit entry when saving fails", async () => {
    const grades = await prisma.grade.count();
    const audits = await prisma.auditLog.count();
    const res = await saveGradeScore(U.t1, { studentId: 1, courseId: 1, assessmentName: "Final", score: 150 });
    expect(res.ok).toBe(false);
    expect(await prisma.grade.count()).toBe(grades);
    expect(await prisma.auditLog.count()).toBe(audits);
  });

  it("cannot rewrite the audit log", async () => {
    await expect(
      withUser(U.t1, (tx) => tx.auditLog.updateMany({ data: { newScore: 100 } })),
    ).rejects.toThrow();
    await expect(withUser(U.t1, (tx) => tx.auditLog.deleteMany())).rejects.toThrow();
  });

  it("cannot read students who are not in their courses", async () => {
    const students = await withUser(U.t1, (tx) => tx.student.findMany());
    expect(students.map((s) => s.studentId).sort()).toEqual([1, 2]);
  });

  it("cannot enroll students", async () => {
    await expect(
      withUser(U.t1, (tx) => tx.enrollment.create({ data: { studentId: 3, courseId: 1 } })),
    ).rejects.toThrow();
  });
});

run("admin role", () => {
  it("finds a student by ID and combines the search with group and course filters", async () => {
    const matching = await getAdminStudents(U.admin, { search: "1", groupId: 1, courseId: 1, page: 1 });
    expect(matching.students.map(({ studentId }) => studentId)).toEqual([1]);
    const excluded = await getAdminStudents(U.admin, { search: "1", groupId: 2, page: 1 });
    expect(excluded.pagination.total).toBe(0);
  });

  it("can read everything", async () => {
    const grades = await withUser(U.admin, (tx) => tx.grade.count());
    expect(grades).toBeGreaterThanOrEqual(3);
  });

  it("can enroll a student, after which a teacher can grade them", async () => {
    await withUser(U.admin, (tx) => tx.enrollment.create({ data: { studentId: 3, courseId: 1 } }));
    const res = await saveGradeScore(U.t1, { studentId: 3, courseId: 1, assessmentName: "Quiz 1", score: 66 });
    expect(res.ok).toBe(true);
  });
});

run("database rules", () => {
  it("rejects a score above 100 at the database level", async () => {
    await expect(
      prisma.grade.create({ data: { studentId: 1, courseId: 1, assessmentId: 1, score: 100.01 } }),
    ).rejects.toThrow();
  });

  it("rejects a negative score at the database level", async () => {
    await expect(
      prisma.grade.create({ data: { studentId: 1, courseId: 1, assessmentId: 1, score: -1 } }),
    ).rejects.toThrow();
  });

  it("rejects a second grade with the same assessment name", async () => {
    await expect(
      prisma.grade.create({ data: { studentId: 1, courseId: 1, assessmentId: 1, score: 10 } }),
    ).rejects.toThrow();
  });

  it("rejects a grade for a student who is not enrolled (composite foreign key)", async () => {
    await expect(
      prisma.grade.create({ data: { studentId: 1, courseId: 2, assessmentId: 2, score: 10 } }),
    ).rejects.toThrow();
  });

  it("does not let an unknown person see anything", async () => {
    const grades = await withUser(U.stranger, (tx) => tx.grade.findMany());
    expect(grades).toHaveLength(0);
  });

  it("gives the anonymous (not signed in) role no access at all", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("set local role anon");
        return tx.grade.findMany();
      }),
    ).rejects.toThrow();
  });
});

run("normalized tables", () => {
  it("persists an assessment without grades", async () => {
    expect(await createAssessment(U.t1, 1, "Empty assessment")).toEqual({ ok: true });
    expect((await getGradebook(U.t1, 1))?.assessments).toContain("Empty assessment");
  });
  it("does not let a student create assessments", async () => {
    expect((await createAssessment(U.s1, 1, "Student assessment")).ok).toBe(false);
  });
  it("does not let a teacher create assessments in another course", async () => {
    expect((await createAssessment(U.t1, 2, "Other assessment")).ok).toBe(false);
  });
  it("rejects an assessment from a different course even for an enrolled student", async () => {
    await expect(prisma.grade.create({ data: { studentId: 2, courseId: 1, assessmentId: 2, score: 80 } })).rejects.toThrow();
  });
  it("reads group names through the relation", async () => {
    expect((await getGradebook(U.t1, 1))?.students[0].groupName).toBe("G1");
  });
  it("rejects a nonexistent group", async () => {
    await expect(prisma.student.create({ data: { fullName: "Invalid", email: "invalid@x.kz", groupId: 999999 } })).rejects.toThrow();
  });
});

run("student self-enrollment and attestations", () => {
  it("lists unjoined courses without exposing their grades", async () => {
    const catalogue = await getStudentCourseCatalogue(U.s1);
    expect(catalogue.find((c) => c.courseId === 2)?.enrolled).toBe(false);
    expect(await withUser(U.s1, (tx) => tx.grade.findMany({ where: { courseId: 2 } }))).toHaveLength(0);
  });
  it("enrolls the signed-in student and rejects duplicates", async () => {
    expect(await selfEnroll(U.s1, 2)).toBe("enrolled");
    expect(await selfEnroll(U.s1, 2)).toBe("already");
    expect((await getAttestations(U.s1)).find((a) => a.courseId === 2)?.average).toBeNull();
  });
  it("cannot enroll somebody else, enroll as a teacher or use a nonexistent course", async () => {
    await expect(withUser(U.s1, (tx) => tx.enrollment.create({ data: { studentId: 3, courseId: 2 } }))).rejects.toThrow();
    expect(await selfEnroll(U.t1, 2)).toBe("failed");
    expect(await selfEnroll(U.s1, 999999)).toBe("failed");
  });
  it("stores both scores, updates without duplicates, and calculates their mean", async () => {
    expect(await saveAttestation(U.t1, { studentId: 1, courseId: 1, attestationNumber: 1, score: 80 })).toEqual({ ok: true });
    expect((await getAttestations(U.s1, 1))[0]).toMatchObject({ first: 80, second: null, average: null });
    expect(await saveAttestation(U.t1, { studentId: 1, courseId: 1, attestationNumber: 2, score: 90 })).toEqual({ ok: true });
    expect((await getAttestations(U.s1, 1))[0].average).toBe(85);
    await saveAttestation(U.t1, { studentId: 1, courseId: 1, attestationNumber: 1, score: 0 });
    expect((await getAttestations(U.s1, 1))[0].average).toBe(45);
    expect(await prisma.attestationResult.count({ where: { studentId: 1, courseId: 1 } })).toBe(2);
  });
  it("prevents student writes, cross-teacher writes, invalid periods and unenrolled results", async () => {
    const input = { studentId: 1, courseId: 1, attestationNumber: 1, score: 100 };
    expect(await saveAttestation(U.s1, input)).toEqual({ ok: false });
    expect(await saveAttestation(U.t2, input)).toEqual({ ok: false });
    expect(await saveAttestation(U.t1, { ...input, attestationNumber: 3 })).toEqual({ ok: false });
    expect(await saveAttestation(U.t1, { ...input, score: 101 })).toEqual({ ok: false });
    expect(await saveAttestation(U.t2, { ...input, studentId: 3, courseId: 2 })).toEqual({ ok: false });
    expect(await withUser(U.s2, (tx) => tx.attestationResult.findMany({ where: { studentId: 1 } }))).toHaveLength(0);
    expect(await withUser(U.t2, (tx) => tx.attestationResult.findMany({ where: { courseId: 1 } }))).toHaveLength(0);
  });
});

run("concurrent grade edits", () => {
  it("creates one grade and records both changes in order", async () => {
    const cell = { studentId: 1, courseId: 1, assessmentName: "Concurrent quiz" };
    const results = await Promise.all([
      saveGradeScore(U.t1, { ...cell, score: 65 }),
      saveGradeScore(U.t1, { ...cell, score: 75 }),
    ]);
    expect(results).toEqual([
      { ok: true, score: 65, changed: true },
      { ok: true, score: 75, changed: true },
    ]);
    const audits = await prisma.auditLog.findMany({
      where: cell,
      orderBy: { auditId: "asc" },
    });
    expect(audits).toHaveLength(2);
    expect(audits[0].action).toBe("CREATE");
    expect(audits[1].action).toBe("UPDATE");
    expect(audits[1].gradeId).toBe(audits[0].gradeId);
    expect(audits[1].oldScore?.toNumber()).toBe(audits[0].newScore?.toNumber());
  });
});
