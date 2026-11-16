import { prisma } from "@gradebook/db";
import { homePathFor } from "@gradebook/shared";
import { redirect } from "next/navigation";
import { devFakeAuth } from "@/lib/env";
import { getAuthUserId, getSessionUser } from "@/lib/session";
import { devSignIn, signIn, signOut } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));
  const signedInButNotSetUp = Boolean(await getAuthUserId());

  if (signedInButNotSetUp) {
    return (
      <main className="narrow card stack">
        <h1>Your account is not set up yet</h1>
        <p className="muted">You are signed in, but an administrator has not given your account a role yet. Please ask them to add you.</p>
        <form action={signOut}>
          <button className="primary">Sign out</button>
        </form>
      </main>
    );
  }

  if (devFakeAuth()) {
    const people = await prisma.appUser.findMany({
      include: { student: true, teacher: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    });
    return (
      <main className="narrow card stack">
        <h1>Sign in</h1>
        <p className="notice">Development mode: pick who you want to be. This shortcut does not exist in production.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <form action={devSignIn} className="stack">
          <label>
            Sign in as
            <select name="userId" required defaultValue="">
              <option value="" disabled>Choose a person…</option>
              {(["ADMIN", "TEACHER", "STUDENT"] as const).map((role) => (
                <optgroup key={role} label={role.charAt(0) + role.slice(1).toLowerCase() + "s"}>
                  {people
                    .filter((p) => p.role === role)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.student?.fullName ?? p.teacher?.fullName ?? "Administrator"} ({p.email})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="primary">Continue</button>
        </form>
      </main>
    );
  }

  return (
    <main className="narrow card stack">
      <h1>Sign in</h1>
      <p className="muted">Use the email and password you were given.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={signIn} className="stack">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="primary">Sign in</button>
      </form>
    </main>
  );
}
