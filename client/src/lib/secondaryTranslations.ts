import { SECONDARY_TRANSLATION_PACKAGE_URLS } from "@/data/sources";

export const secondaryTranslationLanguages = [
  { code: "ru", name: "Русский", label: "Russian", lang: "ru" },
  { code: "uk", name: "Українська", label: "Ukrainian", lang: "uk" },
  { code: "es", name: "Español", label: "Spanish", lang: "es" },
  { code: "it", name: "Italiano", label: "Italian", lang: "it" },
  { code: "zh", name: "中文", label: "Chinese", lang: "zh-Hans" },
  { code: "th", name: "ไทย", label: "Thai", lang: "th" },
  { code: "pt", name: "Português", label: "Portuguese", lang: "pt" },
  { code: "hi", name: "हिन्दी", label: "Hindi", lang: "hi" },
  { code: "bn", name: "বাংলা", label: "Bengali", lang: "bn" },
] as const;

export type SecondaryTranslationLanguage = (typeof secondaryTranslationLanguages)[number]["code"];
type PackagedLanguage = keyof typeof SECONDARY_TRANSLATION_PACKAGE_URLS;

/** Packaged languages whose translations have not been proof-read yet. */
const DRAFT_LANGUAGES: ReadonlySet<SecondaryTranslationLanguage> = new Set<SecondaryTranslationLanguage>(["zh"]);

export function isDraftSecondaryTranslation(language: SecondaryTranslationLanguage | null) {
  return language !== null && DRAFT_LANGUAGES.has(language);
}

/**
 * Languages offered in the reader. A static copy of the site (GitHub Pages) has
 * no server to translate on demand, so it offers only the packaged ones.
 */
export const availableSecondaryTranslationLanguages = import.meta.env.VITE_STATIC_SITE === "true"
  ? secondaryTranslationLanguages.filter((language) => language.code in SECONDARY_TRANSLATION_PACKAGE_URLS)
  : secondaryTranslationLanguages;

export function isSecondaryTranslationLanguage(value: unknown): value is SecondaryTranslationLanguage {
  return availableSecondaryTranslationLanguages.some((language) => language.code === value);
}

const packagePromises = new Map<SecondaryTranslationLanguage, Promise<Map<string, string>>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the language comes from a packaged file instead of the translation server. */
export function usesStaticSecondaryTranslation(language: SecondaryTranslationLanguage | null): language is PackagedLanguage {
  return language !== null && language in SECONDARY_TRANSLATION_PACKAGE_URLS;
}

/** Reads a package file: { schemaVersion: 1, language, sourceLanguage: "en", translations: { "song::verse": text } }. */
export function parseSecondaryTranslationPackage(value: unknown, language: SecondaryTranslationLanguage): Map<string, string> {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.language !== language || value.sourceLanguage !== "en" || !isRecord(value.translations)) {
    throw new Error(`The ${language} translation package has an unsupported format.`);
  }

  const translations = new Map<string, string>();
  for (const [key, translation] of Object.entries(value.translations)) {
    if (!key.trim() || typeof translation !== "string" || !translation.trim()) {
      throw new Error(`The ${language} translation package includes an invalid translation.`);
    }
    translations.set(key, translation);
  }

  if (!translations.size) throw new Error(`The ${language} translation package is empty.`);
  return translations;
}

/** Loads a packaged language once per page; a failed load is retried next time. */
export function loadPackagedSecondaryTranslations(language: PackagedLanguage, fetchImplementation: typeof fetch = fetch): Promise<Map<string, string>> {
  let promise = packagePromises.get(language);
  if (!promise) {
    promise = fetchImplementation(SECONDARY_TRANSLATION_PACKAGE_URLS[language], { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The ${language} translation package could not be loaded.`);
        return parseSecondaryTranslationPackage(await response.json(), language);
      })
      .catch((error: unknown) => {
        packagePromises.delete(language);
        throw error;
      });
    packagePromises.set(language, promise);
  }
  return promise;
}

export function parseRussianTranslationPackage(value: unknown): Map<string, string> {
  return parseSecondaryTranslationPackage(value, "ru");
}

export function loadRussianSecondaryTranslations(fetchImplementation: typeof fetch = fetch): Promise<Map<string, string>> {
  return loadPackagedSecondaryTranslations("ru", fetchImplementation);
}

/** Test-only reset for the module-level Promise cache. */
export function resetRussianSecondaryTranslationsForTests() {
  packagePromises.clear();
}
