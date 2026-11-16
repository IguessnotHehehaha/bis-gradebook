"use server";

import { prisma } from "@gradebook/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_COOKIE, devFakeAuth } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent("Wrong email or password."));
  redirect("/");
}

/** Development only (DEV_FAKE_AUTH=true): act as one of the seeded people. */
export async function devSignIn(formData: FormData) {
  if (!devFakeAuth()) throw new Error("Not available.");
  const id = String(formData.get("userId") ?? "");
  const exists = /^[0-9a-f-]{36}$/i.test(id) && (await prisma.appUser.findUnique({ where: { id } }));
  if (!exists) redirect("/login?error=" + encodeURIComponent("Unknown person."));
  (await cookies()).set(DEV_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signOut() {
  if (devFakeAuth()) {
    (await cookies()).delete(DEV_COOKIE);
  } else {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
