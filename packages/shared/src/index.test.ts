import { describe, expect, it } from "vitest";
import {
  average,
  canEditGrade,
  canManageEnrollments,
  canViewStudentGrades,
  homePathFor,
  isLow,
  rateLimit,
  saveScoreSchema,
  type Actor,
} from "./index";

const student: Actor = { id: "s", role: "student", studentId: 1, teacherId: null };
const teacher: Actor = { id: "t", role: "teacher", studentId: null, teacherId: 7 };
const admin: Actor = { id: "a", role: "admin", studentId: null, teacherId: null };

describe("access rules", () => {
  it("students cannot edit grades", () => {
    expect(canEditGrade(student, { teacherId: 7 }, true).ok).toBe(false);
  });
  it("a teacher can grade an enrolled student in their own course", () => {
    expect(canEditGrade(teacher, { teacherId: 7 }, true).ok).toBe(true);
  });
  it("a teacher cannot grade in another teacher's course", () => {
    expect(canEditGrade(teacher, { teacherId: 8 }, true).ok).toBe(false);
  });
  it("a teacher cannot grade a student who is not enrolled", () => {
    expect(canEditGrade(teacher, { teacherId: 7 }, false).ok).toBe(false);
  });
  it("a student sees only their own grades", () => {
    expect(canViewStudentGrades(student, 1).ok).toBe(true);
    expect(canViewStudentGrades(student, 2).ok).toBe(false);
  });
  it("only admins manage enrollments", () => {
    expect(canManageEnrollments(admin).ok).toBe(true);
    expect(canManageEnrollments(teacher).ok).toBe(false);
  });
  it("sends each role to its own home page", () => {
    expect(homePathFor("student")).toBe("/student");
    expect(homePathFor("teacher")).toBe("/teacher");
    expect(homePathFor("admin")).toBe("/admin");
  });
});

describe("score validation", () => {
  const base = { courseId: "1", studentId: "2", assessmentName: "Quiz 1" };
  it("accepts 0, 72.5 and 100", () => {
    for (const s of ["0", "72.5", "72,5", "100"]) {
      expect(saveScoreSchema.safeParse({ ...base, score: s }).success).toBe(true);
    }
  });
  it("rejects 101, -1, text and empty", () => {
    for (const s of ["101", "-1", "abc", ""]) {
      expect(saveScoreSchema.safeParse({ ...base, score: s }).success).toBe(false);
    }
  });
  it("rejects an empty assessment name", () => {
    expect(saveScoreSchema.safeParse({ ...base, assessmentName: "  ", score: "50" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("flags results below 50", () => {
    expect(isLow(49.9)).toBe(true);
    expect(isLow(50)).toBe(false);
  });

  describe("rate limiting", () => {
    it("allows ten attempts and rejects the eleventh", () => {
      const key = `test-rate-limit-${crypto.randomUUID()}`;

      for (let attempt = 1; attempt <= 10; attempt++) {
        const result = rateLimit(key);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(10 - attempt);
      }

      expect(rateLimit(key)).toMatchObject({ ok: false, remaining: 0 });
    });
  });
  it("averages to one decimal and handles no scores", () => {
    expect(average([50, 75])).toBe(62.5);
    expect(average([])).toBeNull();
  });
});
