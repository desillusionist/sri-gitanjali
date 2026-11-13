/** Author bios: looks up the author of a song by the poet name written in the song data. */

import authorData from "@/data/authors.json";
import { STORAGE_URL } from "@/data/sources";

export const VAISNAVA_GROUPS = ["saraswat", "exalted", "mahaprabhu", "goswamis", "acharyas", "ancient"] as const;
export type VaisnavaGroup = (typeof VAISNAVA_GROUPS)[number];

/** A further picture of an author, shown in the enlarged view's slideshow. */
export type AuthorImage = {
  src: string;
  /** What the picture shows, e.g. "As a magistrate, late 1880s". */
  caption?: string;
  /** Who made it and its licence, as the source states them. */
  credit: string;
  /** The page the picture comes from. */
  source: string;
};

export type Author = {
  id: string;
  /** Every spelling of this author's name used in the songs' poet field. */
  names: string[];
  name: string;
  dates: string;
  place: string;
  role: string;
  portrait?: string;
  /** A sharper copy for the enlarged view on the author's page. */
  portraitLarge?: string;
  /** Face box for round crops: centre x, centre y and diameter, each in % of the image width. */
  face?: [number, number, number];
  /** Caption, credit and source of the portrait itself, when it comes from an outside source. */
  portraitInfo?: Omit<AuthorImage, "src">;
  /** More pictures for the slideshow in the enlarged view, after the portrait (at most ten in all). */
  gallery?: AuthorImage[];
  /** Where the person sits on the Vaiṣṇavas page. */
  group?: VaisnavaGroup;
  /** Songs in this book written in their honour. */
  songIds?: string[];
  summary: string;
  bio: string[];
  sources: string[];
};

export const AUTHORS: Author[] = authorData.authors as Author[];

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

export function authorLargePortraitUrl(author: Author): string | undefined {
  return author.portraitLarge ? STORAGE_URL + author.portraitLarge : authorPortraitUrl(author);
}

/** The pictures of the enlarged view: the portrait first, then the gallery. */
export function authorSlides(author: Author): (Omit<AuthorImage, "credit" | "source"> & Partial<AuthorImage>)[] {
  const portrait = authorLargePortraitUrl(author);
  return [
    ...(portrait ? [{ ...author.portraitInfo, src: portrait }] : []),
    ...(author.gallery ?? []).map((image) => ({ ...image, src: STORAGE_URL + image.src })),
  ].slice(0, 10);
}

/** Up to two initials, skipping honorifics, for authors without a portrait. */
export function authorInitials(author: Author): string {
  const words = author.name.split(/\s+/).filter((word) => !/^Śrī(la|pād)?$/.test(word));
  return words.slice(0, 2).map((word) => word[0]).join("");
}
