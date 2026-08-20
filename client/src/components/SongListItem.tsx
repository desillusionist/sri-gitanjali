/**
 * Паломнический свиток: строка песни сохраняет ритм каталога и даёт тихий,
 * всегда доступный жест для сохранения на личную полку.
 */

import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { songFirstLine, type Song } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { Bookmark, BookmarkCheck, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export function SongListItem({ song }: { song: Song }) {
  const { isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const favorite = isFavorite(song.id);

  return (
    <div className={`song-row ${favorite ? "is-favorite" : ""}`}>
      <Link href={`/song/${song.id}`} className="song-row-link">
        <span className="song-row-ornament" aria-hidden="true" />
        <span className="song-row-copy">
          <strong>{song.title}</strong>
          <small>{song.poet || copy.library.noAuthor} · {songFirstLine(song)}</small>
        </span>
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
