import { useCallback, useSyncExternalStore } from "react";

/** The playlist is a list of soundcloud.com track URLs, kept on this device only. */
const PLAYLIST_STORAGE_KEY = "kirtan-guide.playlist";
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYLIST_STORAGE_KEY) ?? "[]");
    cache = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the playlist lasts for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the playlist.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PLAYLIST_STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: string[] = [];

export function usePlaylist() {
  const tracks = useSyncExternalStore(subscribe, read, () => EMPTY);

  const has = useCallback((url: string) => tracks.includes(url), [tracks]);
  const add = useCallback((url: string) => { if (!read().includes(url)) write([...read(), url]); }, []);
  const remove = useCallback((url: string) => write(read().filter((track) => track !== url)), []);
  const toggle = useCallback((url: string) => (read().includes(url) ? write(read().filter((track) => track !== url)) : write([...read(), url])), []);
  const move = useCallback((url: string, offset: -1 | 1) => {
    const next = [...read()];
    const from = next.indexOf(url);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    write(next);
  }, []);
  const addMany = useCallback((urls: string[]) => write([...read(), ...urls.filter((url) => !read().includes(url))]), []);
  const clear = useCallback(() => write([]), []);

  return { tracks, has, add, remove, toggle, move, addMany, clear };
}
