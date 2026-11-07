#!/usr/bin/env node
/**
 * Packaged verse translations for the second-language reader (beyond Russian,
 * which has its own proof-read package).
 *
 *   node scripts/secondary-translations.mjs export <lang> <dir> [chars]
 *     Writes the English verse translations still missing for <lang> into
 *     numbered batch files in <dir>, about [chars] characters each (default 8000).
 *
 *   node scripts/secondary-translations.mjs build <lang>
 *     Joins scripts/secondary-translations/<lang>/*.txt into
 *     local-storage/secondary-translations-<lang>.json, after checking that
 *     every verse is present exactly once and no IAST letters were left behind
 *     (for languages written in their own script).
 *
 * Batch format (both for the English export and the translated files):
 *   @ song-id::verse-id
 *   text, one or more lines
 *   (blank line)
 * Lines starting with // are comments.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SONGS = path.join(ROOT, "local-storage/songs_577f33d4.json");
const NON_LATIN = new Set(["uk", "zh", "th", "hi", "bn"]);
const IAST = /[āīūṛṝḷṅñṭḍṇśṣṁṃḥĀĪŪṚṜḶṄÑṬḌṆŚṢṀṂḤ]/;

function englishSources() {
  const sources = new Map();
  for (const song of JSON.parse(fs.readFileSync(SONGS, "utf8"))) {
    for (const verse of song.verses) {
      const text = verse.translation?.trim();
      if (text) sources.set(`${song.id}::${verse.id}`, text);
    }
  }
  return sources;
}

export function parseBatch(text) {
  const entries = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("//")) continue;
    const header = line.match(/^@\s+(\S+)\s*$/);
    if (header) {
      current = { id: header[1], lines: [] };
      entries.push(current);
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      throw new Error(`Text before the first "@ id" line: ${line.slice(0, 60)}`);
    }
  }
  return entries.map(({ id, lines }) => ({ id, text: lines.join("\n").trim() }));
}

function batchDir(lang) {
  return path.join(ROOT, "scripts/secondary-translations", lang);
}

function readTranslations(lang) {
  const dir = batchDir(lang);
  const translations = new Map();
  if (!fs.existsSync(dir)) return translations;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".txt")).sort()) {
    for (const { id, text } of parseBatch(fs.readFileSync(path.join(dir, file), "utf8"))) {
      if (translations.has(id)) throw new Error(`${file}: ${id} is translated twice`);
      translations.set(id, { text, file });
    }
  }
  return translations;
}

function exportBatches(lang, outDir, maxChars = 8000) {
  const done = readTranslations(lang);
  fs.mkdirSync(outDir, { recursive: true });
  let batch = [];
  let size = 0;
  let index = 0;
  const flush = () => {
    if (!batch.length) return;
    index += 1;
    fs.writeFileSync(path.join(outDir, `${String(index).padStart(2, "0")}.txt`), batch.join("\n\n") + "\n");
    batch = [];
    size = 0;
  };
  let pending = 0;
  for (const [id, text] of englishSources()) {
    if (done.has(id)) continue;
    pending += 1;
    if (size && size + text.length > maxChars) flush();
    batch.push(`@ ${id}\n${text}`);
    size += text.length;
  }
  flush();
  console.log(`${pending} verses left for ${lang}, in ${index} batch files in ${outDir}`);
}

function build(lang) {
  const sources = englishSources();
  const translations = readTranslations(lang);
  const problems = [];
  for (const id of translations.keys()) if (!sources.has(id)) problems.push(`unknown verse ${id}`);
  for (const id of sources.keys()) if (!translations.get(id)?.text) problems.push(`missing ${id}`);
  if (NON_LATIN.has(lang)) {
    // Quoted Sanskrit verses stay in IAST on lines of their own; any IAST
    // letter on a line of translated text is a name or term left untranslated.
    for (const [id, { text, file }] of translations) {
      for (const line of text.split("\n")) {
        const letter = /[^\x00-ɏḀ-ỿ\s‘’'“”"(),.;:!?\-–—[\]]/.test(line) && line.match(IAST);
        if (letter) problems.push(`${file} ${id}: IAST letter "${letter[0]}" left in "${line.slice(0, 40)}…"`);
      }
    }
  }
  if (problems.length) {
    console.error(problems.slice(0, 40).join("\n"));
    console.error(`${problems.length} problem(s); package not written.`);
    process.exit(1);
  }
  const ordered = Object.fromEntries([...sources.keys()].map((id) => [id, translations.get(id).text]));
  const output = path.join(ROOT, `local-storage/secondary-translations-${lang}.json`);
  const body = { schemaVersion: 1, language: lang, sourceLanguage: "en", status: "draft", generatedAt: new Date().toISOString(), translations: ordered };
  fs.writeFileSync(output, JSON.stringify(body) + "\n");
  console.log(`Wrote ${Object.keys(ordered).length} verses to ${path.relative(ROOT, output)}`);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const [command, lang, arg, chars] = isMain ? process.argv.slice(2) : [];
if (command === "export" && lang && arg) exportBatches(lang, path.resolve(arg), Number(chars) || 8000);
else if (command === "build" && lang) build(lang);
else if (command) {
  console.error("Usage: export <lang> <dir> [chars] | build <lang>");
  process.exit(1);
}
