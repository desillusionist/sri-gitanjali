import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourcePath = resolve("/home/ubuntu/webdev-static-assets/songs_flattened.csv");
const outputPath = resolve("/home/ubuntu/webdev-static-assets/songs.json");

function parseCSV(source) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "song";
}

function rowsToSongs(rows) {
  const dataRows = rows.slice(1);
  const songOrder = [];
  const songsByTitle = new Map();

  for (const row of dataRows) {
    if (row.length < 10 || !row[0]?.trim()) continue;
    const title = row[0];
    if (!songsByTitle.has(title)) {
      songOrder.push(title);
      songsByTitle.set(title, []);
    }
    songsByTitle.get(title).push(row);
  }

  return songOrder.flatMap((title, songIndex) => {
    const songRows = songsByTitle.get(title) ?? [];
    const firstRow = songRows[0];
    if (!firstRow) return [];

    const versesByNumber = new Map();
    for (const row of songRows) {
      const number = Number.parseInt(row[3], 10) || 1;
      if (!versesByNumber.has(number)) versesByNumber.set(number, []);
      versesByNumber.get(number).push(row);
    }

    const verses = [...versesByNumber.entries()]
      .sort(([left], [right]) => left - right)
      .flatMap(([originalVerseNumber, verseRows]) => {
        const orderedLines = [...verseRows]
          .sort((left, right) => (Number.parseInt(left[4], 10) || 0) - (Number.parseInt(right[4], 10) || 0))
          .flatMap((row, lineIndex) => {
            const transliteration = row[5]?.trim();
            if (!transliteration) return [];
            return [{
              id: `line-${originalVerseNumber}-${lineIndex + 1}`,
              transliteration,
              isIndented: row[6]?.trim().toLowerCase() === "true",
            }];
          });

        if (orderedLines.length === 0) return [];
        return [{
          id: `verse-${originalVerseNumber}`,
          lines: orderedLines,
          translation: (verseRows[0]?.[7] ?? "").replace(/\\n/g, "\n"),
          originalVerseNumber,
        }];
      });

    if (verses.length === 0) return [];
    const comment = firstRow[8]?.trim() || undefined;
    const audioLink = firstRow[9]?.trim() || undefined;
    return [{
      id: `${slugify(title)}-${String(songIndex + 1).padStart(3, "0")}`,
      title,
      poet: firstRow[1]?.trim() || undefined,
      category: firstRow[2]?.trim() || "Other Songs",
      comment,
      audioLink,
      verses,
    }];
  });
}

const source = await readFile(sourcePath, "utf8");
const songs = rowsToSongs(parseCSV(source));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(songs), "utf8");
console.log(JSON.stringify({ songs: songs.length, bytes: source.length, outputPath }, null, 2));
