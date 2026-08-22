/**
 * Паломнический свиток: строка песни сохраняет ритм каталога и даёт тихий,
 * всегда доступный жест для сохранения на личную полку.
 */

import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getHighlightParts, getSongSearchExcerpt, getSongSearchMatches, hasSoundCloudRecording, normalizeSearchText, songFirstLine, type Song } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { Bookmark, BookmarkCheck, ChevronRight, Volume2 } from "lucide-react";
import { Link } from "wouter";

function HighlightedText({ value, query }: { value: string; query: string }) {
  return getHighlightParts(value, query).map((part, index) =>
    part.isMatch ? <mark className="search-highlight" key={`${part.text}-${index}`}>{part.text}</mark> : <span key={`${part.text}-${index}`}>{part.text}</span>,
  );
}

type SongListItemProps = {
  song: Song;
  query?: string;
  variant?: "default" | "opening-line";
};

export function SongListItem({ song, query = "", variant = "default" }: SongListItemProps) {
  const { isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const favorite = isFavorite(song.id);
  const hasTextQuery = Boolean(normalizeSearchText(query));
  const excerpt = hasTextQuery ? getSongSearchExcerpt(song, query) : null;
  const matchCount = hasTextQuery ? getSongSearchMatches(song, query).length : 0;
  const hasRecording = hasSoundCloudRecording(song);

  return (
    <div className={`song-row ${favorite ? "is-favorite" : ""} ${excerpt ? "has-search-excerpt" : ""}`}>
      <Link href={`/song/${song.id}${hasTextQuery ? `?q=${encodeURIComponent(query.trim())}` : ""}`} className="song-row-link">
        <span className="song-row-ornament" aria-hidden="true" />
        <span className="song-row-copy">
          {variant === "opening-line" ? (
            <>
              <strong><HighlightedText value={songFirstLine(song)} query={query} /></strong>
              <small className="song-row-meta"><HighlightedText value={song.title} query={query} /> · <HighlightedText value={song.poet || copy.library.noAuthor} query={query} /></small>
            </>
          ) : (
            <>
              <strong><HighlightedText value={song.title} query={query} /></strong>
              <small className="song-row-meta"><HighlightedText value={song.poet || copy.library.noAuthor} query={query} /></small>
              <span className="song-row-opening-line"><HighlightedText value={songFirstLine(song)} query={query} /></span>
            </>
          )}
          {excerpt && <span className="song-search-excerpt"><span aria-hidden="true">↳</span><HighlightedText value={excerpt.text} query={query} /></span>}
        </span>
        {hasRecording && <span className="song-audio-badge" role="img" aria-label={copy.library.audioRecordingAvailable}><Volume2 size={14} aria-hidden="true" /></span>}
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
