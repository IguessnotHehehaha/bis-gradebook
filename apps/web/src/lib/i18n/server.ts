import { getPreferences } from "../preferences";
import { createTranslator, type Translator } from "./translate";

/** Translator for the current request, in the signed-in person's (or visitor's) language. */
export async function getT(): Promise<Translator> {
  const { locale } = await getPreferences();
  return createTranslator(locale);
}
