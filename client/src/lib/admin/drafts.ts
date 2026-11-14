/**
 * The admin's unpublished changes, kept on this device until "Publish": the pictures of each
 * Vaiṣṇava (main portrait, circle, slideshow and their captions) and the name, place and book
 * notes. New picture files wait in IndexedDB. Everything shows in the app here at once; Publish
 * writes it all to the repository in one commit, and the site rebuilds in about two minutes.
 * Changes stay shown here until the rebuilt site carries them, then they are dropped.
 */
import { useSyncExternalStore } from "react";
import { AUTHORS, findAuthorById, registerDraftImage, type Author, type AuthorImage } from "@/lib/authors";
import { HOLY_NAME_EDITS, type HolyNameEdit, type HolyNameLocalEdit } from "@/lib/holyNames";
import { clearFaceOverrides, sameFace, setFaceOverride, type Face } from "@/lib/portraitCrops";
import { preparePortrait, prepareGalleryImage, type PreparedImage } from "./images";

/** The picture fields of an author that the admin tools change. */
export type AuthorPictures = Pick<Author, "portrait" | "portraitLarge" | "face" | "portraitInfo" | "gallery">;
const PICTURE_FIELDS = ["portrait", "portraitLarge", "face", "portraitInfo", "gallery"] as const;

export type Drafts = {
  authors: Record<string, AuthorPictures>;
  notes: Record<string, HolyNameEdit>;
  localNotes: Record<string, Record<string, HolyNameLocalEdit>>;
  /** Picture files that are no longer used and go when publishing (if nothing else uses them). */
  removeFiles: string[];
  /** Whether there are changes not yet published. */
  dirty: boolean;
  /** When the changes were last published, in ms since 1970. */
  publishedAt?: number;
};

/** After publishing, changes stay shown here until the rebuilt site carries them, but no longer than this. */
const SHOW_PUBLISHED_FOR_MS = 15 * 60 * 1000;

const EMPTY: Drafts = { authors: {}, notes: {}, localNotes: {}, removeFiles: [], dirty: false };
const STORAGE_KEY = "kirtan-guide:admin-drafts";
const listeners = new Set<() => void>();

