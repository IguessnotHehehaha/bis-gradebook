"use server";

import { prisma } from "@gradebook/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DEV_COOKIE, devFakeAuth } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";
import { rateLimit } from "@gradebook/shared";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ??
         h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
         "unknown";
}

async function checkRateLimit(action: string): Promise<void> {
  const ip = await getClientIp();
  const { ok, resetAt } = rateLimit(`${action}:${ip}`);
  if (!ok) {
    const mins = Math.ceil((resetAt - Date.now()) / 60000);
    redirect(`/login?error=rate&mins=${mins}`);
  }
}

export async function signIn(formData: FormData) {
  await checkRateLimit("signin");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=wrong");
  redirect("/");
}

/** Development only (DEV_FAKE_AUTH=true): act as one of the seeded people. */
export async function devSignIn(formData: FormData) {
  await checkRateLimit("dev-signin");

  if (!devFakeAuth()) throw new Error("Not available.");
  const id = String(formData.get("userId") ?? "");
  const exists = /^[0-9a-f-]{36}$/i.test(id) && (await prisma.appUser.findUnique({ where: { id } }));
  if (!exists) redirect("/login?error=unknown");
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
