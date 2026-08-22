/**
 * Паломнический свиток: доменные типы сохраняют текст песни в центре продукта,
 * а интерфейс использует спокойную редакционную иерархию вокруг него.
 */

export type SongLine = {
  id: string;
  transliteration: string;
  isIndented: boolean;
};

export type Verse = {
  id: string;
  lines: SongLine[];
  translation: string;
  originalVerseNumber: number;
};

export type Song = {
  /** Stable web identifier; unlike the original SwiftUI title-based ID, it survives display changes. */
  id: string;
  title: string;
  poet?: string;
  verses: Verse[];
  category: string;
  comment?: string;
  audioLink?: string;
};

export type SongCategory = {
  id: string;
  name: string;
  songs: Song[];
};

export type SongInitialIndexGroup = {
  letter: string;
  songs: Song[];
};

export type SongDataStatus = "idle" | "loading" | "ready" | "error";

export const ALL_AUTHORS_FILTER = "__all_authors__";
export const ALL_CATEGORIES_FILTER = "__all_categories__";
export const UNLISTED_AUTHOR_FILTER = "__unlisted_author__";
export const ALL_RECORDINGS_FILTER = "__all_recordings__";
export const WITH_RECORDINGS_FILTER = "__with_recordings__";

export type RecordingFilter = typeof ALL_RECORDINGS_FILTER | typeof WITH_RECORDINGS_FILTER;

export type SongSearchFilters = {
  query: string;
  author: string;
  category: string;
  recording: RecordingFilter;
};

export type HighlightPart = {
  text: string;
  isMatch: boolean;
  matchIndex?: number;
};

export type SongSearchMatchKind = "title" | "author" | "comment" | "line" | "translation";

export type SongSearchMatch = {
  id: string;
  fieldId: string;
  matchIndex: number;
  kind: SongSearchMatchKind;
  verseId?: string;
};

export type SongSearchExcerpt = {
  text: string;
  source: "line" | "translation" | "comment";
};

export const defaultSongSearchFilters: SongSearchFilters = {
  query: "",
  author: ALL_AUTHORS_FILTER,
  category: ALL_CATEGORIES_FILTER,
  recording: ALL_RECORDINGS_FILTER,
};

export const categoryOrder = [
  "Invocations",
  "Morning Songs",
  "Midday Songs",
  "Evening Songs",
  "Songs to Śrī Nityānanda Prabhu",
  "Songs to Śrī Chaitanya Mahāprabhu",
  "Other Songs",
  "Śrī Śikṣāṣṭakam",
  "Songs to Śrīmatī Rādhārāṇī",
  "Songs to Śrī Krishna",
  "Songs on Special Days",
  "Poems of Śrīla Śrīdhar Mahārāja",
  "Poems of Śrīla Govinda Mahārāja",
] as const;

export function songFirstLine(song: Song): string {
  return song.verses[0]?.lines[0]?.transliteration.trim() || song.title;
}

export function getSoundCloudRecordingUrl(song: Pick<Song, "audioLink">): string | null {
  if (!song.audioLink) return null;

  try {
    const sourceUrl = new URL(song.audioLink);
    return /(^|\.)soundcloud\.com$/i.test(sourceUrl.hostname) ? sourceUrl.toString() : null;
  } catch {
    return null;
  }
}

export function hasSoundCloudRecording(song: Pick<Song, "audioLink">): boolean {
  return Boolean(getSoundCloudRecordingUrl(song));
}

/**
 * Removes display-only cues such as "(kiba)" while preserving the source text
 * used by search, copying, indexing, and teleprompter reading.
 */
