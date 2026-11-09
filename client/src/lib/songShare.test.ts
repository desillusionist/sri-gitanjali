import { describe, expect, it } from "vitest";
import { buildSongShareText, parseSongShareParams, songShareParams } from "./songShare";

const content = {
  title: "Śrī Bhog Ārati",
  poet: "Bhakti Vinod Ṭhākur",
  verseLabel: "verse",
  secondaryLabel: "RU",
  url: "https://example.org/song/bhog?tr=1",
  verses: [
    { originalVerseNumber: 1, lines: [{ transliteration: "bhaja bhakata-vatsala", isIndented: false }, { transliteration: "śrī-gaurahari", isIndented: true }], translation: "Worship Gaurahari.", secondaryTranslation: "Поклоняйтесь Гаурахари." },
    { originalVerseNumber: 2, lines: [{ transliteration: "hari hari", isIndented: false }] },
  ],
};

describe("song share text", () => {
  it("keeps only the translations that are open", () => {
    const text = buildSongShareText(content, "plain");
    expect(text).toContain("(1)\nbhaja bhakata-vatsala\nśrī-gaurahari\n\nWorship Gaurahari.\n\nRU: Поклоняйтесь Гаурахари.");
    expect(text).toContain("(2)\nhari hari\n\nhttps://example.org");
  });

  it("writes Markdown with headings, line breaks and quoted translations", () => {
    const text = buildSongShareText(content, "markdown");
    expect(text.startsWith("# Śrī Bhog Ārati\n\n*Bhakti Vinod Ṭhākur*")).toBe(true);
    expect(text).toContain("### Verse 1\n\nbhaja bhakata-vatsala  \n&emsp;śrī-gaurahari\n\n> Worship Gaurahari.\n\n> **RU:** Поклоняйтесь Гаурахари.");
    expect(text.endsWith("[Śrī Bhog Ārati](https://example.org/song/bhog?tr=1)")).toBe(true);
  });
});

describe("song share link", () => {
  const ids = ["a", "b", "c"];
  it("round-trips the open translations, language and ornaments", () => {
    const params = songShareParams({ translations: ["a", "c"], secondaryLanguage: "ru", areOrnamentsHidden: true }, ids);
    expect(params.toString()).toBe("tr=1%2C3&lang=ru&plain=1");
    expect(parseSongShareParams(`?${params}`, ids)).toEqual({ translations: ["a", "c"], secondaryLanguage: "ru", areOrnamentsHidden: true });
  });

  it("reads all and none", () => {
    expect(parseSongShareParams("?tr=all", ids)).toEqual({ translations: "all" });
    expect(parseSongShareParams("?tr=0", ids)).toEqual({ translations: "none" });
    expect(parseSongShareParams("?q=hari", ids)).toEqual({});
  });
});
