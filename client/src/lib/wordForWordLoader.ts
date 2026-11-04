import { useEffect, useSyncExternalStore } from "react";

/**
 * The word-for-word glossary and verse links are a few megabytes of JSON, so
 * they live in their own chunk and load the first time a verse is shown.
 * Until then verses render as plain text; they gain their tooltips as soon as
 * the data arrives.
 */
type WordForWordModule = typeof import("./wordForWordGlossary");

let loaded: WordForWordModule | null = null;
let loading: Promise<WordForWordModule> | null = null;
const listeners = new Set<() => void>();

export function loadWordForWord(): Promise<WordForWordModule> {
  loading ??= import("./wordForWordGlossary").then((module) => {
    loaded = module;
    listeners.forEach((listener) => listener());
    return module;
  });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The glossary module once loaded, otherwise null (and loading starts). */
export function useWordForWord(): WordForWordModule | null {
  const module = useSyncExternalStore(subscribe, () => loaded, () => null);
  useEffect(() => {
    if (!loaded) void loadWordForWord().catch(() => { loading = null; });
  }, []);
  return module;
}
