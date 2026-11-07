import { useCallback, useEffect, useMemo, useState } from "react";
import type { SecondaryTranslationLookup } from "@/domain/song";
import {
  isSecondaryTranslationLanguage,
  loadPackagedSecondaryTranslations,
  usesStaticSecondaryTranslation,
  type SecondaryTranslationLanguage,
} from "@/lib/secondaryTranslations";

/** Shared with the reader, so the library searches the same second language the songs show. */
export const READING_PREFERENCES_STORAGE_KEY = "kirtan-guide.reading-preferences";

export function readStoredSecondaryLanguage(): SecondaryTranslationLanguage | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READING_PREFERENCES_STORAGE_KEY) ?? "null") as { secondaryTranslationLanguage?: unknown } | null;
    return isSecondaryTranslationLanguage(parsed?.secondaryTranslationLanguage) ? parsed.secondaryTranslationLanguage : null;
  } catch {
    return null;
  }
}

function storeSecondaryLanguage(language: SecondaryTranslationLanguage | null) {
  try {
    const current = JSON.parse(window.localStorage.getItem(READING_PREFERENCES_STORAGE_KEY) ?? "null") ?? {};
    window.localStorage.setItem(READING_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...current, secondaryTranslationLanguage: language }));
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/**
 * The second language the library search also looks in, with its packaged translations once loaded.
 * Only packaged languages can be searched; on-demand ones exist only after a song is opened.
 */
export function useSecondarySearch() {
  const [language, setLanguageState] = useState<SecondaryTranslationLanguage | null>(() => {
    const stored = typeof window === "undefined" ? null : readStoredSecondaryLanguage();
    return usesStaticSecondaryTranslation(stored) ? stored : null;
  });
  const [translations, setTranslations] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    setTranslations(null);
    if (!usesStaticSecondaryTranslation(language)) return;
    let cancelled = false;
    loadPackagedSecondaryTranslations(language)
      .then((loaded) => { if (!cancelled) setTranslations(loaded); })
      .catch(() => { if (!cancelled) setTranslations(null); });
    return () => { cancelled = true; };
  }, [language]);

  const setLanguage = useCallback((next: SecondaryTranslationLanguage | null) => {
    setLanguageState(next);
    storeSecondaryLanguage(next);
  }, []);

  const lookup = useMemo<SecondaryTranslationLookup | undefined>(
    () => (translations ? (song, verse) => translations.get(`${song.id}::${verse.id}`) : undefined),
    [translations],
  );

  return { language, setLanguage, lookup, isLoading: language !== null && translations === null };
}
