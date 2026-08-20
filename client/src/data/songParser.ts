/**
 * Паломнический свиток: перенос логики SongDatabase.swift в независимый,
 * тестируемый TypeScript-парсер без привязки к визуальному слою.
 */

import { createSlug, type Song, type SongLine, type Verse } from "@/domain/song";
import { parseCsvRows } from "./csv";

const minimumColumns = 10;

function valueAt(row: string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function makeSongId(title: string, index: number): string {
  return `${createSlug(title)}-${String(index + 1).padStart(3, "0")}`;
}

/** Parses the same columns and ordering used by the original Swift SongDatabase. */
export function parseSongsFromCsv(content: string): Song[] {
  const rows = parseCsvRows(content);
  const songRows = rows.slice(1).filter((row) => row.length >= minimumColumns && valueAt(row, 0));
  const orderedTitles: string[] = [];
  const groupedBySong = new Map<string, string[][]>();

  songRows.forEach((row) => {
    const title = valueAt(row, 0);
    if (!groupedBySong.has(title)) {
      orderedTitles.push(title);
      groupedBySong.set(title, []);
    }
    groupedBySong.get(title)?.push(row);
  });

  return orderedTitles.flatMap((title, songIndex) => {
    const rowsForSong = groupedBySong.get(title) ?? [];
    const firstRow = rowsForSong[0];
    if (!firstRow) return [];

    const versesByNumber = new Map<number, string[][]>();
    rowsForSong.forEach((row) => {
      const originalVerseNumber = Number.parseInt(valueAt(row, 3), 10) || 1;
      const current = versesByNumber.get(originalVerseNumber) ?? [];
      current.push(row);
      versesByNumber.set(originalVerseNumber, current);
    });

    const verses: Verse[] = Array.from(versesByNumber.entries())
      .sort(([left], [right]) => left - right)
      .flatMap(([originalVerseNumber, verseRows]) => {
        const lines: SongLine[] = [...verseRows]
          .sort(
            (left, right) =>
              (Number.parseInt(valueAt(left, 4), 10) || 0) -
              (Number.parseInt(valueAt(right, 4), 10) || 0),
          )
          .flatMap((row, lineIndex) => {
            const transliteration = valueAt(row, 5);
            if (!transliteration) return [];
            return [
              {
                id: `line-${originalVerseNumber}-${lineIndex + 1}`,
                transliteration,
                isIndented: valueAt(row, 6).toLowerCase() === "true",
              },
            ];
          });

        if (lines.length === 0) return [];
        return [
          {
            id: `verse-${originalVerseNumber}`,
            lines,
            translation: valueAt(verseRows[0], 7).replace(/\\n/g, "\n"),
            originalVerseNumber,
          },
        ];
      });

    if (verses.length === 0) return [];
    return [
      {
        id: makeSongId(title, songIndex),
        title,
        poet: valueAt(firstRow, 1) || undefined,
        category: valueAt(firstRow, 2) || "Other Songs",
        comment: valueAt(firstRow, 8) || undefined,
        audioLink: valueAt(firstRow, 9) || undefined,
        verses,
      },
    ];
  });
}

function isSongLine(value: unknown): value is SongLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<SongLine>;
  return typeof line.id === "string" && typeof line.transliteration === "string" && typeof line.isIndented === "boolean";
}

function isVerse(value: unknown): value is Verse {
  if (!value || typeof value !== "object") return false;
  const verse = value as Partial<Verse>;
  return (
    typeof verse.id === "string" &&
    typeof verse.translation === "string" &&
    typeof verse.originalVerseNumber === "number" &&
    Array.isArray(verse.lines) &&
    verse.lines.every(isSongLine)
  );
}

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  return (
    typeof song.id === "string" &&
    typeof song.title === "string" &&
    typeof song.category === "string" &&
    Array.isArray(song.verses) &&
    song.verses.every(isVerse)
  );
}

export function parseSongsJson(content: string): Song[] {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed) || !parsed.every(isSong)) {
    throw new Error("The song JSON does not match the Kīrtan Guide data model.");
  }
  return parsed;
}

export function serializeSongsJson(songs: Song[]): string {
  return JSON.stringify(songs);
}
