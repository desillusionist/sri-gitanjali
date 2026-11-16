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
  setVolume: (volume: number) => void;
  getPosition: (callback: (milliseconds: number) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
  getCurrentSound: (callback: (sound: SoundCloudSound | null) => void) => void;
};

/** The parts of the widget's sound object the app reads. */
export type SoundCloudSound = {
  permalink_url?: string;
  waveform_url?: string;
  duration?: number;
  full_duration?: number;
  title?: string;
  user?: { permalink?: string; username?: string };
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
 * Keeps a player to one part of its track (see soundCloudSegment). `prepare()` moves a paused
 * player to the part's start, so that playing needs no jump (on iPhones a jump right as playing
 * starts can stop the sound). Playing from outside the part jumps to its start, checked against the
 * position the player reports until it is there; `onProgress` says when playing has just crossed
 * the part's end, and `rewind()` then readies the part to play again. While a new track loads
 * (`hold()` until `reset()`), the old track's late events are ignored.
 */
export function createSegmentFollower(widget: SoundCloudWidget) {
  let isHeld = false;
  let needsStart = true;
  let lastPosition = 0;
  const startAt = (segment: Segment) => (segment?.start ?? 0) * 1000;
  const endAt = (segment: Segment) => (segment?.end == null ? null : segment.end * 1000);
  const isOutside = (segment: Segment, position: number) => {
    const end = endAt(segment);
    return position < startAt(segment) - 1500 || (end !== null && position >= end - 250);
  };
  return {
    hold() {
      isHeld = true;
    },
    reset() {
      isHeld = false;
      needsStart = true;
      lastPosition = 0;
    },
    prepare(segment: Segment) {
      if (!isHeld && segment && startAt(segment)) widget.seekTo(startAt(segment));
    },
    rewind(segment: Segment) {
      needsStart = true;
      lastPosition = 0;
      if (segment) widget.seekTo(startAt(segment));
    },
    onPlay(segment: Segment) {
      if (isHeld || !segment) return;
      widget.getPosition((position) => {
        if (!isHeld && Number.isFinite(position) && isOutside(segment, position)) widget.seekTo(startAt(segment));
      });
    },
    /** True once, when the position passes the part's end. */
    onProgress(segment: Segment, position: number | undefined) {
      if (isHeld || position === undefined) return false;
      const end = endAt(segment);
      if (needsStart) {
        // Not in the part yet (the jump is still on its way, or was missed): ask again.
        if (segment && isOutside(segment, position)) {
          widget.seekTo(startAt(segment));
          return false;
        }
        needsStart = false;
        lastPosition = position;
      }
      const crossed = end !== null && lastPosition < end && position >= end;
      lastPosition = position;
      if (crossed) needsStart = true;
      return crossed;
    },
  };
}

/** Phones and tablets, where a player needs priming (see primeSoundCloudWidget). */
export const needsSoundCloudPriming = () => typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

/**
 * Readies a freshly loaded player so that the reader's first tap plays. On iPhones a tap reaches
 * SoundCloud's frame as permission to play only for a moment, and the first play spends that
 * moment fetching the sound, so it starts and stops at once. Playing it silently first fetches
 * the sound; then it is paused at `startMs`, its volume back. Resolves when done (at most ~3 s).
 */
export function primeSoundCloudWidget(widget: SoundCloudWidget, startMs: number): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    let firstPosition: number | null = null;
    const startedAt = Date.now();
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      widget.pause();
      widget.seekTo(startMs);
      widget.setVolume(100);
      resolve();
    };
    widget.setVolume(0);
    widget.play();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > 3000) return finish();
      // Done once the sound is really moving: fetched and playing.
      widget.getPosition((position) => {
        if (!Number.isFinite(position)) return;
        firstPosition ??= position;
        if (position > firstPosition + 100) finish();
      });
    }, 150);
  });
}

/**
 * The widget for an iframe, made safe to call at any time: once its iframe has left the page
 * (React replaced it, or the dialog closed), calls do nothing instead of throwing from
 * SoundCloud's script, which would bring down the whole page.
 */
