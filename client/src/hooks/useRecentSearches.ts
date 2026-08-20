/**
 * Паломнический свиток: небольшая личная память о поиске, которая остаётся
 * на устройстве пользователя и не отвлекает от чтения песен.
 */

import { useCallback, useEffect, useState } from "react";

const RECENT_SEARCHES_STORAGE_KEY = "kirtan-guide.recent-searches";
const MAX_RECENT_SEARCHES = 6;
const MAX_QUERY_LENGTH = 120;

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];

    const seen = new Set<string>();
    return stored.reduce<string[]>((recent, value) => {
      if (typeof value !== "string") return recent;
      const query = normalizeQuery(value);
      const key = query.toLocaleLowerCase();
      if (!query || seen.has(key) || recent.length >= MAX_RECENT_SEARCHES) return recent;
      seen.add(key);
      recent.push(query);
      return recent;
    }, []);
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches));
    } catch {
      // Local storage can be unavailable in private or restricted browser contexts.
    }
  }, [recentSearches]);

  const rememberSearch = useCallback((value: string) => {
    const query = normalizeQuery(value);
    if (!query) return;

    setRecentSearches((current) => [
      query,
      ...current.filter((item) => item.toLocaleLowerCase() !== query.toLocaleLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES));
  }, []);

  const clearRecentSearches = useCallback(() => setRecentSearches([]), []);

  return { recentSearches, rememberSearch, clearRecentSearches };
}
