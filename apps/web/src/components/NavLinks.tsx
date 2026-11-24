"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
}

/** The page links in the header; the page you are on is highlighted. */
export function NavLinks({ links, label }: { links: NavLink[]; label: string }) {
  const pathname = usePathname();
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  // The most specific link wins, so /student/enrollment does not also light up /student.
  const best = links.filter((l) => matches(l.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === best;
  return (
    <nav className="nav" aria-label={label}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
