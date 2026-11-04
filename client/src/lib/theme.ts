import { useSyncExternalStore } from "react";

/**
 * Colour themes. Each one swaps only the palette (see :root[data-theme] in
 * index.css); fonts stay the same. The choice is remembered on this device.
 */
export const THEMES = ["saffron", "tulasi", "arati", "plain"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "kirtan-guide.theme";
// Browser and installed-app chrome colour for each theme.
const THEME_COLORS: Record<Theme, string> = { saffron: "#D96D32", tulasi: "#2F6A3E", arati: "#14181B", plain: "#FFFFFF" };
const listeners = new Set<() => void>();

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored as Theme) ? (stored as Theme) : "saffron";
  } catch {
    return "saffron";
  }
}

let current: Theme = typeof window === "undefined" ? "saffron" : readStoredTheme();

/** Applies a theme to the page; call once at start-up and on every change. */
export function applyTheme(theme: Theme) {
  current = theme;
  const root = document.documentElement;
  if (theme === "saffron") delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  listeners.forEach((listener) => listener());
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(current);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => "saffron",
  );
}
