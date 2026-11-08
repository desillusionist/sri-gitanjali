import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHORS, authorInitials, findAuthorById, findAuthorByPoet, VAISNAVA_GROUPS } from "./authors";

const songs: { id?: string; poet?: string }[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../local-storage/songs_577f33d4.json"), "utf8"));
const poets = new Set(songs.map((song) => song.poet?.trim()).filter(Boolean));

describe("authors", () => {
  it("matches every listed name to a poet in the songs", () => {
    for (const author of AUTHORS) {
      for (const name of author.names) expect(poets, `${author.id}: ${name}`).toContain(name);
    }
  });

  it("has unique ids and a summary and bio for each author", () => {
    expect(new Set(AUTHORS.map((author) => author.id)).size).toBe(AUTHORS.length);
    for (const author of AUTHORS) {
      expect(author.summary.length).toBeGreaterThan(40);
      expect(author.bio.length).toBeGreaterThan(0);
    }
  });

  it("places everyone on the Vaiṣṇavas page and links only to songs that exist", () => {
    const songIds = new Set((songs as Array<{ id?: string }>).map((song) => song.id));
    for (const author of AUTHORS) {
      expect(VAISNAVA_GROUPS, author.id).toContain(author.group);
      for (const id of author.songIds ?? []) expect(songIds, `${author.id}: ${id}`).toContain(id);
      expect(JSON.stringify(author), author.id).not.toMatch(/Mahārāj(?![a-zāīū])/);
    }
  });

  it("has a page for every named poet in the book", () => {
    for (const poet of poets) {
      if (poet === "Traditional" || poet === "Unknown") continue;
      expect(findAuthorByPoet(poet as string), poet as string).toBeDefined();
    }
  });

  it("has a portrait file for every portrait it names", () => {
    for (const author of AUTHORS) {
      for (const file of [author.portrait, author.portraitLarge].filter(Boolean)) {
        expect(fs.existsSync(path.resolve(__dirname, "../../../local-storage", file!)), `${author.id}: ${file}`).toBe(true);
      }
    }
  });

  it("covers the ten most-sung named authors", () => {
    const counts = new Map<string, number>();
    for (const song of songs) {
      const poet = song.poet?.trim();
      if (poet && poet !== "Traditional" && poet !== "Unknown") counts.set(poet, (counts.get(poet) ?? 0) + 1);
    }
    const topTen = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([poet]) => poet);
    for (const poet of topTen) expect(findAuthorByPoet(poet), poet).toBeDefined();
  });

  it("finds authors by poet name and id", () => {
    expect(findAuthorByPoet(" Śrīla Bhakti Vinod Ṭhākur ")?.id).toBe("bhakti-vinod-thakur");
    expect(findAuthorByPoet("Traditional")).toBeUndefined();
    expect(findAuthorById("govinda-maharaj")?.dates).toBe("1929–2010");
    expect(authorInitials(findAuthorById("rupa-goswami")!)).toBe("RG");
  });
});
