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
