"use server";

import { setUserPreferences } from "@gradebook/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Saves the chosen theme and/or language: in the user's profile when signed in, and in cookies for visitors. */
export async function setPreferenceAction(formData: FormData) {
  const theme = formData.get("theme");
  const locale = formData.get("locale");
  const next = {
    ...(isTheme(theme) && { theme }),
    ...(isLocale(locale) && { locale }),
  };
  if (Object.keys(next).length === 0) return;

  const jar = await cookies();
  const options = { path: "/", maxAge: ONE_YEAR, sameSite: "lax" as const };
  if (next.theme) jar.set(THEME_COOKIE, next.theme, options);
  if (next.locale) jar.set(LOCALE_COOKIE, next.locale, options);

  const user = await getSessionUser();
  if (user) await setUserPreferences(user.id, next);
  revalidatePath("/", "layout");
}
