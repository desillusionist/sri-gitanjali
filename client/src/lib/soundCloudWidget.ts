/**
 * SoundCloud duration bridge: the official Widget API is loaded only when a
 * reader opens a teleprompter or player for a linked recording.
 */

export type SoundCloudWidget = {
  bind: (eventName: string, listener: (event?: { currentPosition?: number }) => void) => void;
  unbind: (eventName: string) => void;
  getDuration: (callback: (durationMs: number) => void) => void;
  load: (url: string, options?: Record<string, unknown> & { callback?: () => void }) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (milliseconds: number) => void;
};

type SoundCloudWidgetApi = {
  Widget: ((iframe: HTMLIFrameElement | string) => SoundCloudWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PLAY_PROGRESS: string;
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
  // A part marker (#t=…) is for the app; the player loads the whole track.
  src.searchParams.set("url", trackUrl.replace(/#.*$/, ""));
  for (const [key, value] of Object.entries(SOUNDCLOUD_PLAYER_OPTIONS)) src.searchParams.set(key, value);
  src.searchParams.set("auto_play", String(autoPlay));
  return src.toString();
}

type Segment = { start: number; end: number | null } | null;

/**
 * Keeps a player to one part of its track (see soundCloudSegment). After `reset()` playing jumps to
 * the part's start, checked against the position the player reports until it is there; `onProgress`
 * says when playing has just crossed the part's end. While a new track loads (`hold()` until
 * `reset()`), the old track's late events are ignored.
 */
export function createSegmentFollower(widget: SoundCloudWidget) {
  let isHeld = false;
  let needsStart = true;
  let lastPosition = 0;
  const startAt = (segment: Segment) => (segment?.start ?? 0) * 1000;
  return {
    hold() {
      isHeld = true;
    },
    reset() {
      isHeld = false;
      needsStart = true;
      lastPosition = 0;
    },
    onPlay(segment: Segment) {
      if (!isHeld && needsStart && startAt(segment)) widget.seekTo(startAt(segment));
    },
    /** True once, when the position passes the part's end. */
    onProgress(segment: Segment, position: number | undefined) {
      if (isHeld || position === undefined) return false;
      if (needsStart) {
        // Not at the start yet (the jump is still on its way, or was missed): ask again.
        if (position < startAt(segment) - 1500) {
          widget.seekTo(startAt(segment));
          return false;
        }
        needsStart = false;
      }
      const end = segment?.end == null ? null : segment.end * 1000;
      const crossed = end !== null && lastPosition < end && position >= end;
      lastPosition = position;
      return crossed;
    },
  };
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
