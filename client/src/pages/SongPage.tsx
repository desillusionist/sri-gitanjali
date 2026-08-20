/**
 * Паломнический свиток: страница песни строится как развёрнутый лист,
 * где текст и ритм куплетов остаются главным визуальным объектом.
 */

import { AppShell } from "@/components/AppShell";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { songFirstLine } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Copy, Music2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

function SongPageContent() {
  const [, params] = useRoute("/song/:id");
  const { songs, status, isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const song = songs.find((item) => item.id === params?.id);
  const index = song ? songs.findIndex((item) => item.id === song.id) : -1;
  const previous = index > 0 ? songs[index - 1] : null;
  const next = index >= 0 && index < songs.length - 1 ? songs[index + 1] : null;

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>{copy.song.opening}</p>
      </section>
    );
  }

  if (!song) {
    return (
      <section className="not-found-panel">
        <span className="eyebrow">{copy.song.notFoundEyebrow}</span>
        <h1>{copy.song.notFoundTitle}</h1>
        <Link href="/" className="text-action"><ArrowLeft size={16} /> {copy.song.backToLibrary}</Link>
      </section>
    );
  }

  const copySong = async () => {
    const plainText = [
      song.title,
      song.poet ?? "",
      "",
      ...song.verses.flatMap((verse) => [
        `(${verse.originalVerseNumber})`,
        ...verse.lines.map((line) => line.transliteration),
        verse.translation,
        "",
      ]),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(plainText);
      toast.success(copy.song.copied);
    } catch {
      toast.error(copy.song.copyFailed);
    }
  };

  const favorite = isFavorite(song.id);
  const toggleSongFavorite = () => {
    toggleFavorite(song.id);
    toast.success(favorite ? copy.song.removedFavorite : copy.song.addedFavorite);
  };

  return (
    <div className="song-page">
      <div className="song-toolbar">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> {copy.song.backToLibrary}</Link>
        <div className="song-toolbar-actions">
          <button className="quiet-icon-button" type="button" onClick={copySong} aria-label={copy.song.copyLabel}>
            <Copy size={17} />
          </button>
          <button className={`quiet-icon-button ${favorite ? "is-favorite" : ""}`} type="button" onClick={toggleSongFavorite} aria-label={favorite ? copy.song.removeFavorite : copy.song.addFavorite} aria-pressed={favorite}>
            {favorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        </div>
      </div>

      <article className="song-sheet">
          <div className="song-sheet-intro">
          <div>
            <span className="eyebrow">{song.category}</span>
            <h1>{song.title}</h1>
            <p className="song-poet">{song.poet || copy.library.noAuthor}</p>
          </div>
          <div className="song-insight">
            <Music2 size={19} />
            <span>{song.verses.length} {song.verses.length === 1 ? copy.song.verse : copy.song.verses}</span>
          </div>
          <span className="mantra-line song-sheet-mantra" aria-hidden="true" />
        </div>

        {song.comment && <p className="song-comment">{song.comment}</p>}

        <div className="song-verses">
          {song.verses.map((verse, verseIndex) => (
            <section className="verse-block" id={verse.id} key={verse.id}>
              <div className="verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>
                {String(verseIndex + 1).padStart(2, "0")}
              </div>
              <div className="verse-copy">
                {verse.lines.map((line) => (
                  <p className={`transliteration ${line.isIndented ? "is-indented" : ""}`} key={line.id}>
                    {line.transliteration}
                  </p>
                ))}
                {verse.translation && <p className="translation">{verse.translation}</p>}
              </div>
            </section>
          ))}
        </div>

        <div className="song-sheet-footer">
          <p>{copy.song.initialLine} <em>{songFirstLine(song)}</em></p>
          <p>{copy.song.songCode} <span>{song.id}</span></p>
        </div>
      </article>

      <nav className="song-neighbours" aria-label={copy.song.neighbourLabel}>
        {previous ? (
          <Link href={`/song/${previous.id}`} className="neighbour-link previous">
            <ChevronLeft size={18} />
            <span><small>{copy.song.previous}</small>{previous.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/song/${next.id}`} className="neighbour-link next">
            <span><small>{copy.song.next}</small>{next.title}</span>
            <ChevronRight size={18} />
          </Link>
        ) : <div />}
      </nav>
    </div>
  );
}

export default function SongPage() {
  return <AppShell><SongPageContent /></AppShell>;
}
