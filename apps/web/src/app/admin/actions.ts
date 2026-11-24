"use server";
import { randomUUID } from "node:crypto";
import { createManagedCourse, createManagedStudent, createManagedTeacher, deleteManagedUser, enrollStudent } from "@gradebook/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { devFakeAuth } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";
import { rateLimit } from "@gradebook/shared";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ??
         h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
         "unknown";
}

async function checkRateLimit(action: string, view: "students" | "courses" | "accounts"): Promise<void> {
  const ip = await getClientIp();
  const { ok, resetAt } = rateLimit(`admin:${action}:${ip}`);
  if (!ok) {
    const mins = Math.ceil((resetAt - Date.now()) / 60000);
    redirect(`/admin?view=${view}&status=rate-limited&mins=${mins}`);
  }
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/");
  return user;
}
async function newAccount(email: string, password: string): Promise<string> {
  if (devFakeAuth()) return randomUUID();
  const { data, error } = await createSupabaseAdminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  return data.user.id;
}
async function rollbackAccount(id: string) {
  if (!devFakeAuth()) await createSupabaseAdminClient().auth.admin.deleteUser(id);
}
const required = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const validAccount = (email: string, password: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8;

export async function createStudentAction(formData: FormData) {
  await checkRateLimit("create-student", "students");
  const user = await requireAdmin();
  const name = required(formData, "name");
  const email = required(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const groupId = Number(formData.get("groupId"));
  if (!name || name.length > 120 || !validAccount(email, password) || !Number.isInteger(groupId) || groupId < 1) redirect("/admin?view=students&status=invalid");
  let id: string | undefined;
  try {
    id = await newAccount(email, password);
    await createManagedStudent(user.id, { id, email, name, groupId });
  } catch (error) {
    if (id) await rollbackAccount(id).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    redirect(`/admin?view=students&status=${/unique|P2002|already registered/i.test(message) ? "duplicate" : "failed"}`);
  }
  revalidatePath("/admin");
  redirect("/admin?view=students&status=created");
}

export async function createTeacherAction(formData: FormData) {
  await checkRateLimit("create-teacher", "accounts");
  const user = await requireAdmin();
  const name = required(formData, "name");
  const email = required(formData, "email").toLowerCase();
  const department = required(formData, "department");
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 120 || !department || department.length > 120 || !validAccount(email, password)) redirect("/admin?view=accounts&status=invalid");
  let id: string | undefined;
  try {
    id = await newAccount(email, password);
    await createManagedTeacher(user.id, { id, email, name, department });
  } catch (error) {
    if (id) await rollbackAccount(id).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    redirect(`/admin?view=accounts&status=${/unique|P2002|already registered/i.test(message) ? "duplicate" : "failed"}`);
  }
  revalidatePath("/admin");
  redirect("/admin?view=accounts&status=created");
}

export async function createCourseAction(formData: FormData) {
  await checkRateLimit("create-course", "courses");
  const user = await requireAdmin();
  const courseName = required(formData, "courseName");
  const semester = required(formData, "semester");
  const teacherId = Number(formData.get("teacherId"));
  if (!courseName || courseName.length > 120 || !semester || semester.length > 80 || !Number.isInteger(teacherId) || teacherId < 1) redirect("/admin?view=courses&status=invalid");
  try {
    await createManagedCourse(user.id, { courseName, semester, teacherId });
  } catch {
    redirect("/admin?view=courses&status=failed");
  }
  revalidatePath("/admin");
  redirect("/admin?view=courses&status=created");
}

export async function deleteUserAction(formData: FormData) {
  await checkRateLimit("delete-user", "accounts");
  const user = await requireAdmin();
  const id = required(formData, "userId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin?view=accounts&status=invalid");
  try {
    await deleteManagedUser(user.id, id);
    if (!devFakeAuth()) {
      const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(id);
      if (error) throw new Error("auth-delete-failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "auth-delete-failed" ? "auth-delete-failed" : message.includes("own account") ? "self-delete" : message.includes("last administrator") ? "last-admin" : message.includes("history") ? "has-history" : "failed";
    redirect(`/admin?view=accounts&status=${status}`);
  }
  revalidatePath("/admin");
  redirect("/admin?view=accounts&status=deleted");
}

export async function enrollAction(formData: FormData) {
  const user = await requireAdmin();
  const studentId = Number(formData.get("studentId"));
  const courseId = Number(formData.get("courseId"));
  if (!Number.isInteger(studentId) || !Number.isInteger(courseId) || studentId <= 0 || courseId <= 0) redirect("/admin?view=courses&status=invalid");
  const res = await enrollStudent(user.id, studentId, courseId);
  revalidatePath("/admin");
  redirect(`/admin?view=courses&status=${res.ok ? "enrolled" : res.error.includes("already") ? "already" : "failed"}`);
}
