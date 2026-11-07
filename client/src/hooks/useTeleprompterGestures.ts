import { useEffect, useRef, type RefObject } from "react";

type TeleprompterGestureHandlers = {
  /** Horizontal swipe: -1 = previous (swipe right), 1 = next (swipe left). */
  onSwipe?: (direction: -1 | 1) => void;
  /** Two-finger pinch: the scale relative to when the fingers touched down. */
  onPinchStart?: () => void;
  onPinch?: (ratio: number) => void;
};

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_MS = 700;

/**
 * Touch gestures over the teleprompter: a pinch scales the lyrics and a horizontal swipe turns
 * the verse. Vertical drags are left to the browser so the lyrics still scroll by hand.
 */
export function useTeleprompterGestures(enabled: boolean, targetRef: RefObject<HTMLElement | null>, handlers: TeleprompterGestureHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return;

    let pinchStartDistance: number | null = null;
    let wasPinching = false;
    let swipeStart: { x: number; y: number; time: number } | null = null;

    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchStartDistance = distance(event.touches);
        wasPinching = true;
        swipeStart = null;
        handlersRef.current.onPinchStart?.();
      } else if (event.touches.length === 1) {
        wasPinching = false;
        const touch = event.touches[0];
        swipeStart = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchStartDistance === null) return;
      // Keep the browser from zooming the whole page instead.
      event.preventDefault();
      handlersRef.current.onPinch?.(distance(event.touches) / Math.max(1, pinchStartDistance));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchStartDistance = null;
      if (!swipeStart || wasPinching || event.touches.length > 0) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - swipeStart.x;
      const dy = touch.clientY - swipeStart.y;
      const elapsed = event.timeStamp - swipeStart.time;
      swipeStart = null;
      if (Math.abs(dx) >= SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5 && elapsed <= SWIPE_MAX_MS) {
        handlersRef.current.onSwipe?.(dx < 0 ? 1 : -1);
      }
    };

    // Safari's own pinch-zoom gesture.
    const preventGesture = (event: Event) => event.preventDefault();

    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: false });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", onTouchEnd, { passive: true });
    target.addEventListener("gesturestart", preventGesture);
    target.addEventListener("gesturechange", preventGesture);
    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
      target.removeEventListener("gesturestart", preventGesture);
      target.removeEventListener("gesturechange", preventGesture);
    };
  }, [enabled, targetRef]);
}
