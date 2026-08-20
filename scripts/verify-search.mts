import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ALL_AUTHORS_FILTER,
  ALL_CATEGORIES_FILTER,
  filterSongs,
  getSongAuthors,
  getSongCategories,
  type Song,
} from "../client/src/domain/song.ts";

const catalog = JSON.parse(await readFile("/home/ubuntu/webdev-static-assets/songs.json", "utf8")) as Song[];
const author = getSongAuthors(catalog)[0];
const category = getSongCategories(catalog)[0];
const firstSong = catalog[0];
const textNeedle = firstSong.verses[0]?.lines[0]?.transliteration.split(/\s+/).slice(0, 2).join(" ") ?? firstSong.title;

const allSongs = filterSongs(catalog, {
  query: "",
  author: ALL_AUTHORS_FILTER,
  category: ALL_CATEGORIES_FILTER,
});
assert.equal(allSongs.length, catalog.length, "An empty filter state must return the full catalog.");

const authorMatches = filterSongs(catalog, { query: "", author, category: ALL_CATEGORIES_FILTER });
assert.ok(authorMatches.length > 0 && authorMatches.every((song) => song.poet === author), "Author filtering must keep only the selected author.");

const categoryMatches = filterSongs(catalog, { query: "", author: ALL_AUTHORS_FILTER, category });
assert.ok(categoryMatches.length > 0 && categoryMatches.every((song) => song.category === category), "Category filtering must keep only the selected category.");

const textMatches = filterSongs(catalog, { query: textNeedle, author: ALL_AUTHORS_FILTER, category: ALL_CATEGORIES_FILTER });
assert.ok(textMatches.some((song) => song.id === firstSong.id), "Full-text search must find a transferred verse line.");

const combinedMatches = filterSongs(catalog, { query: "", author, category: authorMatches[0].category });
assert.ok(combinedMatches.every((song) => song.poet === author && song.category === authorMatches[0].category), "Combined filters must use AND semantics.");

console.log(`Verified search filters against ${catalog.length} songs: text, author, category, and combined conditions.`);
