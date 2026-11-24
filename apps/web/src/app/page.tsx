import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { navItemsFor } from "@/lib/nav";
import { getSessionUser } from "@/lib/session";

/** Main page: a card for every page this person may open. */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { t } = await getT();
  const items = navItemsFor(user.role);

  return (
    <main className="page stack">
      <div className="hero">
        <h1>{t("home.welcome", { name: user.displayName ?? t("role.administrator") })}</h1>
        <p className="muted">{t("home.subtitle")}</p>
      </div>
      <div className="cards">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="card course-card">
            <h2>{t(item.label)}</h2>
            <p className="muted">{t(item.description)}</p>
            <p className="open-link">{t("home.open")}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
