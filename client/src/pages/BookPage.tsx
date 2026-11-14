/** A sacred book or poem: its note, and the songs in this songbook that come from it. */

import { LibraryBig } from "lucide-react";
import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { AppShell } from "@/components/AppShell";
import { SongListItem } from "@/components/SongListItem";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { HOLY_NAMES, type HolyName } from "@/lib/holyNames";
import { usePageMeta } from "@/lib/pageMeta";
import { bookSongIds } from "@/lib/songBooks";

function BookContent({ book }: { book: HolyName }) {
  const { copy } = useTranslation();
  const { songs, status } = useSongLibrary();
  usePageMeta(book.name, book.about);
  const bookSongs = useMemo(() => {
    const ids = bookSongIds(book.id);
    const byId = new Map(songs.map((song) => [song.id, song]));
    return ids.map((id) => byId.get(id)).filter((song): song is NonNullable<typeof song> => Boolean(song));
  }, [book, songs]);
  const count = bookSongs.length === 1 ? copy.author.songCountOne : copy.author.songCount.replace("{count}", String(bookSongs.length));

  return (
    <article className="author-page book-page">
      <header className="favorites-header">
        <span className="eyebrow">{copy.song.holyNameKinds.book}</span>
        <h1 translate="no">{book.name}</h1>
        <p>{book.about}</p>
      </header>
      <section className="author-songs" aria-labelledby="book-songs-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{count}</span>
            <h2 id="book-songs-heading">{copy.book.songsTitle}</h2>
          </div>
        </div>
        {status === "ready" ? (
          <div className="favorites-song-list">
            {bookSongs.map((song) => <SongListItem song={song} key={song.id} />)}
          </div>
        ) : <div className="paper-spinner" aria-hidden="true" />}
      </section>
    </article>
  );
}

export default function BookPage() {
  const [, params] = useRoute("/book/:id");
  const { copy } = useTranslation();
  const book = params ? HOLY_NAMES.find((entry) => entry.id === params.id && entry.kind === "book") : undefined;
  return (
    <AppShell>
      {book ? <BookContent book={book} /> : (
        <section className="favorites-empty author-page">
          <LibraryBig size={23} aria-hidden="true" />
          <h2>{copy.book.notFound}</h2>
          <Link href="/" className="text-action">{copy.author.backToLibrary}</Link>
        </section>
      )}
    </AppShell>
  );
}
