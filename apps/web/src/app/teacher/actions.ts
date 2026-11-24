"use server";

import { createAssessment, saveGradeScore } from "@gradebook/db";
import { saveScoreSchema, type SaveScoreInput } from "@gradebook/shared";
import { revalidatePath } from "next/cache";
import { getT } from "@/lib/i18n/server";
import { translateError } from "@/lib/i18n/translate";
import { getSessionUser } from "@/lib/session";

export type SaveScoreResult = { ok: true; score: number } | { ok: false; error: string };

/**
 * Saves one score. Students are refused here, and the database checks again that the teacher
 * teaches this course and that the student is enrolled in it.
 */
export async function saveScoreAction(input: SaveScoreInput): Promise<SaveScoreResult> {
  const tr = await getT();
  const user = await getSessionUser();
  if (!user || user.role === "student") return { ok: false, error: tr.t("err.notAllowedGrades") };

  const parsed = saveScoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: translateError(tr, parsed.error.issues[0]?.message ?? tr.t("err.invalidScore")) };

  const res = await saveGradeScore(user.id, parsed.data);
  if (!res.ok) return { ok: false, error: translateError(tr, res.error) };
  revalidatePath("/teacher");
  return { ok: true, score: res.score };
}

export async function createAssessmentAction(courseId: number, assessmentName: string) {
  const tr = await getT();
  const user = await getSessionUser();
  if (!user || user.role === "student") return { ok: false as const, error: tr.t("err.notAllowedAssessments") };
  const result = await createAssessment(user.id, courseId, assessmentName);
  if (result.ok) revalidatePath(`/teacher/${courseId}`);
  return result.ok ? result : { ok: false as const, error: translateError(tr, result.error) };
}
