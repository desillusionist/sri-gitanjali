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

export type SongDataStatus = "idle" | "loading" | "ready" | "error";

export const ALL_AUTHORS_FILTER = "__all_authors__";
export const ALL_CATEGORIES_FILTER = "__all_categories__";
export const UNLISTED_AUTHOR_FILTER = "__unlisted_author__";

export type SongSearchFilters = {
  query: string;
  author: string;
  category: string;
};

export const defaultSongSearchFilters: SongSearchFilters = {
  query: "",
  author: ALL_AUTHORS_FILTER,
  category: ALL_CATEGORIES_FILTER,
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

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

    return matchesQuery && matchesAuthor && matchesCategory;
  });
}

export function hasActiveSongFilters(filters: SongSearchFilters): boolean {
  return Boolean(normalizeSearchText(filters.query)) || filters.author !== ALL_AUTHORS_FILTER || filters.category !== ALL_CATEGORIES_FILTER;
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
