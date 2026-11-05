/** Author bios: looks up the author of a song by the poet name written in the song data. */

import authorData from "@/data/authors.json";
import { STORAGE_URL } from "@/data/sources";

export type Author = {
  id: string;
  /** Every spelling of this author's name used in the songs' poet field. */
  names: string[];
  name: string;
  dates: string;
  place: string;
  role: string;
  portrait?: string;
  /** CSS object-position that keeps the face in view in a round crop. */
  focus?: string;
  summary: string;
  bio: string[];
  sources: string[];
};

export const AUTHORS: Author[] = authorData.authors;

const normalize = (name: string) => name.normalize("NFC").trim().toLowerCase();

const authorsByName = new Map(AUTHORS.flatMap((author) => author.names.map((name) => [normalize(name), author] as const)));
const authorsById = new Map(AUTHORS.map((author) => [author.id, author]));

export function findAuthorByPoet(poet: string | undefined | null): Author | undefined {
  return poet ? authorsByName.get(normalize(poet)) : undefined;
}

export function findAuthorById(id: string): Author | undefined {
  return authorsById.get(id);
}

export function authorHref(author: Author): string {
  return `/author/${author.id}`;
}

export function authorPortraitUrl(author: Author): string | undefined {
  return author.portrait ? STORAGE_URL + author.portrait : undefined;
}

/** Up to two initials, skipping honorifics, for authors without a portrait. */
export function authorInitials(author: Author): string {
  const words = author.name.split(/\s+/).filter((word) => !/^Śrī(la|pād)?$/.test(word));
  return words.slice(0, 2).map((word) => word[0]).join("");
}
