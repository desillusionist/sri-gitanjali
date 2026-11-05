import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isDraftSecondaryTranslation,
  loadPackagedSecondaryTranslations,
  loadRussianSecondaryTranslations,
  parseSecondaryTranslationPackage,
  parseRussianTranslationPackage,
  resetRussianSecondaryTranslationsForTests,
  usesStaticSecondaryTranslation,
} from "./secondaryTranslations";

afterEach(() => {
  resetRussianSecondaryTranslationsForTests();
});

describe("Russian static secondary translations", () => {
  it("parses a complete, nonempty static package into a verse-key map", () => {
    const translations = parseRussianTranslationPackage({
      schemaVersion: 1,
      language: "ru",
      sourceLanguage: "en",
      translations: { "sample-song-001::verse-1": "Русский перевод." },
    });

    expect(translations.get("sample-song-001::verse-1")).toBe("Русский перевод.");
  });

  it("rejects malformed static packages instead of rendering incomplete data", () => {
    expect(() => parseRussianTranslationPackage({ schemaVersion: 1, language: "ru", translations: { verse: "" } })).toThrow("unsupported format");
  });

  it("loads the Russian package once per browser session and reuses the Promise cache", async () => {
    const fetchImplementation = async () => new Response(JSON.stringify({
      schemaVersion: 1,
      language: "ru",
      sourceLanguage: "en",
      translations: { "sample-song-001::verse-1": "Русский перевод." },
    }), { status: 200 });
    let calls = 0;
    const trackedFetch: typeof fetch = async (...args) => {
      calls += 1;
      return fetchImplementation(...args);
    };

    const [first, second] = await Promise.all([
      loadRussianSecondaryTranslations(trackedFetch),
      loadRussianSecondaryTranslations(trackedFetch),
    ]);

    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  it("routes packaged languages to their files while retaining the online path for the others", () => {
    expect(usesStaticSecondaryTranslation("ru")).toBe(true);
    expect(usesStaticSecondaryTranslation("zh")).toBe(true);
    expect(usesStaticSecondaryTranslation("uk")).toBe(false);
    expect(usesStaticSecondaryTranslation(null)).toBe(false);
  });
});

describe("Chinese packaged translation", () => {
  const storage = path.resolve(import.meta.dirname, "../../../local-storage");
  const songs = JSON.parse(fs.readFileSync(path.join(storage, "songs_577f33d4.json"), "utf8")) as Array<{ id: string; verses: Array<{ id: string; translation: string }> }>;
  const raw = JSON.parse(fs.readFileSync(path.join(storage, "secondary-translations-zh.json"), "utf8"));

  it("has a Chinese meaning for every verse that has an English one", () => {
    const translations = parseSecondaryTranslationPackage(raw, "zh");
    const missing = songs.flatMap((song) => song.verses
      .filter((verse) => verse.translation?.trim() && !translations.get(`${song.id}::${verse.id}`))
      .map((verse) => `${song.id}::${verse.id}`));
    expect(missing).toEqual([]);
  });

  it("writes names in Chinese characters, keeping IAST only on quoted Sanskrit lines", () => {
    const leftovers = Object.entries(raw.translations as Record<string, string>).flatMap(([id, text]) => text.split("\n")
      .filter((line) => /[\u4e00-\u9fff]/.test(line) && /[āīūṛṅñṭḍṇśṣṁṃḥ]/i.test(line))
      .map((line) => `${id}: ${line.slice(0, 40)}`));
    expect(leftovers).toEqual([]);
  });

  it("is marked as a draft and loads like the Russian package", async () => {
    expect(isDraftSecondaryTranslation("zh")).toBe(true);
    expect(isDraftSecondaryTranslation("ru")).toBe(false);
    const fetchImplementation: typeof fetch = async () => new Response(JSON.stringify(raw), { status: 200 });
    const translations = await loadPackagedSecondaryTranslations("zh", fetchImplementation);
    expect(translations.get("vandana-001::verse-1")).toContain("奎师那");
  });
});