function load(): Drafts {
  try {
    return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

let drafts: Drafts = typeof window === "undefined" ? EMPTY : load();

function save(next: Drafts) {
  drafts = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the changes last until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDrafts(): Drafts {
  return useSyncExternalStore(subscribe, () => drafts, () => EMPTY);
}

export function getDrafts() {
  return drafts;
}

export function draftCount(value: Drafts) {
  return Object.keys(value.authors).length + Object.keys(value.notes).length + Object.values(value.localNotes).reduce((sum, notes) => sum + Object.keys(notes).length, 0);
}

// --- Picture files waiting on this device (IndexedDB) ---

const DB_NAME = "kirtan-guide-admin";
const STORE = "files";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const draftFiles = new Map<string, Blob>();

async function putFile(name: string, blob: Blob) {
  await withStore("readwrite", (store) => store.put(blob, name));
  draftFiles.set(name, blob);
  registerDraftImage(name, URL.createObjectURL(blob));
}

async function dropFile(name: string) {
  draftFiles.delete(name);
  registerDraftImage(name, null);
  await withStore("readwrite", (store) => store.delete(name)).catch(() => undefined);
}

export function getDraftFile(name: string) {
  return draftFiles.get(name);
}

const isDraftFile = (name: string | undefined) => !!name && draftFiles.has(name);

/** Files an author's pictures use. */
function filesOf(pictures: Partial<AuthorPictures>): string[] {
  return [pictures.portrait, pictures.portraitLarge, ...(pictures.gallery ?? []).map((image) => image.src)].filter((name): name is string => !!name);
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function bundledPictures(author: Author): AuthorPictures {
  const out = {} as AuthorPictures;
  for (const field of PICTURE_FIELDS) if (author[field] !== undefined) (out as Record<string, unknown>)[field] = author[field];
  return out;
}

/**
 * Loads the waiting picture files, and drops changes the site already carries (after a publish
 * and rebuild) along with files nothing uses any more.
 */
export async function initDrafts() {
  if (typeof indexedDB === "undefined") return;
  // Published long enough ago that the site carries it (or something newer): the site is right.
  if (!drafts.dirty && (!drafts.publishedAt || Date.now() - drafts.publishedAt > SHOW_PUBLISHED_FOR_MS)) {
    if (draftCount(drafts) || drafts.removeFiles.length) save(EMPTY);
  }
  const authors = { ...drafts.authors };
  for (const [id, pictures] of Object.entries(authors)) {
    const author = findAuthorById(id);
    if (!author || PICTURE_FIELDS.every((field) => sameJson(pictures[field], author[field]))) delete authors[id];
  }
  const notes = { ...drafts.notes };
  for (const [key, edit] of Object.entries(notes)) if (sameJson(edit, HOLY_NAME_EDITS.entries[key])) delete notes[key];
  const localNotes: Drafts["localNotes"] = {};
  for (const [language, edits] of Object.entries(drafts.localNotes)) {
    const left = Object.fromEntries(Object.entries(edits).filter(([key, edit]) => !sameJson(edit, HOLY_NAME_EDITS.i18n[language]?.[key])));
    if (Object.keys(left).length) localNotes[language] = left;
  }
  save({ ...drafts, authors, notes, localNotes });

  try {
    const names = (await withStore("readonly", (store) => store.getAllKeys())) as string[];
    const used = new Set(Object.values(authors).flatMap(filesOf));
    for (const name of names) {
      if (!used.has(name)) { await dropFile(name); continue; }
      const blob = (await withStore("readonly", (store) => store.get(name))) as Blob | undefined;
      if (blob) { draftFiles.set(name, blob); registerDraftImage(name, URL.createObjectURL(blob)); }
    }
    listeners.forEach((listener) => listener());
  } catch {
    // IndexedDB unavailable (private mode): new pictures cannot wait across page loads.
  }
}

// --- Pictures ---

/** An author as the app should show them here: with this device's unpublished picture changes. */
export function liveAuthor(author: Author, value: Drafts = drafts): Author {
  const pictures = value.authors[author.id];
  if (!pictures) return author;
  const merged = { ...author };
  for (const field of PICTURE_FIELDS) {
    if (pictures[field] === undefined) delete merged[field];
    else (merged as Record<string, unknown>)[field] = pictures[field];
  }
  return merged;
}

export function useLiveAuthor(author: Author): Author {
  return liveAuthor(author, useDrafts());
}

/** The published author, whatever version (with or without this device's changes) the caller holds. */
const published = (author: Author) => findAuthorById(author.id) ?? author;

function current(author: Author): AuthorPictures {
  return drafts.authors[author.id] ?? bundledPictures(published(author));
}

function setPictures(given: Author, pictures: AuthorPictures, removed: (string | undefined)[] = []) {
  const author = published(given);
  const authors = { ...drafts.authors, [author.id]: pictures };
  if (PICTURE_FIELDS.every((field) => sameJson(pictures[field], author[field]))) delete authors[author.id];
  const removeFiles = new Set(drafts.removeFiles);
  const stillUsed = new Set(filesOf(pictures));
  for (const name of removed) {
    if (!name || stillUsed.has(name)) continue;
    if (isDraftFile(name)) void dropFile(name);
    else removeFiles.add(name);
  }
  save({ ...drafts, authors, removeFiles: Array.from(removeFiles), dirty: true });
}

const stamp = () => Date.now().toString(36);
const fileName = (author: Author, image: PreparedImage, suffix = "") => `author-${author.id}-${stamp()}${suffix}.${image.ext}`;

/** Adds pictures to the slideshow (resized on this device). Returns how many were added. */
export async function addPictures(author: Author, sources: Blob[]): Promise<number> {
  let pictures = current(author);
  let added = 0;
  for (const source of sources) {
    const image = await prepareGalleryImage(source);
    const name = fileName(author, image, `-${added + 1}`);
    await putFile(name, image.blob);
    pictures = { ...pictures, gallery: [...(pictures.gallery ?? []), { src: name }] };
    added += 1;
  }
  setPictures(author, pictures);
  return added;
}

export function removePicture(author: Author, src: string) {
  const pictures = current(author);
  setPictures(author, { ...pictures, gallery: (pictures.gallery ?? []).filter((image) => image.src !== src) }, [src]);
}

export function movePicture(author: Author, src: string, step: -1 | 1) {
  const pictures = current(author);
  const gallery = [...(pictures.gallery ?? [])];
  const index = gallery.findIndex((image) => image.src === src);
  const target = index + step;
  if (index < 0 || target < 0 || target >= gallery.length) return;
  [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
  setPictures(author, { ...pictures, gallery });
}

export type PictureInfo = Pick<AuthorImage, "caption" | "credit" | "source">;

const cleanInfo = (info: PictureInfo): PictureInfo => {
  const out: PictureInfo = {};
  for (const key of ["caption", "credit", "source"] as const) if (info[key]?.trim()) out[key] = info[key]!.trim();
  return out;
};

/** Caption, credit and source of a slideshow picture, or of the main portrait (src "portrait"). */
export function setPictureInfo(author: Author, src: string, info: PictureInfo) {
  const pictures = current(author);
  const clean = cleanInfo(info);
  if (src === "portrait") {
    setPictures(author, { ...pictures, portraitInfo: Object.keys(clean).length ? clean : undefined });
    return;
  }
  setPictures(author, { ...pictures, gallery: (pictures.gallery ?? []).map((image) => (image.src === src ? { src: image.src, ...clean } : image)) });
}

/**
 * Makes a picture the main portrait, cut to 3:4 as framed: the slideshow picture it came from is
 * replaced by it, and the former main portrait moves to the front of the slideshow. With src
 * "portrait" the current main portrait is only framed again.
 */
export async function setMainPortrait(author: Author, src: string, frame: Face) {
  const pictures = current(author);
  const isReframe = src === "portrait";
  const sourceFile = isReframe ? pictures.portraitLarge ?? pictures.portrait : src;
  if (!sourceFile) return;
  const source = getDraftFile(sourceFile) ?? `${import.meta.env.BASE_URL}manus-storage/${sourceFile}`;
  const { portrait, large } = await preparePortrait(source, frame);
  const portraitName = fileName(author, portrait);
  const largeName = portraitName.replace(/\.(\w+)$/, `-large.${large.ext}`);
  await putFile(portraitName, portrait.blob);
  await putFile(largeName, large.blob);
  const chosen = (pictures.gallery ?? []).find((image) => image.src === src);
  const formerMain: AuthorImage | null = !isReframe && (pictures.portraitLarge ?? pictures.portrait)
    ? { src: (pictures.portraitLarge ?? pictures.portrait)!, ...pictures.portraitInfo }
    : null;
  const gallery = [...(formerMain ? [formerMain] : []), ...(pictures.gallery ?? []).filter((image) => image.src !== src)];
  const next: AuthorPictures = {
    ...pictures,
    portrait: portraitName,
    portraitLarge: largeName,
    face: undefined,
    portraitInfo: isReframe ? pictures.portraitInfo : chosen && Object.keys(cleanInfo(chosen)).length ? cleanInfo(chosen) : undefined,
    gallery: gallery.length ? gallery : undefined,
  };
  setPictures(author, next, [pictures.portrait, isReframe ? pictures.portraitLarge : undefined, isReframe ? undefined : src]);
}

/** The circle: kept with the picture changes when the admin is signed in. */
export function setCircle(given: Author, face: Face | null) {
  const author = published(given);
  const pictures = current(author);
  if (!face || sameFace(face, author.face as Face | undefined)) {
    const { face: _face, ...rest } = pictures;
    void _face;
    setPictures(author, author.face ? { ...rest, face: author.face } : rest);
  } else {
    setPictures(author, { ...pictures, face });
  }
  setFaceOverride(author, null);
}

// --- Notes ---

export function setNoteEdit(key: string, edit: HolyNameEdit | null) {
  const notes = { ...drafts.notes };
  if (edit) notes[key] = edit;
  else delete notes[key];
  save({ ...drafts, notes, dirty: true });
}

export function setLocalNoteEdit(language: string, key: string, edit: HolyNameLocalEdit | null) {
  const forLanguage = { ...drafts.localNotes[language] };
  if (edit) forLanguage[key] = edit;
  else delete forLanguage[key];
  save({ ...drafts, localNotes: { ...drafts.localNotes, [language]: forLanguage }, dirty: true });
}

/** Moves circles saved on this device (on the circles page) into the picture changes. */
export function adoptFaceOverrides(overrides: Record<string, Face>) {
  for (const [id, face] of Object.entries(overrides)) {
    const author = AUTHORS.find((candidate) => candidate.id === id);
    if (author) setCircle(author, face);
  }
  clearFaceOverrides();
}

export function discardDrafts() {
  for (const name of Array.from(draftFiles.keys())) void dropFile(name);
  save(EMPTY);
}

export function markPublished() {
  save({ ...drafts, removeFiles: [], dirty: false, publishedAt: Date.now() });
}
