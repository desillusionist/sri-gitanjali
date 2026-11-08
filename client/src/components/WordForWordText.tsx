import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { WordForWordEntry, WordForWordSource } from "@/lib/wordForWordGlossary";
import { useTranslation } from "@/i18n/LanguageContext";
import { useWordForWord } from "@/lib/wordForWordLoader";

const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;

type WordForWordTriggerProps = {
  text: string;
  tooltipText?: string;
  entries: WordForWordEntry[];
  source?: WordForWordSource;
  children: ReactNode;
};

function WordForWordTrigger({ text, tooltipText = text, entries, source, children }: WordForWordTriggerProps) {
  const { copy } = useTranslation();
  const sourceLabel = source === "reference" ? copy.song.wordForWordSourceReference : source === "editorial" ? copy.song.wordForWordSourceEditorial : source === "glossary" ? copy.song.wordForWordSourceGlossary : null;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const popupId = `word-for-word-${entries[0]?.id ?? text.replace(/\W+/g, "-")}`;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const longPressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
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
      const preferBelow = rect.bottom + 12 + 110 < window.innerHeight;
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
      if (!triggerRef.current?.contains(target) && !targetElement?.closest(".word-for-word-popup")) setIsOpen(false);
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

  return (
    <>
      <span
        ref={triggerRef}
        className="word-for-word-trigger"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popupId : undefined}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") { clearCloseTimer(); setIsOpen(true); } }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") closeSoon(); }}
        onFocus={(event) => {
          // Keyboard focus only: a tap also focuses the word, and that must not open it.
          if (!event.currentTarget.matches(":focus-visible")) return;
          clearCloseTimer();
          setIsOpen(true);
        }}
        onBlur={(event) => {
          const relatedElement = event.relatedTarget instanceof Element ? event.relatedTarget : null;
          if (!relatedElement?.closest(".word-for-word-popup")) closeSoon();
        }}
        onPointerDown={(event) => {
          // On touch the meaning opens only on a long press, so taps and scrolling leave it alone.
          if (event.pointerType !== "touch") return;
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
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={(event) => { if (suppressClickRef.current || longPressRef.current) event.preventDefault(); }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
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
          className="word-for-word-popup"
          role="dialog"
          aria-label={`Word-for-word meaning of ${tooltipText}`}
          style={popupStyle}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closeSoon}
        >
          <span className="word-for-word-popup-term">{tooltipText}</span>
          <span className="word-for-word-popup-meanings">
            {entries.map((entry) => <span key={entry.id}>{entry.meaning}</span>)}
          </span>
          {sourceLabel && <span className={`word-for-word-popup-source is-${source}`}>{sourceLabel}</span>}
        </aside>,
        document.body,
      )}
    </>
  );
}

type WordForWordTextProps = {
  value: string;
  songTitle?: string;
  verseNumber?: number;
  songId?: string;
  verseId?: string;
  contextValue?: string;
  contextOffset?: number;
  sourceContextValue?: string;
  renderText?: (value: string, sourceOffset: number) => ReactNode;
};

export function WordForWordText({ value, songTitle, verseNumber, songId, verseId, contextValue, contextOffset, sourceContextValue, renderText = (text) => text }: WordForWordTextProps) {
  const wordForWord = useWordForWord();
  const segments = wordForWord?.getWordForWordSegments(value, { songTitle, verseNumber, songId, verseId, contextValue, contextOffset, sourceContextValue }) ?? [{ text: value, entries: [] }];
  let sourceOffset = 0;
  return (
    <>
      {segments.map((segment, index) => {
        const offset = sourceOffset;
        sourceOffset += segment.text.length;
        return segment.entries.length ? (
          <WordForWordTrigger key={`${segment.text}-${index}`} text={segment.text} tooltipText={segment.tooltipText} entries={segment.entries} source={segment.source}>
            {renderText(segment.text, offset)}
          </WordForWordTrigger>
        ) : <span key={`${segment.text}-${index}`}>{renderText(segment.text, offset)}</span>;
      })}
    </>
  );
}
