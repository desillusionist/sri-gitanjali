/**
 * Паломнический свиток: данные загружаются один раз и остаются тихим фоном
 * для чтения, поиска и маршрутов без визуального шума.
 */

import { loadSongs } from "@/data/songLoader";
import type { Song, SongDataStatus } from "@/domain/song";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const FAVORITES_STORAGE_KEY = "kirtan-guide.favorite-song-ids";

function readFavoriteSongIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? new Set(stored.filter((value): value is string => typeof value === "string")) : new Set();
  } catch {
    return new Set();
  }
}

type SongLibraryState = {
  songs: Song[];
  status: SongDataStatus;
  source: "json" | "csv" | null;
  error: string | null;
  reload: () => void;
  favoriteSongIds: ReadonlySet<string>;
  isFavorite: (songId: string) => boolean;
  toggleFavorite: (songId: string) => void;
};

const SongLibraryContext = createContext<SongLibraryState | null>(null);

export function SongLibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<SongDataStatus>("idle");
  const [source, setSource] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteSongIds, setFavoriteSongIds] = useState<Set<string>>(readFavoriteSongIds);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteSongIds)));
  }, [favoriteSongIds]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);

    loadSongs()
      .then((result) => {
        if (!active) return;
        setSongs(result.songs);
        setSource(result.source);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setSongs([]);
        setStatus("error");
        setError("The local song library could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const toggleFavorite = useCallback((songId: string) => {
    setFavoriteSongIds((current) => {
      const next = new Set(current);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      songs,
      status,
      source,
      error,
      reload: () => setReloadKey((current) => current + 1),
      favoriteSongIds,
      isFavorite: (songId: string) => favoriteSongIds.has(songId),
      toggleFavorite,
    }),
    [error, favoriteSongIds, songs, source, status, toggleFavorite],
  );

  return (
    <SongLibraryContext.Provider
      value={value}
    >
      {children}
    </SongLibraryContext.Provider>
  );
}

export function useSongLibrary() {
  const value = useContext(SongLibraryContext);
  if (!value) throw new Error("useSongLibrary must be used within SongLibraryProvider.");
  return value;
}
