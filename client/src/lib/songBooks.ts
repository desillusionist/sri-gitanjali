/** Which book each song comes from, and the songs of each book (see song-books.json). */
import data from "@/data/song-books.json";

type Links = Record<string, string[]>;
const FROM = data.from as Links;
const IS = data.is as Links;
const ABOUT = data.about as Links;
const ORDER = new Map(Object.keys({ ...FROM, ...IS, ...ABOUT }).map((id, index) => [id, index]));

/** The book a song comes from (its first, when it is in more than one). */
export function songBook(songId: string): string | undefined {
  return FROM[songId]?.[0];
}

/** The songs from a book, those that are the book or poem itself, and the songs on it, in book order. */
export function bookSongIds(bookId: string): string[] {
  const ids = new Set<string>();
  for (const links of [IS, FROM, ABOUT]) for (const [songId, books] of Object.entries(links)) if (books.includes(bookId)) ids.add(songId);
  return Array.from(ids);
}

export const songOrder = (id: string) => ORDER.get(id) ?? 0;
