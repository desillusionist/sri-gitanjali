/** Where the song data, fonts and images live (under the site's base path). */
const STORAGE = `${import.meta.env.BASE_URL}manus-storage/`;
/** PWA content sources; JSON is preferred for faster first render, CSV remains a verified fallback. */
export const SONGS_JSON_URL = STORAGE + "songs_577f33d4.json";
export const SONGS_CSV_URL = STORAGE + "songs_flattened_8aa8d357.csv";
export const RUSSIAN_SECONDARY_TRANSLATIONS_URL = STORAGE + "ru_user_updates_cd7dcc2b.json";

export const brandAssets = {
  mark: STORAGE + "kirtan-guide-peacock-plume_09e0a26b.png",
  libraryHero: STORAGE + "nabadwip-temple02-hero_14e93d5b.webp",
  readingDetail: STORAGE + "kirtan-guide-reading-detail_86487ef9.jpg",
  teleprompterScene: STORAGE + "kirtan-guide-teleprompter-scene_02c3e681.jpg",
} as const;
