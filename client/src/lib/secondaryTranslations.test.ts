import { afterEach, describe, expect, it } from "vitest";
import {
  loadRussianSecondaryTranslations,
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

  it("routes only Russian to the static package while retaining the online path for other languages", () => {
    expect(usesStaticSecondaryTranslation("ru")).toBe(true);
    expect(usesStaticSecondaryTranslation("uk")).toBe(false);
    expect(usesStaticSecondaryTranslation(null)).toBe(false);
  });
});
