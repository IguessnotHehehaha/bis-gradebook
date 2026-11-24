import { en, type MessageKey } from "./en";
import { ru } from "./ru";
import type { Locale } from "./config";

export type { MessageKey };

const dictionaries: Record<Locale, Record<string, string>> = { en, ru };

export type Vars = Record<string, string | number>;

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export interface Translator {
  locale: Locale;
  /** Looks up a message and fills in {placeholders}. */
  t: (key: MessageKey, vars?: Vars) => string;
  /** Picks the right plural form ("count.student" -> ".one" / ".few" / ".many" / ".other") for n. */
  plural: (base: string, n: number, vars?: Vars) => string;
}

export function createTranslator(locale: Locale): Translator {
  const dict = dictionaries[locale];
  const rules = new Intl.PluralRules(locale);
  const t: Translator["t"] = (key, vars) => format(dict[key] ?? en[key], vars);
  const plural: Translator["plural"] = (base, n, vars) => {
    const category = rules.select(n);
    const key = (`${base}.${category}` in dict ? `${base}.${category}` : `${base}.other`) as MessageKey;
    return t(key, { n, ...vars });
  };
  return { locale, t, plural };
}

/** Maps the fixed English messages returned by shared/db code onto translation keys. */
const KNOWN_ERRORS: Record<string, MessageKey> = {
  "Give the assessment a name.": "err.scoreName",
  "Assessment name is too long (max 60 characters).": "err.scoreNameLong",
  "Enter a number like 72 or 72.5": "err.scoreFormat",
  "Score must be between 0 and 100.": "err.scoreRange",
  "This student is already enrolled.": "err.alreadyEnrolled",
  "Only an administrator can enroll students.": "err.onlyAdminEnroll",
  "Could not enroll the student.": "err.enrollFailed",
  "Enter a course and an assessment name (1–60 characters).": "err.assessmentName",
  "You are not allowed to change this grade.": "err.gradeForbidden",
  "This student is not enrolled in the course.": "err.notEnrolledInCourse",
  "Could not save the grade. Please try again.": "err.gradeSaveFailed",
  "That assessment already exists.": "err.assessmentExists",
  "Could not create the assessment. Check your course permissions.": "err.assessmentFailed",
};

/** Translates a known English error message; unknown messages are passed through unchanged. */
export function translateError(tr: Translator, message: string): string {
  const key = KNOWN_ERRORS[message];
  return key ? tr.t(key) : message;
}
