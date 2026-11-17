import { z } from "zod";
export { getRateLimitInfo, rateLimit } from "./rate-limit";

/** The three kinds of people who use the system. */
export type Role = "student" | "teacher" | "admin";

/** The signed-in person, as the rules below need to know them. */
export interface Actor {
  id: string;
  role: Role;
  studentId: number | null;
  teacherId: number | null;
}

/** Results below this mark are flagged so the teacher can offer help. */
export const PASS_MARK = 50;
export const MAX_SCORE = 100;

export function isLow(score: number): boolean {
  return score < PASS_MARK;
}

export function average(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

export type Decision = { ok: true } | { ok: false; reason: string };

/**
 * Plain-language access rules. The database enforces the same rules (row level
 * security); these functions let the app hide controls and give friendly messages.
 */
export function canViewStudentGrades(actor: Actor, studentId: number): Decision {
  if (actor.role === "admin") return { ok: true };
  if (actor.role === "student" && actor.studentId === studentId) return { ok: true };
  return { ok: false, reason: "You can only see your own grades." };
}

export function canEditGrade(
  actor: Actor,
  course: { teacherId: number },
  studentIsEnrolled: boolean,
): Decision {
  if (actor.role === "student") {
    return { ok: false, reason: "Students cannot change grades." };
  }
  if (actor.role === "teacher" && actor.teacherId !== course.teacherId) {
    return { ok: false, reason: "You can only grade courses you teach." };
  }
  if (!studentIsEnrolled) {
    return { ok: false, reason: "This student is not enrolled in the course." };
  }
  return { ok: true };
}

export function canManageEnrollments(actor: Actor): Decision {
  return actor.role === "admin"
    ? { ok: true }
    : { ok: false, reason: "Only an administrator can enroll students." };
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role): string {
  switch (role) {
    case "student":
      return "/student";
    case "teacher":
      return "/teacher";
    case "admin":
      return "/admin";
  }
}

/** Validation for entering a score (also used on the server before saving). */
export const saveScoreSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive(),
  assessmentName: z
    .string()
    .trim()
    .min(1, "Give the assessment a name.")
    .max(60, "Assessment name is too long (max 60 characters)."),
  score: z
    .string()
    .trim()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Enter a number like 72 or 72.5")
    .transform((s) => Number(s.replace(",", ".")))
    .refine((n) => n >= 0 && n <= MAX_SCORE, `Score must be between 0 and ${MAX_SCORE}.`),
});

export type SaveScoreInput = z.input<typeof saveScoreSchema>;
