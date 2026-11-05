/** Where the song data, fonts and images live (under the site's base path). */
export const STORAGE_URL = `${import.meta.env.BASE_URL}manus-storage/`;
const STORAGE = STORAGE_URL;
/** PWA content sources. */
export const SONGS_JSON_URL = STORAGE + "songs_577f33d4.json";
export const RUSSIAN_SECONDARY_TRANSLATIONS_URL = STORAGE + "ru_user_updates_cd7dcc2b.json";
/** Packaged second-language translations, keyed by language code. */
export const SECONDARY_TRANSLATION_PACKAGE_URLS = {
  ru: RUSSIAN_SECONDARY_TRANSLATIONS_URL,
  zh: STORAGE + "secondary-translations-zh.json",
} as const;

export const brandAssets = {
  mark: STORAGE + "kirtan-guide-peacock-plume_09e0a26b.png",
  libraryHero: STORAGE + "nabadwip-temple02-hero_14e93d5b.webp",
} as const;
