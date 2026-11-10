/** Name and place notes in the reader's second language, loaded only when that language is chosen. */
import { useEffect, useState } from "react";
import type { HolyNameKind } from "@/lib/holyNames";

export type HolyNameLocale = {
  ui: { kinds: Record<HolyNameKind, string>; page: string; map: string };
  /** Per entry id (or "id/variant" for another name): the translated note, and the name where the language spells it differently. */
  entries: Record<string, { name?: string; about: string }>;
};

const loaders = import.meta.glob<HolyNameLocale>("../data/holy-names-i18n/*.json", { import: "default" });
const cache = new Map<string, Promise<HolyNameLocale | null>>();

/** Key of a note in a language file: the entry id, or "id/variant" for one of its other names. */
export function holyNameNoteKey(id: string, variant?: string) {
  return variant ? `${id}/${variant}` : id;
}

export const HOLY_NAME_LOCALES = Object.keys(loaders).map((path) => path.replace(/^.*\/(\w+)\.json$/, "$1"));

export function loadHolyNameLocale(language: string): Promise<HolyNameLocale | null> {
  const loader = loaders[`../data/holy-names-i18n/${language}.json`];
  if (!loader) return Promise.resolve(null);
  if (!cache.has(language)) cache.set(language, loader().catch(() => null));
  return cache.get(language)!;
}

/** The notes for a language, or null for English, an unknown language or while they load. */
export function useHolyNameLocale(language: string | null | undefined): HolyNameLocale | null {
  const [state, setState] = useState<{ language: string; locale: HolyNameLocale | null } | null>(null);
  useEffect(() => {
    if (!language) return;
    let isCurrent = true;
    void loadHolyNameLocale(language).then((locale) => { if (isCurrent) setState({ language, locale }); });
    return () => { isCurrent = false; };
  }, [language]);
  return language && state?.language === language ? state.locale : null;
}
