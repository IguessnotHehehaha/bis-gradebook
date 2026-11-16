"use server";

import { saveGradeScore } from "@gradebook/db";
import { saveScoreSchema, type SaveScoreInput } from "@gradebook/shared";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";

export type SaveScoreResult = { ok: true; score: number } | { ok: false; error: string };

/**
 * Saves one score. Students are refused here, and the database checks again that the teacher
 * teaches this course and that the student is enrolled in it.
 */
export async function saveScoreAction(input: SaveScoreInput): Promise<SaveScoreResult> {
  const user = await getSessionUser();
  if (!user || user.role === "student") return { ok: false, error: "You are not allowed to change grades." };

  const parsed = saveScoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid score." };

  const res = await saveGradeScore(user.id, parsed.data);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/teacher");
  return { ok: true, score: res.score };
}
