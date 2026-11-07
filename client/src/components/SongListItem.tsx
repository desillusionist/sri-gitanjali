/**
 * Паломнический свиток: строка песни сохраняет ритм каталога и даёт тихий,
 * всегда доступный жест для сохранения на личную полку и заметный счётчик
 * доступных аудиоверсий без нарушения спокойного ритма листа.
 */

import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getHighlightParts, getSongSearchExcerpt, getSongSearchMatches, getSoundCloudRecordingCount, normalizeSearchText, songFirstLine, type SecondaryTranslationLookup, type Song } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { Bookmark, BookmarkCheck, ChevronRight, Volume2 } from "lucide-react";
import { Link } from "wouter";
import { getSongLanguage, SONG_LANGUAGES } from "@/lib/songLanguages";

function HighlightedText({ value, query }: { value: string; query: string }) {
  return getHighlightParts(value, query).map((part, index) =>
    part.isMatch ? <mark className="search-highlight" key={`${part.text}-${index}`}>{part.text}</mark> : <span key={`${part.text}-${index}`}>{part.text}</span>,
  );
}

type SongListItemProps = {
  song: Song;
  query?: string;
  variant?: "default" | "opening-line";
  /** Second translation the search also looks in, and its language for labelling excerpts. */
  secondary?: SecondaryTranslationLookup;
  secondaryLanguage?: { code: string; lang: string; label: string } | null;
};

export function SongListItem({ song, query = "", variant = "default", secondary, secondaryLanguage }: SongListItemProps) {
  const { isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const favorite = isFavorite(song.id);
  const language = getSongLanguage(song.id);
  const languageInfo = language ? SONG_LANGUAGES[language] : undefined;
  const hasTextQuery = Boolean(normalizeSearchText(query));
  const excerpt = hasTextQuery ? getSongSearchExcerpt(song, query, secondary) : null;
  const matchCount = hasTextQuery ? getSongSearchMatches(song, query, secondary).length : 0;
  const recordingCount = getSoundCloudRecordingCount(song);
  const recordingCountLabel = (recordingCount === 1 ? copy.library.audioRecordingCountOne : copy.library.audioRecordingCountMany).replace("{count}", String(recordingCount));

  return (
    <div className={`song-row ${favorite ? "is-favorite" : ""} ${excerpt ? "has-search-excerpt" : ""}`}>
      <Link href={`/song/${song.id}${hasTextQuery ? `?q=${encodeURIComponent(query.trim())}` : ""}`} className="song-row-link">
        {languageInfo ? (
          <span className={`song-row-seal is-${language}`} lang={languageInfo.lang} title={copy.song.composedIn.replace("{language}", languageInfo.english)}>
            <span aria-hidden="true">{languageInfo.seal}</span>
            <span className="sr-only">{languageInfo.english}</span>
          </span>
        ) : <span className="song-row-ornament" aria-hidden="true" />}
        <span className="song-row-copy">
          {variant === "opening-line" ? (
            <>
              <strong><HighlightedText value={songFirstLine(song)} query={query} /></strong>
              <small className="song-row-meta"><HighlightedText value={song.title} query={query} /> · <HighlightedText value={song.poet || copy.library.noAuthor} query={query} />{languageInfo && <span className="song-row-language"> · {languageInfo.english}</span>}</small>
            </>
          ) : (
            <>
              <strong><HighlightedText value={song.title} query={query} /></strong>
              <small className="song-row-meta"><HighlightedText value={song.poet || copy.library.noAuthor} query={query} />{languageInfo && <span className="song-row-language"> · {languageInfo.english}</span>}</small>
              <span className="song-row-opening-line"><HighlightedText value={songFirstLine(song)} query={query} /></span>
            </>
          )}
          {excerpt && (
            <span className="song-search-excerpt" lang={excerpt.source === "secondaryTranslation" ? secondaryLanguage?.lang : undefined}>
              <span aria-hidden="true">↳</span>
              {excerpt.source === "secondaryTranslation" && secondaryLanguage && <abbr className="song-search-excerpt-language" title={secondaryLanguage.label} lang="en">{secondaryLanguage.code.toUpperCase()}</abbr>}
              <HighlightedText value={excerpt.text} query={query} />
            </span>
          )}
        </span>
        {recordingCount > 0 && <span className="song-audio-badge" aria-label={recordingCountLabel}><Volume2 size={14} aria-hidden="true" /><span>{recordingCount}</span></span>}
        {matchCount > 0 && <span className="song-match-count" aria-label={copy.library.matchCountLabel.replace("{count}", String(matchCount))}>{copy.library.matchCountLabel.replace("{count}", String(matchCount))}</span>}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
      <button
        className="row-favorite-button"
        type="button"
        aria-label={favorite ? copy.song.removeFavorite : copy.song.addFavorite}
        aria-pressed={favorite}
        onClick={() => toggleFavorite(song.id)}
      >
        {favorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      </button>
    </div>
  );
}
