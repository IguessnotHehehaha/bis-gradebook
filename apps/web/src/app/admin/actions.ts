"use server";

import { enrollStudent } from "@gradebook/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export async function enrollAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/");

  const studentId = Number(formData.get("studentId"));
  const courseId = Number(formData.get("courseId"));
  if (!Number.isInteger(studentId) || !Number.isInteger(courseId) || studentId <= 0 || courseId <= 0) {
    redirect("/admin?status=invalid");
  }

  const res = await enrollStudent(user.id, studentId, courseId);
  revalidatePath("/admin");
  redirect(`/admin?status=${res.ok ? "enrolled" : res.error.includes("already") ? "already" : "failed"}`);
}
