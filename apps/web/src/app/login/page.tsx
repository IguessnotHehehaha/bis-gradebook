import { prisma } from "@gradebook/db";
import { getRateLimitInfo } from "@gradebook/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignInCard, { SignInButton, SignInFields } from "@/components/ui/travel-connect-signin-1";
import { devFakeAuth } from "@/lib/env";
import { authRateLimitKey } from "@/lib/login-rate-limit";
import { getT } from "@/lib/i18n/server";
import { getAuthUserId, getSessionUser } from "@/lib/session";
import { devSignIn, register, signIn, signOut } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; status?: string }>;
}) {
  const { error: errorCode, mode, status } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/");
  const { t } = await getT();
  const signedInButNotSetUp = Boolean(await getAuthUserId());

  const development = devFakeAuth();
  const registering = !development && mode === "register";
  const { remaining, resetAt } = getRateLimitInfo(await authRateLimitKey(
    registering ? "signup" : development ? "dev-signin" : "signin",
  ));
  const mins = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
  const error =
    errorCode === "wrong" ? t("login.error.wrongCredentials")
    : errorCode === "unknown" ? t("login.error.unknownPerson")
    : errorCode === "confirm" ? t("login.error.confirmEmail")
    : errorCode === "invalid" && registering ? t("login.register.invalid")
    : errorCode === "password" && registering ? t("login.register.password")
    : errorCode === "invalid-email" && registering ? t("login.register.invalidEmail")
    : errorCode === "duplicate" && registering ? t("login.register.duplicate")
    : errorCode === "provider-rate" && registering ? t("login.register.providerRate")
    : errorCode === "failed" && registering ? t("login.register.failed")
    : remaining === 0 ? t("login.error.tooMany", { mins })
    : undefined;

  const brand = { appName: t("app.name"), description: t("app.description") };
  const attempts = (
    <p className="mt-4 text-sm text-muted-foreground" role="status">
      {t("login.attemptsRemaining", { count: remaining })}
      {remaining === 0 && errorCode && errorCode !== "rate" && ` · ${t("login.retryIn", { mins })}`}
    </p>
  );
  const pendingLabel = t("login.pending");

  if (signedInButNotSetUp) {
    return (
      <SignInCard {...brand} title={t("login.notSetUp.title")} intro={t("login.notSetUp.body")}>
        <form action={signOut}>
          <SignInButton pendingLabel={t("nav.signOut")}>{t("nav.signOut")}</SignInButton>
        </form>
      </SignInCard>
    );
  }

  if (development) {
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
      <SignInCard {...brand} title={t("login.title")} intro={t("login.dev.notice")} error={error}>
        <form action={devSignIn} className="grid gap-5">
          <label>
            {t("login.dev.signInAs")}
            <select name="userId" required defaultValue="" className="min-h-11 w-full rounded-lg border-input bg-background px-3 text-sm text-foreground">
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
          <SignInButton pendingLabel={pendingLabel}>{t("login.title")}</SignInButton>
        </form>
        {attempts}
      </SignInCard>
    );
  }

  return (
    <SignInCard
      {...brand}
      title={t(registering ? "login.register.title" : "login.title")}
      intro={t(registering ? "login.register.intro" : "login.intro")}
      error={error}
    >
      {!registering && status === "created" && (
        <p role="status" className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          {t("login.register.created")}
        </p>
      )}
      <form action={registering ? register : signIn} className="grid gap-5">
        {registering && (
          <label>
            {t("login.register.name")}
            <input name="name" autoComplete="name" required maxLength={120} className="min-h-11 w-full rounded-lg border-input bg-background px-3 text-sm text-foreground" />
          </label>
        )}
        <SignInFields
          email={t("login.email")}
          password={t("login.password")}
          show={t("login.showPassword")}
          hide={t("login.hidePassword")}
          registration={registering}
        />
        <SignInButton pendingLabel={registering ? t("login.register.pending") : pendingLabel}>
          {t(registering ? "login.register.title" : "login.title")}
        </SignInButton>
      </form>
      {!registering && attempts}
      <Link
        href={registering ? "/login" : "/login?mode=register"}
        className="mt-4 w-fit text-sm font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300"
      >
        {t(registering ? "login.register.back" : "login.register.title")}
      </Link>
    </SignInCard>
  );
}
