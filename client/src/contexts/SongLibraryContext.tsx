/**
 * Паломнический свиток: данные загружаются один раз и остаются тихим фоном
 * для чтения, поиска и маршрутов без визуального шума.
 */

import { loadSongs } from "@/data/songLoader";
import type { Song, SongDataStatus } from "@/domain/song";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type SongLibraryState = {
  songs: Song[];
  status: SongDataStatus;
  source: "json" | "csv" | null;
  error: string | null;
  reload: () => void;
};

const SongLibraryContext = createContext<SongLibraryState | null>(null);

export function SongLibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<SongDataStatus>("idle");
  const [source, setSource] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        setError("Не удалось загрузить локальную библиотеку песен.");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <SongLibraryContext.Provider
      value={{
        songs,
        status,
        source,
        error,
        reload: () => setReloadKey((value) => value + 1),
      }}
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
