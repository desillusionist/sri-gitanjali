import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Song } from "@/domain/song";
import { isDraftPackagedVerse, parseSecondaryTranslationPackage } from "./secondaryTranslations";

const storage = path.resolve(__dirname, "../../../local-storage");
const songs: Song[] = JSON.parse(fs.readFileSync(path.join(storage, "songs_577f33d4.json"), "utf8"));
const verseKeys = new Set(songs.flatMap((song) => song.verses.map((verse) => `${song.id}::${verse.id}`)));

describe("kirtan.site translation packages", () => {
  for (const [language, minimumSongs] of [["es", 165], ["pt", 100], ["uk", 30], ["lv", 85]] as const) {
    it(`${language}: every verse key exists, with no markup or "Mahārāj" spelling`, () => {
      const translations = parseSecondaryTranslationPackage(JSON.parse(fs.readFileSync(path.join(storage, `secondary-translations-${language}.json`), "utf8")), language);
      for (const [key, text] of translations) {
        expect(verseKeys, key).toContain(key);
        expect(text, key).not.toMatch(/\*|\$undefined|Mahārāj(?![a-zāīū])/);
      }
      expect(new Set([...translations.keys()].map((key) => key.split("::")[0])).size).toBeGreaterThanOrEqual(minimumSongs);
    });
  }

  for (const [language, publishedVerse] of [["es", "vibhavari-sesa-043::verse-1"], ["pt", "akrodha-paramananda-062::verse-1"]] as const) {
    it(`${language}: our own fill-ins cover every remaining translated verse and are marked as drafts`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(storage, `secondary-translations-${language}.json`), "utf8"));
      const translations = parseSecondaryTranslationPackage(raw, language);
      for (const song of songs) for (const verse of song.verses) {
        if (verse.translation.trim()) expect(translations.has(`${song.id}::${verse.id}`), `${song.id}::${verse.id}`).toBe(true);
      }
      expect(raw.draftKeys.length).toBeGreaterThan(100);
      expect(isDraftPackagedVerse(language, raw.draftKeys[0])).toBe(true);
      expect(isDraftPackagedVerse(language, publishedVerse)).toBe(false);
    });
  }
});
