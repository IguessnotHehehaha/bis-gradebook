import { prisma } from "./client";
import type { Locale, Theme } from "./generated/client";

export type Preferences = { theme: "light" | "dark"; locale: "en" | "ru" };

const toDb = {
  theme: { light: "LIGHT", dark: "DARK" },
  locale: { en: "EN", ru: "RU" },
} as const satisfies { theme: Record<Preferences["theme"], Theme>; locale: Record<Preferences["locale"], Locale> };

/**
 * Saves a person's interface preferences. Trusted write (like the session lookup): the caller
 * passes the id of the signed-in user, and only that user's own row is touched.
 */
export async function setUserPreferences(userId: string, prefs: Partial<Preferences>): Promise<void> {
  await prisma.appUser.update({
    where: { id: userId },
    data: {
      ...(prefs.theme && { theme: toDb.theme[prefs.theme] }),
      ...(prefs.locale && { locale: toDb.locale[prefs.locale] }),
    },
  });
}
