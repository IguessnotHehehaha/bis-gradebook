import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { signOut } from "./login/actions";
import { NavLinks } from "@/components/NavLinks";
import { PreferenceControls } from "@/components/PreferenceControls";
import { I18nProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import { navItemsFor } from "@/lib/nav";
import { getPreferences } from "@/lib/preferences";
import { getSessionUser } from "@/lib/session";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161c23" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("app.name"), description: t("app.description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const { theme, locale } = await getPreferences();
  const { t } = await getT();
  const links = user
    ? [{ href: "/", label: t("nav.home") }, ...navItemsFor(user.role).map((i) => ({ href: i.href, label: t(i.label) }))]
    : [];

  return (
    <html lang={locale} data-theme={theme} className={theme === "dark" ? "dark" : undefined}>
      <body>
        <I18nProvider locale={locale}>
          <header className="topbar">
            <Link href={user ? "/" : "/login"} className="brand">
              {t("app.name")}
            </Link>
            {user && <NavLinks links={links} label={t("nav.label")} />}
            <div className="who">
              <PreferenceControls />
              {user && (
                <>
                  <span className="who-name">
                    {user.displayName ?? t("role.administrator")} <span className="badge">{t(`role.${user.role}`)}</span>
                  </span>
                  <form action={signOut}>
                    <button className="link">{t("nav.signOut")}</button>
                  </form>
                </>
              )}
            </div>
          </header>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
