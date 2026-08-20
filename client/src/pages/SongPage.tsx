/**
 * Паломнический свиток: страница песни строится как развёрнутый лист,
 * где текст и ритм куплетов остаются главным визуальным объектом.
 */

import { AppShell } from "@/components/AppShell";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { songFirstLine } from "@/domain/song";
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Copy, Music2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

function SongPageContent() {
  const [, params] = useRoute("/song/:id");
  const { songs, status } = useSongLibrary();
  const song = songs.find((item) => item.id === params?.id);
  const index = song ? songs.findIndex((item) => item.id === song.id) : -1;
  const previous = index > 0 ? songs[index - 1] : null;
  const next = index >= 0 && index < songs.length - 1 ? songs[index + 1] : null;

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>Открываем песенник…</p>
      </section>
    );
  }

  if (!song) {
    return (
      <section className="not-found-panel">
        <span className="eyebrow">Страница не найдена</span>
        <h1>Этой песни нет в текущей библиотеке.</h1>
        <Link href="/" className="text-action"><ArrowLeft size={16} /> Вернуться к библиотеке</Link>
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
      toast.success("Текст песни скопирован.");
    } catch {
      toast.error("Браузер не позволил скопировать текст.");
    }
  };

  return (
    <div className="song-page">
      <div className="song-toolbar">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Библиотека</Link>
        <div className="song-toolbar-actions">
          <button className="quiet-icon-button" type="button" onClick={copySong} aria-label="Скопировать текст песни">
            <Copy size={17} />
          </button>
          <button className="quiet-icon-button" type="button" onClick={() => toast.message("Закладки будут добавлены в следующем вертикальном срезе.")} aria-label="Добавить в закладки">
            <Bookmark size={17} />
          </button>
        </div>
      </div>

      <article className="song-sheet">
        <div className="song-sheet-intro">
          <div>
            <span className="eyebrow">{song.category}</span>
            <h1>{song.title}</h1>
            <p className="song-poet">{song.poet || "Автор не указан"}</p>
          </div>
          <div className="song-insight">
            <Music2 size={19} />
            <span>{song.verses.length} {song.verses.length === 1 ? "куплет" : "куплетов"}</span>
          </div>
        </div>

        {song.comment && <p className="song-comment">{song.comment}</p>}

        <div className="song-verses">
          {song.verses.map((verse, verseIndex) => (
            <section className="verse-block" id={verse.id} key={verse.id}>
              <div className="verse-number" aria-label={`Куплет ${verse.originalVerseNumber}`}>
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
          <p>Начальная строка: <em>{songFirstLine(song)}</em></p>
          <p>Код песни: <span>{song.id}</span></p>
        </div>
      </article>

      <nav className="song-neighbours" aria-label="Соседние песни">
        {previous ? (
          <Link href={`/song/${previous.id}`} className="neighbour-link previous">
            <ChevronLeft size={18} />
            <span><small>Предыдущая</small>{previous.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/song/${next.id}`} className="neighbour-link next">
            <span><small>Следующая</small>{next.title}</span>
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
