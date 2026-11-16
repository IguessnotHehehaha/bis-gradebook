/** Name of the cookie used by the development-only "sign in as" shortcut. */
export const DEV_COOKIE = "dev_user_id";

/**
 * Development shortcut: lets you sign in as any seeded person without Supabase Auth.
 * Needs DEV_FAKE_AUTH=true AND is always off in production builds.
 */
export function devFakeAuth(): boolean {
  return process.env.DEV_FAKE_AUTH === "true" && process.env.NODE_ENV !== "production";
}

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env " +
        "(or set DEV_FAKE_AUTH=true for local development).",
    );
  }
  return { url, key };
}
