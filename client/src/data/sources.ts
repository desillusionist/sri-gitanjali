/** PWA content sources; JSON is preferred for faster first render, CSV remains a verified fallback. */
export const SONGS_JSON_URL = "/manus-storage/songs_577f33d4.json";
export const SONGS_CSV_URL = "/manus-storage/songs_flattened_8aa8d357.csv";

export const brandAssets = {
  mark: "/manus-storage/kirtan-guide-mark_9e3cc07f.png",
  libraryHero: "/manus-storage/kirtan-guide-marked-songbook-hero_67a46f66.jpg",
  readingDetail: "/manus-storage/kirtan-guide-reading-detail_86487ef9.jpg",
  teleprompterScene: "/manus-storage/kirtan-guide-teleprompter-scene_02c3e681.jpg",
} as const;
