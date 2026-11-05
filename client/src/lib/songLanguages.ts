/** The language each song was composed in, and how to label it in its own script. */

import languageData from "@/data/song-languages.json";

export type SongLanguage = "sa" | "bn";

export const SONG_LANGUAGES: Record<SongLanguage, { native: string; seal: string; english: string; lang: string }> = {
  bn: { native: "বাংলা", seal: "বা", english: "Bengali", lang: "bn" },
  sa: { native: "संस्कृत", seal: "सं", english: "Sanskrit", lang: "sa" },
};

/** Order used in the library filter. */
export const SONG_LANGUAGE_ORDER: SongLanguage[] = ["bn", "sa"];

const languages = languageData.languages as Record<string, SongLanguage>;

export function getSongLanguage(songId: string): SongLanguage | undefined {
  return languages[songId];
}

export function isSongLanguage(value: string | null | undefined): value is SongLanguage {
  return Boolean(value && value in SONG_LANGUAGES);
}
