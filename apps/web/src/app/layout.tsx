import type { Metadata } from "next";
import Link from "next/link";
import { homePathFor } from "@gradebook/shared";
import { signOut } from "./login/actions";
import { getSessionUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradebook",
  description: "Electronic gradebook for students, teachers and administrators",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href={user ? homePathFor(user.role) : "/login"} className="brand">
            Gradebook
          </Link>
          {user && (
            <div className="who">
              <span>
                {user.displayName} <span className="badge">{user.role}</span>
              </span>
              <form action={signOut}>
                <button className="link">Sign out</button>
              </form>
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
