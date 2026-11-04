import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import verseData from "@/data/word-for-word-verses.json";
import type { Song } from "@/domain/song";
import { getWordForWordSegments } from "@/lib/wordForWordGlossary";
import { hideSecondarySongOrnamentsInLines } from "@/domain/song";

const songs: Song[] = JSON.parse(readFileSync("local-storage/songs_577f33d4.json", "utf8"));
const spansBySong = (verseData as { songs: Record<string, Record<string, Array<{ start: number; end: number; surface: string }>>> }).songs;

function verseContext(songId: string, verseId: string) {
  const verse = songs.find((song) => song.id === songId)?.verses.find((item) => item.id === verseId);
  if (!verse) throw new Error(`Missing ${songId} ${verseId}`);
  return verse.lines.map((line) => line.transliteration).join("\n");
}

function meaningOf(songId: string, verseId: string, surface: string) {
  const segments = getWordForWordSegments(verseContext(songId, verseId), { songId, verseId });
  return segments.find((segment) => segment.text === surface)?.entries.map((entry) => entry.meaning);
}

describe("verse-specific word-for-word links", () => {
  it("stays in step with the current song text", () => {
    for (const [songId, verses] of Object.entries(spansBySong)) {
      for (const [verseId, spans] of Object.entries(verses)) {
        const context = verseContext(songId, verseId);
        for (const span of spans) expect(context.slice(span.start, span.end), `${songId} ${verseId}`).toBe(span.surface);
      }
    }
  });

  it("links Guru-paramparā words across transliteration traditions", () => {
    const songId = "sri-guru-parampara-137";
    expect(meaningOf(songId, "verse-1", "hon kṛṣṇa-sevonmukha")?.[0]).toContain("devotional");
    expect(meaningOf(songId, "verse-2", "parichaya")).toEqual(["was known"]);
    expect(meaningOf(songId, "verse-3", "parichaya")).toEqual(["was known"]);
    expect(meaningOf(songId, "verse-3", "tā̐hāra kiṅkora")?.[0]).toContain("Rājendra");
    expect(meaningOf(songId, "verse-8", "viśvanātha-bhakta-sāth")?.[0]).toContain("Viśvanātha");
    expect(meaningOf(songId, "verse-8", "mahā-bhāgavata-vara")?.[0]).toContain("topmost");
    expect(meaningOf(songId, "verse-8", "jā̐ra moda")?.[0]).toContain("joy");
  });

  it("gives each repeated word its own synonym", () => {
    const segments = getWordForWordSegments(verseContext("sri-nrsimha-pranam-141", "verse-2"), { songId: "sri-nrsimha-pranam-141", verseId: "verse-2" });
    const nrsimha = segments.filter((segment) => /^nṛsiṁh/.test(segment.text));
    expect(nrsimha.map((segment) => segment.text)).toEqual(["nṛsiṁhaḥ", "nṛsiṁho", "nṛsiṁhaḥ", "nṛsiṁho", "nṛsiṁho", "nṛsiṁham"]);
    expect(nrsimha.every((segment) => segment.entries.length === 1)).toBe(true);
    expect(nrsimha.at(-1)?.entries[0]?.meaning).toBe("to Lord Nṛsiṁha");
  });

  it("uses reviewed editorial links where the editions word a verse differently", () => {
    expect(meaningOf("the-deities-in-nabadwip-017", "verse-1", "gāndharvā")).toEqual(["Śrīmatī Rādhārāṇī"]);
    expect(meaningOf("nam-sankirtan-045", "verse-3", "śrī advaita-chandra")).toEqual(["the moonlike Śrī Advaita Āchārya"]);
  });

  it("splits a verse across lines without losing links", () => {
    const songId = "sri-guru-parampara-137";
    const lines = songs.find((song) => song.id === songId)!.verses[1].lines.map((line) => line.transliteration);
    const contextValue = lines.join("\n");
    const lineFour = getWordForWordSegments(lines[3], { songId, verseId: "verse-2", contextValue, contextOffset: contextValue.length - lines[3].length });
    expect(lineFour.map((segment) => segment.text).join("")).toBe(lines[3]);
    expect(lineFour.some((segment) => segment.entries.some((entry) => entry.meaning === "in Jayatīrtha's service"))).toBe(true);
  });

  it("uses editorial glosses for words the reference leaves unglossed", () => {
    expect(meaningOf("sri-sri-premadhama-deva-stotram-057", "verse-1", "naumi")).toEqual(["I offer my obeisances"]);
    expect(meaningOf("sri-gaura-purnima-147", "verse-89", "phālgun")).toEqual(["Phālguna"]);
    expect(meaningOf("sri-guru-parampara-137", "verse-10", "śrīdhara")).toEqual(["Śrīdhara"]);
  });

  it("gives every word of every verse a reviewed meaning", () => {
    const missing: string[] = [];
    for (const song of songs) {
      for (const verse of song.verses) {
        for (const segment of getWordForWordSegments(verseContext(song.id, verse.id), { songId: song.id, verseId: verse.id, songTitle: song.title })) {
          if (!segment.entries.length && /\p{L}/u.test(segment.text)) missing.push(`${song.id} ${verse.id}: ${segment.text.trim()}`);
          // Every meaning is verse-specific or reviewed; none is a guess from another song.
          if (segment.source === "glossary") missing.push(`${song.id} ${verse.id}: ${segment.text.trim()} (general glossary)`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps verse meanings when secondary ornaments are hidden", () => {
    const problems: string[] = [];
    for (const song of songs) {
      for (const verse of song.verses) {
        const source = verseContext(song.id, verse.id);
        const shown = hideSecondarySongOrnamentsInLines(verse.lines).map((line) => line.transliteration).join("\n");
        if (shown === source) continue;
        for (const segment of getWordForWordSegments(shown, { songId: song.id, verseId: verse.id, songTitle: song.title, sourceContextValue: source })) {
          if (/\p{L}/u.test(segment.text) && (!segment.entries.length || segment.source === "glossary")) problems.push(`${song.id} ${verse.id}: ${segment.text.trim()}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("ignores links whose words no longer match an edited verse", () => {
    const segments = getWordForWordSegments("edited text without the original words", { songId: "sri-guru-parampara-137", verseId: "verse-2" });
    expect(segments.map((segment) => segment.text).join("")).toBe("edited text without the original words");
  });
});
