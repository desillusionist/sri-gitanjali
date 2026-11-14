/**
 * Lists the names and terms in the English translations and the Vaiṣṇavas' biographies that no
 * note covers yet: capitalised words with diacritics (Gauḍīya spelling) that the pop-up notes do not
 * recognise, most frequent first, with a song where each appears.
 *
 *   pnpm exec tsx scripts/missing-notes.ts [how many, default 80]
 */
import fs from "node:fs";
import path from "node:path";
import { getHolyNameSegments } from "../client/src/lib/holyNames";

type Song = { id: string; title: string; verses: { translation?: string }[] };

const ROOT = path.resolve(import.meta.dirname, "..");
const songs: Song[] = JSON.parse(fs.readFileSync(path.join(ROOT, "local-storage/songs_577f33d4.json"), "utf8"));
const AUTHORS: { id: string; summary: string; bio: string[] }[] = JSON.parse(fs.readFileSync(path.join(ROOT, "client/src/data/authors.json"), "utf8")).authors;
const limit = Number(process.argv[2] ?? 80);

const texts: { where: string; text: string }[] = [
  ...songs.flatMap((song) => song.verses.filter((verse) => verse.translation).map((verse) => ({ where: song.id, text: verse.translation! }))),
  ...AUTHORS.flatMap((author) => [author.summary, ...author.bio].map((text) => ({ where: `author/${author.id}`, text }))),
];

const DIACRITIC = /[āīūṛṝḷṅñṭḍṇśṣṁṃḥĀĪŪṚṄÑṬḌṆŚṢ]/;
// A capitalised word, possibly hyphenated (Śrī-Kṛṣṇa-saṅkīrtana), with an apostrophe-s left off.
const WORD = /\p{Lu}[\p{L}\p{M}]*(?:-[\p{L}\p{M}]+)*/gu;

// Titles and honorifics, which are parts of names rather than names.
const TITLES = new Set(["Śrī", "Śrīla", "Śrīmatī", "Śrīpād", "Śrīman", "Mahārāja", "Goswāmī", "Goswāmīs", "Ṭhākur", "Paṇḍit", "Devī", "Dās", "Swāmī", "Bābājī", "Dev-Goswāmī", "Deva-Goswāmī", "Tīrtha", "Āchārya", "Āchāryas", "Bhaṭṭa"]);

const found = new Map<string, { count: number; where: Set<string> }>();
for (const { where, text } of texts) {
  for (const segment of getHolyNameSegments(text)) {
    if (segment.entry) continue;
    for (const match of Array.from(segment.text.matchAll(WORD))) {
      const word = match[0].normalize("NFC");
      if (!DIACRITIC.test(word) || TITLES.has(word)) continue;
      const item = found.get(word) ?? { count: 0, where: new Set<string>() };
      item.count += 1;
      item.where.add(where);
      found.set(word, item);
    }
  }
}

const rows = Array.from(found.entries()).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, limit);
console.log(`${found.size} capitalised terms without a note; the ${rows.length} most frequent:\n`);
for (const [word, { count, where }] of rows) console.log(`${String(count).padStart(4)}  ${word.padEnd(32)} ${Array.from(where).slice(0, 2).join(", ")}${where.size > 2 ? ` (+${where.size - 2})` : ""}`);
