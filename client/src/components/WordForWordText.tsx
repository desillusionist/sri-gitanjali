import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { getWordForWordSegments, type WordForWordEntry } from "@/lib/wordForWordGlossary";

type WordForWordTriggerProps = {
  text: string;
  tooltipText?: string;
  entries: WordForWordEntry[];
  children: ReactNode;
};

function WordForWordTrigger({ text, tooltipText = text, entries, children }: WordForWordTriggerProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const popupId = `word-for-word-${entries[0]?.id ?? text.replace(/\W+/g, "-")}`;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
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

  useEffect(() => () => clearCloseTimer(), []);

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
        onMouseEnter={() => { clearCloseTimer(); setIsOpen(true); }}
        onMouseLeave={closeSoon}
        onFocus={() => { clearCloseTimer(); setIsOpen(true); }}
        onBlur={(event) => {
          const relatedElement = event.relatedTarget instanceof Element ? event.relatedTarget : null;
          if (!relatedElement?.closest(".word-for-word-popup")) closeSoon();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") {
            event.preventDefault();
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
  contextValue?: string;
  contextOffset?: number;
  renderText?: (value: string, sourceOffset: number) => ReactNode;
};

export function WordForWordText({ value, songTitle, verseNumber, contextValue, contextOffset, renderText = (text) => text }: WordForWordTextProps) {
  const segments = getWordForWordSegments(value, { songTitle, verseNumber, contextValue, contextOffset });
  let sourceOffset = 0;
  return (
    <>
      {segments.map((segment, index) => {
        const offset = sourceOffset;
        sourceOffset += segment.text.length;
        return segment.entries.length ? (
          <WordForWordTrigger key={`${segment.text}-${index}`} text={segment.text} tooltipText={segment.tooltipText} entries={segment.entries}>
            {renderText(segment.text, offset)}
          </WordForWordTrigger>
        ) : <span key={`${segment.text}-${index}`}>{renderText(segment.text, offset)}</span>;
      })}
    </>
  );
}
