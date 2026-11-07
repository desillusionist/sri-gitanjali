import { useEffect } from "react";

/**
 * Keeps the screen on while `active` is true (Screen Wake Lock API).
 * The browser drops the lock when the tab is hidden, so it is taken again on return.
 * Browsers without the API simply keep their usual sleep timer.
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    const wakeLock = typeof navigator !== "undefined" ? navigator.wakeLock : undefined;
    if (!active || !wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const next = await wakeLock.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // Denied (e.g. low battery or no user gesture yet); the screen may dim as usual.
      }
    };

    const onVisibilityChange = () => { void request(); };
    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [active]);
}