export function createSoundCloudWidget(api: SoundCloudWidgetApi, iframe: HTMLIFrameElement): SoundCloudWidget {
  const raw = api.Widget(iframe);
  const guard = <A extends unknown[]>(call: (...args: A) => void) => (...args: A) => {
    if (!iframe.isConnected || !iframe.contentWindow) return;
    try {
      call(...args);
    } catch {
      // The player went away between the check and the call.
    }
  };
  return {
    bind: guard(raw.bind.bind(raw)),
    unbind: guard(raw.unbind.bind(raw)),
    getDuration: guard(raw.getDuration.bind(raw)),
    load: guard(raw.load.bind(raw)),
    play: guard(raw.play.bind(raw)),
    pause: guard(raw.pause.bind(raw)),
    toggle: guard(raw.toggle.bind(raw)),
    seekTo: guard(raw.seekTo.bind(raw)),
    setVolume: guard(raw.setVolume.bind(raw)),
    getPosition: guard(raw.getPosition.bind(raw)),
    isPaused: guard(raw.isPaused.bind(raw)),
    getCurrentSound: guard(raw.getCurrentSound.bind(raw)),
  };
}

/**
 * The widget address for any SoundCloud track link, short "on.soundcloud.com" links included:
 * SoundCloud's oEmbed resolves it. Null when SoundCloud does not know the link or forbids embedding.
 */
export async function resolveSoundCloudPlayerSrc(link: string): Promise<{ src: string; title: string } | null> {
  const response = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(link.trim())}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { html?: string; title?: string };
  const match = payload.html?.match(/src="([^"]+)"/i);
  if (!match) return null;
  const embedded = new URL(match[1].replaceAll("&amp;", "&"));
  const trackUrl = embedded.searchParams.get("url");
  return trackUrl ? { src: soundCloudPlayerSrc(trackUrl), title: payload.title ?? "" } : null;
}

/**
 * Loads a track in a hidden player and reads it: its proper soundcloud.com address, account, title
 * and length. For links pasted in the admin tools.
 */
export async function inspectSoundCloudTrack(link: string): Promise<{ url: string; account: string; title: string; seconds: number } | null> {
  const resolved = await resolveSoundCloudPlayerSrc(link);
  if (!resolved) return null;
  const api = await loadSoundCloudWidgetApi();
  const iframe = document.createElement("iframe");
  iframe.src = resolved.src;
  iframe.title = "";
  iframe.setAttribute("aria-hidden", "true");
  iframe.className = "soundcloud-player is-duration-probe";
  document.body.append(iframe);
  try {
    const sound = await new Promise<SoundCloudSound | null>((resolve) => {
      const widget = createSoundCloudWidget(api, iframe);
      const timer = window.setTimeout(() => resolve(null), 15_000);
      widget.bind(api.Widget.Events.READY, () => widget.getCurrentSound((value) => {
        window.clearTimeout(timer);
        resolve(value);
      }));
    });
    if (!sound?.permalink_url) return null;
    const url = sound.permalink_url.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^http:/, "https:");
    const account = new URL(url).pathname.split("/")[1] ?? "";
    return { url, account, title: sound.title ?? resolved.title, seconds: Math.round((sound.full_duration ?? sound.duration ?? 0) / 1000) };
  } finally {
    iframe.remove();
  }
}

const waveforms = new Map<string, Promise<number[] | null>>();

/** A track's waveform (SoundCloud's own samples, 0–1), once per page. */
export function loadSoundCloudWaveform(waveformUrl: string): Promise<number[] | null> {
  let promise = waveforms.get(waveformUrl);
  if (!promise) {
    promise = fetch(waveformUrl)
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { height?: number; samples?: number[] };
        const height = data.height || Math.max(1, ...(data.samples ?? []));
        return data.samples?.length ? data.samples.map((sample) => sample / height) : null;
      })
      .catch(() => null);
    waveforms.set(waveformUrl, promise);
  }
  return promise;
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
