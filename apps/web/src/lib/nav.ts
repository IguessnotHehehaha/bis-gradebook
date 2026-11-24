import type { Role } from "@gradebook/shared";
import type { MessageKey } from "./i18n/translate";

export interface NavItem {
  href: string;
  /** Text in the navigation bar. */
  label: MessageKey;
  /** Short description on the home page card. */
  description: MessageKey;
  roles: readonly Role[];
}

/**
 * Every page a signed-in person can open (besides Home). The navigation bar and the home page
 * are both built from this list, so adding a page (for example course enrollment or
 * attestation) is one new entry here plus its translations.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/student", label: "nav.grades", description: "home.grades.desc", roles: ["student"] },
  { href: "/student/enrollment", label: "nav.enrollment", description: "home.enrollment.desc", roles: ["student"] },
  { href: "/student/attestations", label: "nav.attestations", description: "home.attestations.desc", roles: ["student"] },
  { href: "/teacher", label: "nav.courses", description: "home.courses.desc", roles: ["teacher"] },
  { href: "/admin", label: "nav.admin", description: "home.admin.desc", roles: ["admin"] },
];

export const navItemsFor = (role: Role) => NAV_ITEMS.filter((i) => i.roles.includes(role));
