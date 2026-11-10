import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "wouter";
import { LongPressTooltip } from "@/components/LongPressTooltip";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorHref, findAuthorById } from "@/lib/authors";
import { getHolyNameSegments, holyNameMapsUrl, type HolyName } from "@/lib/holyNames";
import { useHolyNameLocale, type HolyNameLocale } from "@/lib/holyNamesI18n";

function HolyNameTrigger({ entry, locale, lang, children }: { entry: HolyName; locale: HolyNameLocale | null; lang?: string; children: ReactNode }) {
  const { copy } = useTranslation();
  const author = entry.authorId ? findAuthorById(entry.authorId) : undefined;
  const mapsUrl = holyNameMapsUrl(entry);
  const note = locale?.entries[entry.id];
  const name = note?.name ?? entry.name;
  return (
    <LongPressTooltip
      className={`holy-name-trigger is-${entry.kind}`}
      popupId={`holy-name-${entry.id}`}
      popupLabel={copy.song.holyNameLabel.replace("{name}", name)}
      popupClassName="holy-name-popup"
      popupLang={note ? lang : undefined}
      popup={(
        <>
          <span className="word-for-word-popup-source">{locale?.ui.kinds[entry.kind] ?? copy.song.holyNameKinds[entry.kind]}</span>
          <span className="word-for-word-popup-term" translate="no">{name}</span>
          <span className="holy-name-popup-about">{note?.about ?? entry.about}</span>
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

type HolyNameTextProps = {
  value: string;
  renderText?: (text: string, sourceOffset: number) => ReactNode;
  /** The reader's second language (code and BCP 47 tag): notes are shown in it when it has them. */
  noteLanguage?: { code: string; lang: string } | null;
};

/** Translation text with its personalities and holy places underlined, each with a short note. */
export function HolyNameText({ value, renderText = (text) => text, noteLanguage }: HolyNameTextProps) {
  const locale = useHolyNameLocale(noteLanguage?.code);
  let offset = 0;
  return (
    <>
      {getHolyNameSegments(value).map((segment, index) => {
        const start = offset;
        offset += segment.text.length;
        const content = renderText(segment.text, start);
        return segment.entry
          ? <HolyNameTrigger key={`${index}-${segment.entry.id}`} entry={segment.entry} locale={locale} lang={noteLanguage?.lang}>{content}</HolyNameTrigger>
          : <span key={index}>{content}</span>;
      })}
    </>
  );
}
