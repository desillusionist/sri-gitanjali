// Round trip for reviewing the editorial word-for-word glosses in a spreadsheet.
//
//   node scripts/word-for-word-review.mjs export [review.csv]
//     Writes one row per gloss: song, verse, the verse text, the word, the
//     editorial meaning, any note left in the gloss file, and an empty
//     “Corrected meaning” column for the reviewer.
//
//   node scripts/word-for-word-review.mjs apply [review.csv]
//     Writes every filled-in “Corrected meaning” back into the gloss files in
//     scripts/word-for-word-editorial-glosses/. Rebuild afterwards with
//     scripts/build-verse-word-for-word.mjs.
import { readdir, readFile, writeFile } from "node:fs/promises";

const [command, csvPath = "docs/word-for-word-review.csv"] = process.argv.slice(2);
const GLOSSES_DIR = "scripts/word-for-word-editorial-glosses";
const SONGS_FILE = "local-storage/songs_577f33d4.json";
const HEADER = ["File", "Line", "Song", "Verse", "Verse text", "Word", "Editorial meaning", "Note", "Corrected meaning"];

const csvCell = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const files = (await readdir(GLOSSES_DIR)).filter((name) => name.endsWith(".txt")).sort();

if (command === "export") {
  const songs = new Map(JSON.parse(await readFile(SONGS_FILE, "utf8")).map((song) => [song.id, song]));
  const rows = [HEADER];
  for (const file of files) {
    const lines = (await readFile(`${GLOSSES_DIR}/${file}`, "utf8")).split("\n");
    let song = null;
    let verseId = null;
    let note = "";
    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (line.startsWith("@")) song = songs.get(line.slice(1).trim());
      else if (line.startsWith("#")) { verseId = line.slice(1).trim(); note = ""; }
      else if (line.startsWith("//")) { if (verseId) note = line.slice(2).trim(); }
      else if (line.includes(" = ") && verseId) {
        const [word, ...meaning] = line.split(" = ");
        const verse = song?.verses.find((item) => item.id === verseId);
        const verseText = verseId === "*" ? "(every verse)" : verse?.lines.map((item) => item.transliteration).join(" / ") ?? "";
        rows.push([file, String(index + 1), song?.title ?? "", verseId === "*" ? "all" : verseId.replace("verse-", ""), verseText, word, meaning.join(" = "), note, ""]);
        note = "";
      }
    });
  }
  // The byte-order mark makes Excel and Numbers read the diacritics correctly.
  // The lexicon’s context-neutral meanings apply wherever no other gloss does.
  const lexiconLines = (await readFile("scripts/word-for-word-editorial-lexicon.txt", "utf8")).split("\n");
  lexiconLines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("//") || !line.includes(" = ")) return;
    const [word, ...meaning] = line.split(" = ");
    rows.push(["../word-for-word-editorial-lexicon.txt", String(index + 1), "(lexicon: any song)", "", "", word, meaning.join(" = "), "context-neutral meaning used wherever no verse-specific gloss exists", ""]);
  });
  await writeFile(csvPath, `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`);
  console.log(`Wrote ${rows.length - 1} glosses to ${csvPath}`);
} else if (command === "apply") {
  const [header, ...rows] = parseCsv((await readFile(csvPath, "utf8")).replace(/^\uFEFF/, ""));
  const column = Object.fromEntries(HEADER.map((name) => [name, header.indexOf(name)]));
  const byFile = new Map();
  for (const row of rows) {
    const corrected = row[column["Corrected meaning"]]?.trim();
    if (!corrected) continue;
    const file = row[column.File];
    byFile.set(file, [...(byFile.get(file) ?? []), { line: Number(row[column.Line]), word: row[column.Word], corrected }]);
  }
  let applied = 0;
  for (const [file, changes] of byFile) {
    const lines = (await readFile(`${GLOSSES_DIR}/${file}`, "utf8")).split("\n");
    for (const { line, word, corrected } of changes) {
      const current = lines[line - 1] ?? "";
      if (!current.trim().startsWith(`${word} = `)) throw new Error(`${file}:${line} no longer starts with “${word} = ” — export a fresh sheet`);
      lines[line - 1] = `${current.slice(0, current.indexOf(word))}${word} = ${corrected}`;
      applied += 1;
    }
    await writeFile(`${GLOSSES_DIR}/${file}`, lines.join("\n"));
  }
  console.log(`Applied ${applied} corrections in ${byFile.size} files`);
} else {
  throw new Error("Usage: node scripts/word-for-word-review.mjs export|apply [review.csv]");
}
