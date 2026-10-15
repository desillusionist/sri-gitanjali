/** PWA content sources; JSON is preferred for faster first render, CSV remains a verified fallback. */
export const SONGS_JSON_URL = "/manus-storage/songs_577f33d4.json";
export const SONGS_CSV_URL = "/manus-storage/songs_flattened_8aa8d357.csv";
export const RUSSIAN_SECONDARY_TRANSLATIONS_URL = "/manus-storage/ru_user_updates_cd7dcc2b.json";

export const brandAssets = {
  mark: "/manus-storage/kirtan-guide-peacock-plume_09e0a26b.png",
  libraryHero: "/manus-storage/nabadwip-temple02-hero_14e93d5b.webp",
  readingDetail: "/manus-storage/kirtan-guide-reading-detail_86487ef9.jpg",
  teleprompterScene: "/manus-storage/kirtan-guide-teleprompter-scene_02c3e681.jpg",
} as const;
