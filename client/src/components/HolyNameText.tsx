import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "wouter";
import { LongPressTooltip } from "@/components/LongPressTooltip";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorHref, findAuthorById } from "@/lib/authors";
import { getHolyNameSegments, holyNameMapsUrl, type HolyName, type HolyNameVariant } from "@/lib/holyNames";
import { holyNameNoteKey, useHolyNameLocale, type HolyNameLocale } from "@/lib/holyNamesI18n";
import { placeFootnotes, type Footnote } from "@/lib/footnotes";

function HolyNameTrigger({ entry, variant, locale, lang, children }: { entry: HolyName; variant?: HolyNameVariant; locale: HolyNameLocale | null; lang?: string; children: ReactNode }) {
  const { copy } = useTranslation();
  const author = entry.authorId ? findAuthorById(entry.authorId) : undefined;
  const mapsUrl = holyNameMapsUrl(entry);
  const note = locale?.entries[holyNameNoteKey(entry.id, variant?.key)];
  const name = note?.name ?? variant?.name ?? entry.name;
  return (
    <LongPressTooltip
      className={`holy-name-trigger is-${entry.kind}`}
      openOnHover={false}
      popupId={`holy-name-${entry.id}${variant ? `-${variant.key}` : ""}`}
      popupLabel={copy.song.holyNameLabel.replace("{name}", name)}
      popupClassName="holy-name-popup"
      popupLang={note ? lang : undefined}
      popup={(
        <>
          <span className="word-for-word-popup-source">{locale?.ui.kinds[entry.kind] ?? copy.song.holyNameKinds[entry.kind]}</span>
          <span className="word-for-word-popup-term" translate="no">{name}</span>
          <span className="holy-name-popup-about">{note?.about ?? variant?.about ?? entry.about}</span>
          {(author || mapsUrl) && (
            <span className="holy-name-popup-links">
              {author && <Link href={authorHref(author)}>{locale?.ui.page ?? copy.song.holyNamePage} →</Link>}
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} aria-hidden="true" />{locale?.ui.map ?? copy.song.holyNameMap}<ExternalLink size={11} aria-hidden="true" /></a>}
            </span>
          )}
        </>
      )}
    >
      {children}
    </LongPressTooltip>
  );
}

function FootnoteMarker({ id, text, lang }: { id: string; text: string; lang?: string }) {
  const { copy } = useTranslation();
  return (
    <LongPressTooltip
      className="footnote-marker"
      openOnHover={false}
      popupId={id}
      popupLabel={copy.song.footnote}
      popupClassName="footnote-popup"
      popupLang={lang}
      popup={(
        <>
          <span className="word-for-word-popup-source" lang="en">{copy.song.footnote}</span>
          <span className="footnote-popup-text">{text}</span>
        </>
      )}
    >
      <sup aria-label={copy.song.footnote}>*</sup>
    </LongPressTooltip>
  );
}

type HolyNameTextProps = {
  value: string;
  renderText?: (text: string, sourceOffset: number) => ReactNode;
  /** The language of this text (code and BCP 47 tag) when it is not English: its notes are shown in it. */
  noteLanguage?: { code: string; lang: string } | null;
  /** Footnotes to show as markers inside the text. */
  footnotes?: Footnote[];
  /** Unique prefix for the footnote pop-up ids. */
  footnoteId?: string;
};

/** Translation text with its personalities and holy places underlined, each with a short note. */
export function HolyNameText({ value, renderText = (text) => text, noteLanguage, footnotes = [], footnoteId = "footnote" }: HolyNameTextProps) {
  const locale = useHolyNameLocale(noteLanguage?.code);
  // The text is split at footnote markers; each piece keeps its offset in the whole text.
  const placed = placeFootnotes(value, footnotes);
  const pieces: { start: number; end: number; footnote?: string }[] = [];
  let cursor = 0;
  placed.forEach((note) => { pieces.push({ start: cursor, end: note.at, footnote: note.text }); cursor = note.at; });
  pieces.push({ start: cursor, end: value.length });

  return (
    <>
      {pieces.map((piece, pieceIndex) => {
        let offset = piece.start;
        return (
          <span key={`piece-${pieceIndex}`} className="translation-piece">
            {getHolyNameSegments(value.slice(piece.start, piece.end)).map((segment, index) => {
              const start = offset;
              offset += segment.text.length;
              const content = renderText(segment.text, start);
              return segment.entry
                ? <HolyNameTrigger key={`${index}-${segment.entry.id}`} entry={segment.entry} variant={segment.variant} locale={locale} lang={noteLanguage?.lang}>{content}</HolyNameTrigger>
                : <span key={index}>{content}</span>;
            })}
            {piece.footnote !== undefined && <FootnoteMarker id={`${footnoteId}-${pieceIndex}`} text={piece.footnote} lang={noteLanguage?.lang} />}
          </span>
        );
      })}
    </>
  );
}
