import { cookies } from "next/headers";
import { cache } from "react";
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  isTheme,
  type Locale,
  type Theme,
} from "./i18n/config";
import { getSessionUser } from "./session";

export interface Preferences {
  theme: Theme;
  locale: Locale;
}

/**
 * Interface settings for this request. A signed-in person's saved settings (app_users table)
 * win, so they follow them to any device; visitors who are not signed in (the login page)
 * use the values stored in cookies.
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const user = await getSessionUser();
  if (user) return { theme: user.theme, locale: user.locale };
  const jar = await cookies();
  const theme = jar.get(THEME_COOKIE)?.value;
  const locale = jar.get(LOCALE_COOKIE)?.value;
  return {
    theme: isTheme(theme) ? theme : DEFAULT_THEME,
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
  };
});
