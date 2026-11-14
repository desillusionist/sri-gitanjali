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
  credit?: string;
  /** The page the picture comes from. */
  source?: string;
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
  /** The circle cut out ahead of time: a small square picture, named after the portrait and face box it shows. */
  circle?: string;
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

/** Pictures added in the admin tools and not published yet: file name → a local object URL. */
const draftImages = new Map<string, string>();

export function registerDraftImage(file: string, url: string | null) {
  if (url) draftImages.set(file, url);
  else draftImages.delete(file);
}

/** The address of a picture file: the site's copy, or this device's copy while it waits to be published. */
export function storageUrl(file: string): string {
  return draftImages.get(file) ?? STORAGE_URL + file;
}

/** Face box when an author has none: the picture fills the circle, held 15% from the top (3:4 portrait). */
export const DEFAULT_FACE: [number, number, number] = [50, 55, 100];
/** The width and height of a circle picture: sharp at three times the largest circle shown (4.6rem). */
export const CIRCLE_SIZE = 240;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The name, without extension, of the circle picture for a portrait and face box. */
export function circleStem(portrait: string, face: readonly number[] = DEFAULT_FACE): string {
  return `circles/${portrait.replace(/\.\w+$/, "")}@${face.map((value) => String(round1(value))).join("_")}`;
}

/** The circle picture, only when it was cut from this very portrait and face box (else it is out of date). */
export function authorCircleUrl(author: Author, face: readonly number[] | undefined): string | undefined {
  if (!author.portrait || !author.circle) return undefined;
  return author.circle.replace(/\.\w+$/, "") === circleStem(author.portrait, face ?? DEFAULT_FACE) ? storageUrl(author.circle) : undefined;
}

export function authorPortraitUrl(author: Author): string | undefined {
  return author.portrait ? storageUrl(author.portrait) : undefined;
}

export function authorLargePortraitUrl(author: Author): string | undefined {
  return author.portraitLarge ? storageUrl(author.portraitLarge) : authorPortraitUrl(author);
}

/** The pictures of the enlarged view: the portrait first, then the gallery. */
export function authorSlides(author: Author): (Omit<AuthorImage, "credit" | "source"> & Partial<AuthorImage>)[] {
  const portrait = authorLargePortraitUrl(author);
  return [
    ...(portrait ? [{ ...author.portraitInfo, src: portrait }] : []),
    ...(author.gallery ?? []).map((image) => ({ ...image, src: storageUrl(image.src) })),
  ].slice(0, 10);
}

/** Up to two initials, skipping honorifics, for authors without a portrait. */
export function authorInitials(author: Author): string {
  const words = author.name.split(/\s+/).filter((word) => !/^Śrī(la|pād)?$/.test(word));
  return words.slice(0, 2).map((word) => word[0]).join("");
}
