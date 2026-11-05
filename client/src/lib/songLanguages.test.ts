import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import languageData from "@/data/song-languages.json";
import { ALL_LANGUAGES_FILTER, defaultSongSearchFilters, filterSongs, parseLanguageFilter, type Song } from "@/domain/song";
import { getSongLanguage, isSongLanguage, SONG_LANGUAGES } from "./songLanguages";

const songs: Song[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../local-storage/songs_577f33d4.json"), "utf8"));

describe("song languages", () => {
  it("gives every song a known language, and lists no unknown songs", () => {
    for (const song of songs) expect(isSongLanguage(getSongLanguage(song.id)), song.id).toBe(true);
    const ids = new Set(songs.map((song) => song.id));
    for (const id of Object.keys(languageData.languages)) expect(ids, id).toContain(id);
    for (const id of languageData.toReview) expect(ids, id).toContain(id);
  });

  it("labels each language in its own script", () => {
    expect(SONG_LANGUAGES.bn.native).toBe("বাংলা");
    expect(SONG_LANGUAGES.sa.native).toBe("संस्कृत");
    expect(getSongLanguage(songs.find((song) => song.id.startsWith("sri-sri-gurvastaka"))!.id)).toBe("sa");
    expect(getSongLanguage(songs.find((song) => song.id.startsWith("vibhavari-sesa"))!.id)).toBe("bn");
  });

  it("keeps the reviewed calls: only Bengali and Sanskrit", () => {
    expect(new Set(Object.values(languageData.languages))).toEqual(new Set(["bn", "sa"]));
    expect(getSongLanguage("kali-ghora-timire-070")).toBe("bn");
    expect(getSongLanguage("mayura-mukuta-128")).toBe("sa");
    expect(getSongLanguage("jaya-radha-madhava-127")).toBe("bn");
  });

  it("filters the library by language", () => {
    const sanskrit = filterSongs(songs, { ...defaultSongSearchFilters, language: "sa" });
    expect(sanskrit.length).toBeGreaterThan(0);
    expect(sanskrit.every((song) => getSongLanguage(song.id) === "sa")).toBe(true);
    expect(filterSongs(songs, defaultSongSearchFilters)).toHaveLength(songs.length);
    expect(parseLanguageFilter("bn")).toBe("bn");
    expect(parseLanguageFilter("xx")).toBe(ALL_LANGUAGES_FILTER);
    expect(parseLanguageFilter(null)).toBe(ALL_LANGUAGES_FILTER);
  });
});
