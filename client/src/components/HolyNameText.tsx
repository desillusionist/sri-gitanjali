import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "wouter";
import { LongPressTooltip } from "@/components/LongPressTooltip";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorHref, findAuthorById } from "@/lib/authors";
import { getHolyNameSegments, holyNameMapsUrl, type HolyName } from "@/lib/holyNames";

function HolyNameTrigger({ entry, children }: { entry: HolyName; children: ReactNode }) {
  const { copy } = useTranslation();
  const author = entry.authorId ? findAuthorById(entry.authorId) : undefined;
  const mapsUrl = holyNameMapsUrl(entry);
  return (
    <LongPressTooltip
      className={`holy-name-trigger is-${entry.kind}`}
      popupId={`holy-name-${entry.id}`}
      popupLabel={copy.song.holyNameLabel.replace("{name}", entry.name)}
      popupClassName="holy-name-popup"
      popup={(
        <>
          <span className="word-for-word-popup-source">{copy.song.holyNameKinds[entry.kind]}</span>
          <span className="word-for-word-popup-term">{entry.name}</span>
          <span className="holy-name-popup-about">{entry.about}</span>
          {(author || mapsUrl) && (
            <span className="holy-name-popup-links">
              {author && <Link href={authorHref(author)}>{copy.song.holyNamePage} →</Link>}
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} aria-hidden="true" />{copy.song.holyNameMap}<ExternalLink size={11} aria-hidden="true" /></a>}
            </span>
          )}
        </>
      )}
    >
      {children}
    </LongPressTooltip>
  );
}

/** Translation text with its personalities and holy places underlined, each with a short note. */
export function HolyNameText({ value, renderText = (text) => text }: { value: string; renderText?: (text: string, sourceOffset: number) => ReactNode }) {
  let offset = 0;
  return (
    <>
      {getHolyNameSegments(value).map((segment, index) => {
        const start = offset;
        offset += segment.text.length;
        const content = renderText(segment.text, start);
        return segment.entry
          ? <HolyNameTrigger key={`${index}-${segment.entry.id}`} entry={segment.entry}>{content}</HolyNameTrigger>
          : <span key={index}>{content}</span>;
      })}
    </>
  );
}
