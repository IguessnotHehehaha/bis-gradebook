import { prisma } from "@gradebook/db";
import { homePathFor, type Actor, type Role } from "@gradebook/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEV_COOKIE, devFakeAuth } from "./env";
import { createSupabaseServerClient } from "./supabase";

export interface SessionUser extends Actor {
  email: string;
  displayName: string;
}

/** The id of the signed-in login (Supabase Auth user), or null. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  if (devFakeAuth()) {
    return (await cookies()).get(DEV_COOKIE)?.value ?? null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser(); // verified with Supabase, not just read from the cookie
  return data.user?.id ?? null;
});

/**
 * The signed-in person with their role. Null when nobody is signed in, or when the
 * login has no row in app_users yet (an administrator still has to set the account up).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const id = await getAuthUserId();
  if (!id) return null;
  // Trusted lookup (bypasses row level security) just to learn who this login is.
  const u = await prisma.appUser.findUnique({ where: { id }, include: { student: true, teacher: true } });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role.toLowerCase() as Role,
    studentId: u.studentId,
    teacherId: u.teacherId,
    displayName: u.student?.fullName ?? u.teacher?.fullName ?? "Administrator",
  };
});

/** Page guard: sends visitors to the login page, or to their own home when the role is wrong. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homePathFor(user.role));
  return user;
}