export function hideSecondarySongOrnaments(value: string): string {
  let cleaned = value;
  let previousValue = "";

  while (cleaned !== previousValue) {
    previousValue = cleaned;
    cleaned = cleaned.replace(/\([^()]*\)/g, " ");
  }

  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Hides parenthetical cues that can begin on one stored song line and end on
 * the next. The original SongLine objects remain intact for search and copy.
 */
export function hideSecondarySongOrnamentsInLines(lines: SongLine[]): SongLine[] {
  let parenthesisDepth = 0;

  return lines.flatMap((line) => {
    let visibleText = "";

    for (const character of line.transliteration) {
      if (character === "(") {
        parenthesisDepth += 1;
        continue;
      }

      if (character === ")" && parenthesisDepth > 0) {
        parenthesisDepth -= 1;
        continue;
      }

      if (parenthesisDepth === 0) visibleText += character;
    }

    const transliteration = hideSecondarySongOrnaments(visibleText);
    return transliteration ? [{ ...line, transliteration }] : [];
  });
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizedTextWithIndexMap(value: string): { normalized: string; indexes: number[] } {
  let normalized = "";
  const indexes: number[] = [];
  let originalOffset = 0;

  for (const character of value) {
    const normalizedCharacter = character
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    for (const normalizedPart of normalizedCharacter) {
      normalized += normalizedPart;
      indexes.push(originalOffset);
    }
    originalOffset += character.length;
  }

  return { normalized, indexes };
}

export type TextMatchRange = { start: number; end: number };

export function getOriginalMatchRanges(value: string, query: string): TextMatchRange[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const { normalized, indexes } = normalizedTextWithIndexMap(value);
  const ranges: TextMatchRange[] = [];
  let searchFrom = 0;

  while (searchFrom < normalized.length) {
    const matchStart = normalized.indexOf(normalizedQuery, searchFrom);
    if (matchStart === -1) break;

    const matchEnd = matchStart + normalizedQuery.length;
    ranges.push({ start: indexes[matchStart], end: indexes[matchEnd] ?? value.length });
    searchFrom = matchEnd;
  }

  return ranges;
}

export function getHighlightParts(value: string, query: string): HighlightPart[] {
  const ranges = getOriginalMatchRanges(value, query);
  if (!ranges.length) return [{ text: value, isMatch: false }];

  const parts: HighlightPart[] = [];
  let cursor = 0;

  ranges.forEach((range, matchIndex) => {
    if (range.start > cursor) parts.push({ text: value.slice(cursor, range.start), isMatch: false });
    parts.push({ text: value.slice(range.start, range.end), isMatch: true, matchIndex });
    cursor = range.end;
  });

  if (cursor < value.length) parts.push({ text: value.slice(cursor), isMatch: false });
  return parts;
}

function getOriginalMatchRange(value: string, query: string): TextMatchRange | null {
  return getOriginalMatchRanges(value, query)[0] ?? null;
}

function buildContextExcerpt(value: string, query: string, radius = 44): string | null {
  const range = getOriginalMatchRange(value, query);
  if (!range) return null;

  const provisionalStart = Math.max(0, range.start - radius);
  const provisionalEnd = Math.min(value.length, range.end + radius);
  const startBreak = value.lastIndexOf(" ", provisionalStart);
  const endBreak = value.indexOf(" ", provisionalEnd);
  const start = startBreak === -1 ? 0 : startBreak + 1;
  const end = endBreak === -1 ? value.length : endBreak;
  const excerpt = value.slice(start, end).trim();

  return `${start > 0 ? "…" : ""}${excerpt}${end < value.length ? "…" : ""}`;
}

export function getSongSearchExcerpt(song: Song, query: string): SongSearchExcerpt | null {
  if (!normalizeSearchText(query)) return null;

  const candidates: Array<{ text: string; source: SongSearchExcerpt["source"] }> = [
    ...song.verses.flatMap((verse) => verse.lines.map((line) => ({ text: line.transliteration, source: "line" as const }))),
    ...song.verses.map((verse) => ({ text: verse.translation, source: "translation" as const })),
    ...(song.comment ? [{ text: song.comment, source: "comment" as const }] : []),
  ];

  for (const candidate of candidates) {
    const text = buildContextExcerpt(candidate.text, query);
    if (text) return { text, source: candidate.source };
  }

  return null;
}

export function getSongSearchMatches(song: Song, query: string): SongSearchMatch[] {
  if (!normalizeSearchText(query)) return [];

  const matches: SongSearchMatch[] = [];
  const addMatches = (value: string, fieldId: string, kind: SongSearchMatchKind, verseId?: string) => {
    getOriginalMatchRanges(value, query).forEach((_range, matchIndex) => {
      matches.push({ id: `${fieldId}:${matchIndex}`, fieldId, matchIndex, kind, verseId });
    });
  };

  addMatches(song.title, "title", "title");
  if (song.poet) addMatches(song.poet, "author", "author");
  if (song.comment) addMatches(song.comment, "comment", "comment");
  song.verses.forEach((verse) => {
    verse.lines.forEach((line) => addMatches(line.transliteration, `line:${line.id}`, "line", verse.id));
    if (verse.translation) addMatches(verse.translation, `translation:${verse.id}`, "translation", verse.id);
  });

  return matches;
}

export function songSearchText(song: Song): string {
  return [
    song.title,
    song.poet ?? "",
    song.comment ?? "",
    ...song.verses.flatMap((verse) => [
      verse.translation,
      ...verse.lines.map((line) => line.transliteration),
    ]),
  ]
    .join(" ");
}

export function getSongAuthors(songs: Song[]): string[] {
  return Array.from(new Set(songs.map((song) => song.poet?.trim()).filter(Boolean) as string[])).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function getSongCategories(songs: Song[]): string[] {
  const namedOrder = new Map<string, number>(categoryOrder.map((name, index) => [name, index]));
  return Array.from(new Set(songs.map((song) => song.category))).sort((left, right) => {
    const leftIndex = namedOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = namedOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex;
  });
}

export function filterSongs(songs: Song[], filters: SongSearchFilters): Song[] {
  const query = normalizeSearchText(filters.query);

  return songs.filter((song) => {
    const matchesQuery = !query || normalizeSearchText(songSearchText(song)).includes(query);
    const matchesAuthor =
      filters.author === ALL_AUTHORS_FILTER ||
      (filters.author === UNLISTED_AUTHOR_FILTER ? !song.poet?.trim() : song.poet?.trim() === filters.author);
    const matchesCategory = filters.category === ALL_CATEGORIES_FILTER || song.category === filters.category;
    const matchesRecording = filters.recording === ALL_RECORDINGS_FILTER || hasSoundCloudRecording(song);

    return matchesQuery && matchesAuthor && matchesCategory && matchesRecording;
  });
}

export function hasActiveSongFilters(filters: SongSearchFilters): boolean {
  return Boolean(normalizeSearchText(filters.query)) || filters.author !== ALL_AUTHORS_FILTER || filters.category !== ALL_CATEGORIES_FILTER || filters.recording !== ALL_RECORDINGS_FILTER;
}

export function groupSongsByCategory(songs: Song[]): SongCategory[] {
  const groups = new Map<string, Song[]>();
  songs.forEach((song) => {
    const group = groups.get(song.category) ?? [];
    group.push(song);
    groups.set(song.category, group);
  });

  const namedOrder = new Map<string, number>(categoryOrder.map((name, index) => [name, index]));
  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      const leftIndex = namedOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = namedOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex;
    })
    .map(([name, groupedSongs]) => ({
      id: createSlug(name),
      name,
      songs: groupedSongs,
    }));
}

export function groupSongsByFirstLine(songs: Song[]): SongInitialIndexGroup[] {
  const groups = new Map<string, Song[]>();
  const sortedSongs = [...songs].sort((left, right) => songFirstLine(left).localeCompare(songFirstLine(right), undefined, { sensitivity: "base" }));

  sortedSongs.forEach((song) => {
    const normalizedFirstLine = songFirstLine(song)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
    const letter = normalizedFirstLine.match(/[A-Z]/)?.[0] ?? "#";
    const group = groups.get(letter) ?? [];
    group.push(song);
    groups.set(letter, group);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => left === "#" ? 1 : right === "#" ? -1 : left.localeCompare(right))
    .map(([letter, groupedSongs]) => ({ letter, songs: groupedSongs }));
}

export function createSlug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}
