import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import data from "@/data/song-books.json";
import { HOLY_NAMES } from "@/lib/holyNames";
import { bookSongIds, songBook } from "./songBooks";

describe("song books", () => {
  const songs: { id: string }[] = JSON.parse(fs.readFileSync(path.resolve("local-storage/songs_577f33d4.json"), "utf8"));
  const songIds = new Set(songs.map((song) => song.id));
  const books = new Set(HOLY_NAMES.filter((entry) => entry.kind === "book").map((entry) => entry.id));

  it("name real songs and book notes", () => {
    for (const links of [data.from, data.is, data.about] as Record<string, string[]>[]) {
      for (const [songId, ids] of Object.entries(links)) {
        expect(songIds.has(songId), songId).toBe(true);
        for (const id of ids) expect(books.has(id), `${songId} → ${id}`).toBe(true);
      }
    }
  });

  it("finds a song's book and a book's songs", () => {
    expect(songBook("vibhavari-sesa-043")).toBe("kalyana-kalpataru");
    expect(bookSongIds("siksastakam")[0]).toBe("sri-siksastakam-109");
    expect(bookSongIds("prarthana")).toContain("sri-rupa-manjari-pada-106");
  });
});
