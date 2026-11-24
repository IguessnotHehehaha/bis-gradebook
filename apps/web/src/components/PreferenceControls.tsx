import { setPreferenceAction } from "@/app/preferences-actions";
import { LOCALES } from "@/lib/i18n/config";
import { getPreferences } from "@/lib/preferences";
import { getT } from "@/lib/i18n/server";

/** Theme toggle and language switcher shown in the header. Plain forms, so they work without JavaScript. */
export async function PreferenceControls() {
  const { theme, locale } = await getPreferences();
  const { t } = await getT();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="prefs">
      <form action={setPreferenceAction}>
        <input type="hidden" name="theme" value={nextTheme} />
        <button
          className="icon-btn"
          title={t(nextTheme === "dark" ? "prefs.theme.toDarkLabel" : "prefs.theme.toLightLabel")}
          aria-label={t(nextTheme === "dark" ? "prefs.theme.toDarkLabel" : "prefs.theme.toLightLabel")}
        >
          <span aria-hidden="true">{nextTheme === "dark" ? "☾" : "☀"}</span>{" "}
          <span className="btn-label">{t(nextTheme === "dark" ? "prefs.theme.toDark" : "prefs.theme.toLight")}</span>
        </button>
      </form>
      <div className="seg" role="group" aria-label={t("prefs.language")}>
        {LOCALES.map((l) => (
          <form key={l} action={setPreferenceAction}>
            <input type="hidden" name="locale" value={l} />
            <button aria-pressed={l === locale} lang={l}>{l.toUpperCase()}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
