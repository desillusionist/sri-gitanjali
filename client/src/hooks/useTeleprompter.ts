/**
 * Паломнический свиток: телесуфлёр прокручивает только собственную читательскую
 * поверхность, чтобы никакие внешние контейнеры страницы не прерывали ритм чтения.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const navigationKeys = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

export function useTeleprompter(
  enabled: boolean,
  speed: number,
  scrollContainerRef: RefObject<HTMLElement | null>,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const speedRef = useRef(speed);
  const targetScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const pause = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastFrameTimeRef.current = null;
    targetScrollTopRef.current = null;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!enabled || !scrollContainer) return;

    setIsPlaying((current) => {
      if (current) return false;

      const scrollEnd = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      if (scrollContainer.scrollTop >= scrollEnd - 1) scrollContainer.scrollTop = 0;
      targetScrollTopRef.current = scrollContainer.scrollTop;
      return true;
    });
  }, [enabled, scrollContainerRef]);

  useEffect(() => {
    if (!enabled) pause();
  }, [enabled, pause]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!isPlaying || !enabled || !scrollContainer) return;

    targetScrollTopRef.current ??= scrollContainer.scrollTop;

    const moveReader = (timestamp: number) => {
      const previousTime = lastFrameTimeRef.current ?? timestamp;
      const elapsed = Math.min(timestamp - previousTime, 100);
      lastFrameTimeRef.current = timestamp;

      const scrollEnd = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const currentTarget = targetScrollTopRef.current ?? scrollContainer.scrollTop;
      if (currentTarget >= scrollEnd - 0.1) {
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        targetScrollTopRef.current = null;
        setIsPlaying(false);
        return;
      }

      // DOM scroll positions may be rounded to integers. Preserve the fractional
      // target between frames so slower speeds still visibly advance the reader.
      const nextTarget = Math.min(scrollEnd, currentTarget + (speedRef.current * elapsed) / 1000);
      targetScrollTopRef.current = nextTarget;
      scrollContainer.scrollTop = nextTarget;
      frameRef.current = window.requestAnimationFrame(moveReader);
    };

    frameRef.current = window.requestAnimationFrame(moveReader);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
      targetScrollTopRef.current = null;
    };
  }, [enabled, isPlaying, scrollContainerRef]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!isPlaying || !scrollContainer) return;

    const pauseForManualInput = () => pause();
    const pauseForKeyboardNavigation = (event: KeyboardEvent) => {
      if (navigationKeys.has(event.key)) pause();
    };
    const pauseForHiddenDocument = () => {
      if (document.hidden) pause();
    };

    scrollContainer.addEventListener("wheel", pauseForManualInput, { passive: true });
    scrollContainer.addEventListener("touchstart", pauseForManualInput, { passive: true });
    scrollContainer.addEventListener("pointerdown", pauseForManualInput, { passive: true });
    window.addEventListener("keydown", pauseForKeyboardNavigation);
    document.addEventListener("visibilitychange", pauseForHiddenDocument);

    return () => {
      scrollContainer.removeEventListener("wheel", pauseForManualInput);
      scrollContainer.removeEventListener("touchstart", pauseForManualInput);
      scrollContainer.removeEventListener("pointerdown", pauseForManualInput);
      window.removeEventListener("keydown", pauseForKeyboardNavigation);
      document.removeEventListener("visibilitychange", pauseForHiddenDocument);
    };
  }, [isPlaying, pause, scrollContainerRef]);

  return { isPlaying, pause, toggle };
}
