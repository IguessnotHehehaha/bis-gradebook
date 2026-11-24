import { prisma } from "@gradebook/db";
import { redirect } from "next/navigation";
import { devFakeAuth } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { getAuthUserId, getSessionUser } from "@/lib/session";
import { devSignIn, signIn, signOut } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mins?: string }>;
}) {
  const { error: errorCode, mins } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/");
  const { t } = await getT();
  const signedInButNotSetUp = Boolean(await getAuthUserId());

  const error =
    errorCode === "wrong" ? t("login.error.wrongCredentials")
    : errorCode === "unknown" ? t("login.error.unknownPerson")
    : errorCode === "rate" ? t("login.error.tooMany", { mins: Number(mins) || 1 })
    : undefined;

  if (signedInButNotSetUp) {
    return (
      <main className="narrow card stack">
        <h1>{t("login.notSetUp.title")}</h1>
        <p className="muted">{t("login.notSetUp.body")}</p>
        <form action={signOut}>
          <button className="primary">{t("nav.signOut")}</button>
        </form>
      </main>
    );
  }

  if (devFakeAuth()) {
    const people = await prisma.appUser.findMany({
      include: { student: true, teacher: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    });
    const groups = [
      ["ADMIN", t("role.admins")],
      ["TEACHER", t("role.teachers")],
      ["STUDENT", t("role.students")],
    ] as const;
    return (
      <main className="narrow card stack">
        <h1>{t("login.title")}</h1>
        <p className="notice">{t("login.dev.notice")}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <form action={devSignIn} className="stack">
          <label>
            {t("login.dev.signInAs")}
            <select name="userId" required defaultValue="">
              <option value="" disabled>{t("login.dev.choose")}</option>
              {groups.map(([role, label]) => (
                <optgroup key={role} label={label}>
                  {people
                    .filter((p) => p.role === role)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.student?.fullName ?? p.teacher?.fullName ?? t("role.administrator")} ({p.email})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="primary">{t("login.dev.continue")}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="narrow card stack">
      <h1>{t("login.title")}</h1>
      <p className="muted">{t("login.intro")}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={signIn} className="stack">
        <label>
          {t("login.email")}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t("login.password")}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="primary">{t("login.title")}</button>
      </form>
    </main>
  );
}
