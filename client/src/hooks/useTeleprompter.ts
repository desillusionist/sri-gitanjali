/**
 * Паломнический свиток: автопрокрутка поддерживает спокойное, непрерывное чтение
 * и мгновенно уступает управление читателю при ручном взаимодействии.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const navigationKeys = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

function isTeleprompterControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("[data-teleprompter-controls]"));
}

export function useTeleprompter(enabled: boolean, speed: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const pause = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastFrameTimeRef.current = null;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (!enabled) return;
    const pageEnd = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (window.scrollY >= pageEnd - 1) return;
    setIsPlaying((current) => !current);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) pause();
  }, [enabled, pause]);

  useEffect(() => {
    if (!isPlaying) return;

    const movePage = (timestamp: number) => {
      const previousTime = lastFrameTimeRef.current ?? timestamp;
      const elapsed = Math.min(timestamp - previousTime, 100);
      lastFrameTimeRef.current = timestamp;

      const pageEnd = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (window.scrollY >= pageEnd - 1) {
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        setIsPlaying(false);
        return;
      }

      window.scrollBy(0, (speedRef.current * elapsed) / 1000);
      frameRef.current = window.requestAnimationFrame(movePage);
    };

    frameRef.current = window.requestAnimationFrame(movePage);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    const pauseForManualInput = (event: Event) => {
      if (!isTeleprompterControl(event.target)) pause();
    };
    const pauseForKeyboardNavigation = (event: KeyboardEvent) => {
      if (navigationKeys.has(event.key)) pause();
    };
    const pauseForHiddenDocument = () => {
      if (document.hidden) pause();
    };

    window.addEventListener("wheel", pauseForManualInput, { passive: true });
    window.addEventListener("touchstart", pauseForManualInput, { passive: true });
    window.addEventListener("pointerdown", pauseForManualInput, { passive: true });
    window.addEventListener("keydown", pauseForKeyboardNavigation);
    document.addEventListener("visibilitychange", pauseForHiddenDocument);

    return () => {
      window.removeEventListener("wheel", pauseForManualInput);
      window.removeEventListener("touchstart", pauseForManualInput);
      window.removeEventListener("pointerdown", pauseForManualInput);
      window.removeEventListener("keydown", pauseForKeyboardNavigation);
      document.removeEventListener("visibilitychange", pauseForHiddenDocument);
    };
  }, [isPlaying, pause]);

  return { isPlaying, pause, toggle };
}
