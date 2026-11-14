/**
 * Round crops of the author portraits: the face box ([centre x, centre y, diameter], each in % of
 * the image width), its maths, and the adjustments made on this device in the portrait-circle
 * editor. Adjustments are kept in this browser only, shown everywhere here, and shared as text
 * so they can be written into authors.json.
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import type { Author } from "@/lib/authors";

export type Face = [number, number, number];

/** Image height in % of its width (133.3 for a 3:4 portrait). */
export const PORTRAIT_HEIGHT = 400 / 3;

const MIN_DIAMETER = 8;

/** Scales and shifts the picture so the face box fills the circle, centred. */
export function faceStyle(face: Face): CSSProperties {
  const [x, y, diameter] = face;
  const percent = (value: number) => `${Math.round(value * 1000) / 1000}%`;
  return { width: percent((100 * 100) / diameter), left: percent(50 - (x / diameter) * 100), top: percent(50 - (y / diameter) * 100) };
}

/** The box the circle shows when an author has none: the picture fills it, held 15% from the top. */
const round = (value: number) => Math.round(value * 10) / 10;

export function defaultFace(height = PORTRAIT_HEIGHT): Face {
  if (height >= 100) return [50, round(50 + 0.15 * (height - 100)), 100];
  return [50, round(height / 2), round(height)];
}

/** Keeps the circle inside the picture so no empty corner shows. */
export function clampFace([x, y, diameter]: Face, height = PORTRAIT_HEIGHT): Face {
  const d = Math.min(Math.max(diameter, MIN_DIAMETER), Math.min(100, height));
  const clamp = (value: number, max: number) => Math.min(Math.max(value, d / 2), max - d / 2);
  return [round(clamp(x, 100)), round(clamp(y, height)), round(d)];
}

/** Moves the picture by a drag of (dx, dy) pixels inside a circle `size` pixels wide. */
export function dragFace([x, y, diameter]: Face, dx: number, dy: number, size: number, height = PORTRAIT_HEIGHT): Face {
  return clampFace([x - (dx * diameter) / size, y - (dy * diameter) / size, diameter], height);
}

/** Zooms around the circle's centre: a factor above 1 brings the face closer. */
export function zoomFace([x, y, diameter]: Face, factor: number, height = PORTRAIT_HEIGHT): Face {
  return clampFace([x, y, diameter / factor], height);
}

export const sameFace = (a: Face | undefined, b: Face | undefined) => !!a && !!b && a.every((value, index) => Math.abs(value - b[index]) < 0.05);

/** The lines to send: one per changed author, as authors.json writes the face box. */
export function formatFaceChanges(changes: Record<string, Face>, authors: Pick<Author, "id" | "name">[]): string {
  const names = new Map(authors.map((author) => [author.id, author.name]));
  const lines = Object.entries(changes).map(([id, [x, y, d]]) => `${id}: [${x}, ${y}, ${d}]  — ${names.get(id) ?? id}`);
  return ["Portrait circles", ...lines].join("\n");
}

const STORAGE_KEY = "kirtan-guide:portrait-faces";
const listeners = new Set<() => void>();

function load(): Record<string, Face> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

let overrides: Record<string, Face> = typeof window === "undefined" ? {} : load();

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Private mode or full storage: the change still shows until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

/** Keeps an adjusted face box for an author, or drops it when it is null or equals the original. */
export function setFaceOverride(author: Pick<Author, "id" | "face">, face: Face | null) {
  const next = { ...overrides };
  if (!face || sameFace(face, author.face as Face | undefined)) delete next[author.id];
  else next[author.id] = face;
  overrides = next;
  save();
}

export function clearFaceOverrides() {
  overrides = {};
  save();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFaceOverrides(): Record<string, Face> {
  return useSyncExternalStore(subscribe, () => overrides, () => overrides);
}

/** The face box to show for an author: this device's adjustment, else the one in authors.json. */
export function useAuthorFace(author: Pick<Author, "id" | "face">): Face | undefined {
  const local = useFaceOverrides();
  return local[author.id] ?? (author.face as Face | undefined);
}
