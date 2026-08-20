/**
 * Паломнический свиток: личная полка — короткий, спокойный маршрут к песням,
 * которые пользователь хочет открыть снова, без отдельного сервера или аккаунта.
 */

import { AppShell } from "@/components/AppShell";
import { SongListItem } from "@/components/SongListItem";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { BookmarkCheck, LibraryBig, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

function FavoritesContent() {
  const { songs, status, favoriteSongIds } = useSongLibrary();
  const { copy } = useTranslation();
  const favorites = useMemo(
    () => songs.filter((song) => favoriteSongIds.has(song.id)),
    [favoriteSongIds, songs],
  );

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>{copy.song.opening}</p>
      </section>
    );
  }

  return (
    <div className="favorites-page">
      <header className="favorites-header">
        <span className="eyebrow">{copy.favorites.eyebrow}</span>
        <h1>{copy.favorites.title}<br /><em>{copy.favorites.titleEmphasis}</em></h1>
        <p>{copy.favorites.lede}</p>
        <span className="mantra-line favorites-mantra" aria-hidden="true" />
        <div className="favorites-count">
          <BookmarkCheck size={18} />
          <strong>{favorites.length}</strong>
          <span>{copy.favorites.count}</span>
        </div>
      </header>

      {favorites.length ? (
        <section className="favorites-list-section" aria-labelledby="favorites-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{copy.favorites.eyebrow}</span>
              <h2 id="favorites-heading">{copy.favorites.sectionTitle}</h2>
            </div>
            <p>{copy.favorites.sectionDetail}</p>
          </div>
          <span className="mantra-line section-mantra" aria-hidden="true" />
          <div className="favorites-song-list">
            {favorites.map((song) => <SongListItem song={song} key={song.id} />)}
          </div>
        </section>
      ) : (
        <section className="favorites-empty">
          <LibraryBig size={23} aria-hidden="true" />
          <span className="eyebrow">{copy.favorites.emptyEyebrow}</span>
          <h2>{copy.favorites.emptyTitle}</h2>
          <p>{copy.favorites.emptyDetail}</p>
          <Link href="/" className="text-action">{copy.favorites.browseLibrary}</Link>
        </section>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return <AppShell><FavoritesContent /></AppShell>;
}
