import type { ReactNode } from "react";
import type { WordForWordEntry, WordForWordSource } from "@/lib/wordForWordGlossary";
import { useTranslation } from "@/i18n/LanguageContext";
import { useWordForWord } from "@/lib/wordForWordLoader";
import { LongPressTooltip } from "@/components/LongPressTooltip";

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
  return (
    <LongPressTooltip
      className="word-for-word-trigger"
      popupId={`word-for-word-${entries[0]?.id ?? text.replace(/\W+/g, "-")}`}
      popupLabel={`Word-for-word meaning of ${tooltipText}`}
      popup={(
        <>
          <span className="word-for-word-popup-term">{tooltipText}</span>
          <span className="word-for-word-popup-meanings">
            {entries.map((entry) => <span key={entry.id}>{entry.meaning}</span>)}
          </span>
          {sourceLabel && <span className={`word-for-word-popup-source is-${source}`}>{sourceLabel}</span>}
        </>
      )}
    >
      {children}
    </LongPressTooltip>
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
