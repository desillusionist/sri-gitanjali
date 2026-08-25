/**
 * SoundCloud duration bridge: the official Widget API is loaded only when a
 * reader opens a teleprompter or player for a linked recording.
 */

type SoundCloudWidget = {
  bind: (eventName: string, listener: () => void) => void;
  getDuration: (callback: (durationMs: number) => void) => void;
};

type SoundCloudWidgetApi = {
  Widget: ((iframe: HTMLIFrameElement | string) => SoundCloudWidget) & {
    Events: {
      READY: string;
    };
  };
};

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
