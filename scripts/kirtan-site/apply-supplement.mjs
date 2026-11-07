#!/usr/bin/env node
// Merges our own drafts into a kirtan.site package for the verses kirtan.site has no translation for.
//   node scripts/kirtan-site/apply-supplement.mjs <lang> [batch-dir]
// With a batch dir (files in the "@ song::verse" format of scripts/secondary-translations.mjs), first
// writes scripts/kirtan-site/<lang>-supplement.json from it. Then adds every supplement verse the package
// lacks to local-storage/secondary-translations-<lang>.json and lists it in draftKeys until proof-read.
import fs from "node:fs";
import path from "node:path";
import { parseBatch } from "../secondary-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const [lang, batchDir] = process.argv.slice(2);
if (!lang) { console.error("Usage: apply-supplement.mjs <lang> [batch-dir]"); process.exit(1); }

const songs = JSON.parse(fs.readFileSync(path.join(ROOT, "local-storage/songs_577f33d4.json"), "utf8"));
const known = new Set(songs.flatMap((song) => song.verses.filter((verse) => verse.translation?.trim()).map((verse) => `${song.id}::${verse.id}`)));
const supplementPath = path.join(import.meta.dirname, `${lang}-supplement.json`);

if (batchDir) {
  const translations = {};
  for (const file of fs.readdirSync(batchDir).filter((name) => name.endsWith(".txt")).sort()) {
    for (const { id, text } of parseBatch(fs.readFileSync(path.join(batchDir, file), "utf8"))) {
      if (!known.has(id)) throw new Error(`${file}: unknown verse ${id}`);
      if (translations[id]) throw new Error(`${file}: ${id} translated twice`);
      if (!text) throw new Error(`${file}: ${id} is empty`);
      translations[id] = text;
    }
  }
  const note = `Translations by Claude (AI) for the songs and verses kirtan.site has no ${lang} translation for. Merged into the ${lang} package by apply-supplement.mjs and marked as drafts until proof-read.`;
  fs.writeFileSync(supplementPath, JSON.stringify({ note, translations }, null, 1) + "\n");
  console.log(`Wrote ${Object.keys(translations).length} verses to ${path.relative(ROOT, supplementPath)}`);
}

const packagePath = path.join(ROOT, `local-storage/secondary-translations-${lang}.json`);
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const supplement = JSON.parse(fs.readFileSync(supplementPath, "utf8")).translations;
const draftKeys = new Set(pkg.draftKeys ?? []);
let added = 0;
for (const [key, text] of Object.entries(supplement)) {
  if (pkg.translations[key] && !draftKeys.has(key)) continue;
  if (!pkg.translations[key]) added++;
  pkg.translations[key] = text;
  draftKeys.add(key);
}
// Keep the book's order.
const order = songs.flatMap((song) => song.verses.map((verse) => `${song.id}::${verse.id}`));
pkg.translations = Object.fromEntries(order.filter((key) => pkg.translations[key]).map((key) => [key, pkg.translations[key]]));
const { translations, ...head } = pkg;
const out = { ...head, draftKeys: order.filter((key) => draftKeys.has(key)), translations };
fs.writeFileSync(packagePath, JSON.stringify(out, null, 1) + "\n");
const missing = [...known].filter((key) => !out.translations[key]);
console.log(`${lang}: added ${added}; ${Object.keys(out.translations).length} verses, ${out.draftKeys.length} drafts, ${missing.length} still missing`);
if (missing.length) console.log(missing.slice(0, 20).join("\n"));
