import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_SLOP = 30;
const SELECTING_CLASS = "is-text-selecting";
const POPUP_CLASS = "word-for-word-popup";

let lastTap: { time: number; x: number; y: number } | null = null;
let stopTextSelection: (() => void) | null = null;

const isTextSelecting = () => document.documentElement.classList.contains(SELECTING_CLASS);

/**
 * A double tap hands the text back to the phone: the word under the finger is selected and
 * the system's copy/look-up menu is available until the selection is cleared.
 */
function startTextSelection(trigger: HTMLElement) {
  stopTextSelection?.();
  const root = document.documentElement;
  root.classList.add(SELECTING_CLASS);
  let hadSelection = false;
  const onSelectionChange = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) hadSelection = true;
    else if (hadSelection) stop();
  };
  const timeout = window.setTimeout(() => { if (!hadSelection) stop(); }, 5000);
  function stop() {
    root.classList.remove(SELECTING_CLASS);
    document.removeEventListener("selectionchange", onSelectionChange);
    window.clearTimeout(timeout);
    if (stopTextSelection === stop) stopTextSelection = null;
  }
  stopTextSelection = stop;
  document.addEventListener("selectionchange", onSelectionChange);
  window.requestAnimationFrame(() => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(trigger);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

type LongPressTooltipProps = {
  /** Class of the inline trigger, e.g. "word-for-word-trigger" or "holy-name-trigger". */
  className: string;
  popupId: string;
  popupLabel: string;
  popupClassName?: string;
  popup: ReactNode;
  children: ReactNode;
  /** With a mouse, open on hover (default) or only on click; hover still highlights the text. */
  openOnHover?: boolean;
  /** Language of the pop-up text when it differs from the page. */
  popupLang?: string;
  /** Opens the pop-up while true, e.g. for the current search hit inside it; it closes again when this turns false. */
  isActive?: boolean;
};

/**
 * Inline text with a small pop-up: it opens on mouse hover or keyboard focus, and on touch screens
 * only on a long press, so taps and scrolling leave it alone. A double tap selects the text instead.
 */
export function LongPressTooltip({ className, popupId, popupLabel, popupClassName, popup, children, openOnHover = true, popupLang, isActive = false }: LongPressTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const longPressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
  const pointerTypeRef = useRef<string>("");
  const clearLongPress = () => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  };

  const closeSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 120);
  };

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxWidth = Math.min(340, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - maxWidth - 12));
      const preferBelow = rect.bottom + 12 + 140 < window.innerHeight;
      setPopupStyle({
        left,
        top: preferBelow ? rect.bottom + 10 : undefined,
        bottom: preferBelow ? undefined : window.innerHeight - rect.top + 10,
        maxWidth,
      });
    };
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      const targetElement = target instanceof Element ? target : null;
      if (!triggerRef.current?.contains(target) && !targetElement?.closest(`.${POPUP_CLASS}`)) setIsOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [isOpen]);

  useEffect(() => () => { clearCloseTimer(); clearLongPress(); }, []);

  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (isActive) setIsOpen(true);
    else if (wasActiveRef.current) setIsOpen(false);
    wasActiveRef.current = isActive;
  }, [isActive]);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        translate="no"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popupId : undefined}
        onPointerEnter={(event) => { if (openOnHover && event.pointerType === "mouse") { clearCloseTimer(); setIsOpen(true); } }}
        onPointerLeave={(event) => { if (openOnHover && event.pointerType === "mouse") closeSoon(); }}
        onFocus={(event) => {
          // Keyboard focus only: a tap also focuses the word, and that must not open it.
          if (!event.currentTarget.matches(":focus-visible")) return;
          clearCloseTimer();
          setIsOpen(true);
        }}
        onBlur={(event) => {
          const relatedElement = event.relatedTarget instanceof Element ? event.relatedTarget : null;
          if (!relatedElement?.closest(`.${POPUP_CLASS}`)) closeSoon();
        }}
        onPointerDown={(event) => {
          pointerTypeRef.current = event.pointerType;
          // On touch the pop-up opens only on a long press, so taps and scrolling leave it alone.
          if (event.pointerType !== "touch" || isTextSelecting()) return;
          clearLongPress();
          longPressRef.current = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => {
            longPressRef.current = null;
            clearCloseTimer();
            suppressClickRef.current = true;
            setIsOpen(true);
            navigator.vibrate?.(10);
          }, LONG_PRESS_MS) };
        }}
        onPointerMove={(event) => {
          const press = longPressRef.current;
          if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) clearLongPress();
        }}
        onPointerUp={(event) => {
          const wasTap = longPressRef.current !== null;
          clearLongPress();
          if (event.pointerType !== "touch" || !wasTap) return;
          const now = Date.now();
          if (lastTap && now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_SLOP) {
            lastTap = null;
            event.preventDefault();
            setIsOpen(false);
            startTextSelection(event.currentTarget);
          } else {
            lastTap = { time: now, x: event.clientX, y: event.clientY };
          }
        }}
        onPointerCancel={clearLongPress}
        onContextMenu={(event) => { if (!isTextSelecting() && (suppressClickRef.current || longPressRef.current)) event.preventDefault(); }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
            return;
          }
          // Click-only pop-ups: a mouse click opens or closes them.
          if (!openOnHover && pointerTypeRef.current === "mouse") {
            clearCloseTimer();
            setIsOpen((current) => !current);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((current) => !current);
          }
        }}
      >
        {children}
      </span>
      {isOpen && typeof document !== "undefined" && createPortal(
        <aside
          id={popupId}
          className={`${POPUP_CLASS}${popupClassName ? ` ${popupClassName}` : ""}`}
          role="dialog"
          lang={popupLang}
          aria-label={popupLabel}
          style={popupStyle}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closeSoon}
        >
          {popup}
        </aside>,
        document.body,
      )}
    </>
  );
}
