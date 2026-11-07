/**
 * SoundCloud duration bridge: the official Widget API is loaded only when a
 * reader opens a teleprompter or player for a linked recording.
 */

export type SoundCloudWidget = {
  bind: (eventName: string, listener: () => void) => void;
  unbind: (eventName: string) => void;
  getDuration: (callback: (durationMs: number) => void) => void;
  load: (url: string, options?: Record<string, unknown> & { callback?: () => void }) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
};

type SoundCloudWidgetApi = {
  Widget: ((iframe: HTMLIFrameElement | string) => SoundCloudWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
    };
  };
};

/** Player options shared by every embedded player in the app. */
export const SOUNDCLOUD_PLAYER_OPTIONS = {
  hide_related: "true",
  show_comments: "false",
  show_reposts: "false",
  show_teaser: "false",
  visual: "false",
  color: "#b85e32",
} as const;

/**
 * The same options for `widget.load()`, which needs real booleans: given the strings the URL uses,
 * it treats "false" as set and swaps in the tall artwork player.
 */
export const SOUNDCLOUD_LOAD_OPTIONS = {
  hide_related: true,
  show_comments: false,
  show_reposts: false,
  show_teaser: false,
  visual: false,
  color: SOUNDCLOUD_PLAYER_OPTIONS.color,
} as const;

/** Widget address for a soundcloud.com track page (the widget resolves page URLs itself). */
export function soundCloudPlayerSrc(trackUrl: string, autoPlay = false): string {
  const src = new URL("https://w.soundcloud.com/player/");
  src.searchParams.set("url", trackUrl);
  for (const [key, value] of Object.entries(SOUNDCLOUD_PLAYER_OPTIONS)) src.searchParams.set(key, value);
  src.searchParams.set("auto_play", String(autoPlay));
  return src.toString();
}

declare global {
  interface Window {
    SC?: SoundCloudWidgetApi;
  }
}

const WIDGET_SCRIPT_URL = "https://w.soundcloud.com/player/api.js";
let widgetApiPromise: Promise<SoundCloudWidgetApi> | null = null;

export function loadSoundCloudWidgetApi(): Promise<SoundCloudWidgetApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("SoundCloud Widget API requires a browser."));
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (widgetApiPromise) return widgetApiPromise;

  widgetApiPromise = new Promise((resolve, reject) => {
    const resolveApi = () => window.SC?.Widget ? resolve(window.SC) : reject(new Error("SoundCloud Widget API did not initialise."));
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-kirtan-soundcloud-widget="true"]');

    if (existingScript) {
      existingScript.addEventListener("load", resolveApi, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("SoundCloud Widget API could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.dataset.kirtanSoundcloudWidget = "true";
    script.addEventListener("load", resolveApi, { once: true });
    script.addEventListener("error", () => reject(new Error("SoundCloud Widget API could not be loaded.")), { once: true });
    document.head.append(script);
  });

  return widgetApiPromise;
}
