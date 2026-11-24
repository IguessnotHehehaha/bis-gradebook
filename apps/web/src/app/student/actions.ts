"use server";

import { selfEnroll } from "@gradebook/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export async function selfEnrollAction(form: FormData) {
  const user = await requireRole("student");
  const result = await selfEnroll(user.id, Number(form.get("courseId")));
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  revalidatePath("/student/enrollment");
  revalidatePath("/student/attestations");
  redirect(`/student/enrollment?enrollment=${result}`);
}
