import { RUSSIAN_SECONDARY_TRANSLATIONS_URL } from "@/data/sources";

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

export function isSecondaryTranslationLanguage(value: unknown): value is SecondaryTranslationLanguage {
  return secondaryTranslationLanguages.some((language) => language.code === value);
}

type RussianTranslationPackage = {
  schemaVersion: 1;
  language: "ru";
  sourceLanguage: "en";
  translations: Record<string, string>;
};

let russianTranslationPackagePromise: Promise<Map<string, string>> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function usesStaticSecondaryTranslation(language: SecondaryTranslationLanguage | null) {
  return language === "ru";
}

export function parseRussianTranslationPackage(value: unknown): Map<string, string> {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.language !== "ru" || value.sourceLanguage !== "en" || !isRecord(value.translations)) {
    throw new Error("The Russian translation package has an unsupported format.");
  }

  const translations = new Map<string, string>();
  for (const [key, translation] of Object.entries(value.translations)) {
    if (!key.trim() || typeof translation !== "string" || !translation.trim()) {
      throw new Error("The Russian translation package includes an invalid translation.");
    }
    translations.set(key, translation);
  }

  if (!translations.size) throw new Error("The Russian translation package is empty.");
  return translations;
}

export function loadRussianSecondaryTranslations(fetchImplementation: typeof fetch = fetch): Promise<Map<string, string>> {
  if (!russianTranslationPackagePromise) {
    russianTranslationPackagePromise = fetchImplementation(RUSSIAN_SECONDARY_TRANSLATIONS_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The Russian translation package could not be loaded.");
        return parseRussianTranslationPackage(await response.json() as RussianTranslationPackage);
      })
      .catch((error: unknown) => {
        russianTranslationPackagePromise = null;
        throw error;
      });
  }
  return russianTranslationPackagePromise;
}

/** Test-only reset for the module-level Promise cache. */
export function resetRussianSecondaryTranslationsForTests() {
  russianTranslationPackagePromise = null;
}
