import { prisma } from "@gradebook/db";
import type { Actor, Role } from "@gradebook/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEV_COOKIE, devFakeAuth } from "./env";
import type { Locale, Theme } from "./i18n/config";
import { createSupabaseServerClient } from "./supabase";

export interface SessionUser extends Actor {
  email: string;
  /** The person's name, or null for an administrator (who has no profile row). */
  displayName: string | null;
  theme: Theme;
  locale: Locale;
}

/** The id of the signed-in login (Supabase Auth user), or null. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  if (devFakeAuth()) {
    return (await cookies()).get(DEV_COOKIE)?.value ?? null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * The signed-in person with their role. Null when nobody is signed in, or when the
 * login has no row in app_users yet (an administrator still has to set the account up).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const id = await getAuthUserId();
  if (!id) return null;
  // Trusted lookup (bypasses row level security) just to learn who this login is.
  const u = await prisma.appUser.findUnique({
    where: { id },
    select: {
      id: true, email: true, role: true, studentId: true, teacherId: true, theme: true, locale: true,
      student: { select: { fullName: true } },
      teacher: { select: { fullName: true } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role.toLowerCase() as Role,
    studentId: u.studentId,
    teacherId: u.teacherId,
    displayName: u.student?.fullName ?? u.teacher?.fullName ?? null,
    theme: u.theme.toLowerCase() as Theme,
    locale: u.locale.toLowerCase() as Locale,
  };
});

/** Page guard: sends visitors to the login page, or to their own home when the role is wrong. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/");
  return user;
}
