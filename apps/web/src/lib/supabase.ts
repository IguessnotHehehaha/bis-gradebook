import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Supabase client for server components and server actions (reads/writes the session cookie). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component: the middleware refreshes the session instead.
        }
      },
    },
  });
}


/** Privileged Auth client for server-side account management. */
export function createSupabaseAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY to manage Supabase accounts.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
