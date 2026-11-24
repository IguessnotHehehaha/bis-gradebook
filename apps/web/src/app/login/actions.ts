"use server";

import { prisma } from "@gradebook/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_COOKIE, devFakeAuth } from "@/lib/env";
import { authRateLimitKey } from "@/lib/login-rate-limit";
import { createRegisteredStudent, provisionRegisteredStudent, registrationName } from "@/lib/student-registration";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";
import { rateLimit } from "@gradebook/shared";

async function checkRateLimit(action: "signin" | "dev-signin" | "signup"): Promise<void> {
  const { ok } = rateLimit(await authRateLimitKey(action));
  if (!ok) redirect(action === "signup" ? "/login?mode=register&error=rate" : "/login?error=rate");
}

export async function signIn(formData: FormData) {
  await checkRateLimit("signin");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(error.code === "email_not_confirmed" ? "/login?error=confirm" : "/login?error=wrong");
  await provisionRegisteredStudent(data.user);
  redirect("/");
}

export async function register(formData: FormData) {
  if (devFakeAuth()) redirect("/login");
  await checkRateLimit("signup");

  const name = registrationName(formData.get("name"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 72) {
    redirect("/login?mode=register&error=invalid");
  }

  const admin = createSupabaseAdminClient().auth.admin;
  const { data, error } = await admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const code = error.code;
    console.warn("Supabase signup rejected", { status: error.status, code });
    const reason =
      code === "weak_password" ? "password"
      : code === "email_address_invalid" ? "invalid-email"
      : code === "over_request_rate_limit" ? "provider-rate"
      : code === "user_already_exists" || code === "email_exists" ? "duplicate"
      : "failed";
    redirect(`/login?mode=register&error=${reason}`);
  }

  const id = data.user.id;
  let profileCreated = false;
  try {
    profileCreated = await createRegisteredStudent({ id, email, name });
  } catch {
    console.error("Could not create student profile for new Auth account");
  }
  if (!profileCreated) {
    const { error: rollbackError } = await admin.deleteUser(id);
    if (rollbackError) console.error("Could not roll back new Auth account", { id, code: rollbackError.code });
    redirect("/login?mode=register&error=failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) redirect("/login?status=created");
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
