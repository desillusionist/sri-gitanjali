/**
 * Паломнический свиток: страница песни строится как развёрнутый лист,
 * где текст и ритм куплетов остаются главным визуальным объектом.
 */

import { AppShell } from "@/components/AppShell";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getHighlightParts, getSongSearchMatches, normalizeSearchText, songFirstLine, type SongSearchMatch } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Music2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

function SongMatchText({
  value,
  query,
  fieldId,
  matchesByField,
  activeMatchId,
  registerMatch,
}: {
  value: string;
  query: string;
  fieldId: string;
  matchesByField: Map<string, SongSearchMatch[]>;
  activeMatchId: string | null;
  registerMatch: (matchId: string) => (element: HTMLElement | null) => void;
}) {
  const fieldMatches = matchesByField.get(fieldId) ?? [];

  return getHighlightParts(value, query).map((part, index) => {
    if (!part.isMatch) return <span key={`${fieldId}:text:${index}`}>{part.text}</span>;
    const match = fieldMatches[part.matchIndex ?? 0];
    if (!match) return <span key={`${fieldId}:fallback:${index}`}>{part.text}</span>;

    return (
      <mark
        className={`in-song-highlight ${match.id === activeMatchId ? "is-active" : ""}`}
        id={`match-${match.id}`}
        key={match.id}
        ref={registerMatch(match.id)}
      >
        {part.text}
      </mark>
    );
  });
}

function SongPageContent() {
  const [, params] = useRoute("/song/:id");
  const { songs, status, isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const routeQuery = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "";
  const [query, setQuery] = useState(routeQuery);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const matchElements = useRef(new Map<string, HTMLElement>());
  const song = songs.find((item) => item.id === params?.id);
  const index = song ? songs.findIndex((item) => item.id === song.id) : -1;
  const previous = index > 0 ? songs[index - 1] : null;
  const next = index >= 0 && index < songs.length - 1 ? songs[index + 1] : null;
  const matches = useMemo(() => song ? getSongSearchMatches(song, query) : [], [query, song]);
  const matchesByField = useMemo(() => {
    const byField = new Map<string, SongSearchMatch[]>();
    matches.forEach((match) => byField.set(match.fieldId, [...(byField.get(match.fieldId) ?? []), match]));
    return byField;
  }, [matches]);
  const activeMatch = matches[activeMatchIndex] ?? null;

  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [query, song?.id]);

  useEffect(() => {
    if (!activeMatch) return;
    const frame = window.requestAnimationFrame(() => {
      matchElements.current.get(activeMatch.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeMatch]);

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

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const url = new URL(window.location.href);
    if (nextQuery.trim()) url.searchParams.set("q", nextQuery.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const moveToMatch = (direction: -1 | 1) => {
    if (!matches.length) return;
    setActiveMatchIndex((current) => (current + direction + matches.length) % matches.length);
  };

  const registerMatch = (matchId: string) => (element: HTMLElement | null) => {
    if (element) matchElements.current.set(matchId, element);
    else matchElements.current.delete(matchId);
  };

  const songHref = (songId: string) => `/song/${songId}${normalizeSearchText(query) ? `?q=${encodeURIComponent(query.trim())}` : ""}`;

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

      <section className="in-song-search" aria-label={copy.song.inSongSearchLabel}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={copy.song.inSongSearchPlaceholder}
          aria-label={copy.song.inSongSearchLabel}
        />
        {query && (
          <button className="in-song-search-clear" type="button" onClick={() => updateQuery("")} aria-label={copy.song.clearInSongSearch}>
            <X size={15} />
          </button>
        )}
        <span className="in-song-match-count" aria-live="polite">
          {normalizeSearchText(query) ? (matches.length ? copy.song.matchPosition.replace("{current}", String(activeMatchIndex + 1)).replace("{total}", String(matches.length)) : copy.song.noInSongMatches) : ""}
        </span>
        <div className="in-song-search-controls">
          <button type="button" onClick={() => moveToMatch(-1)} disabled={!matches.length} aria-label={copy.song.previousMatch}>
            <ChevronUp size={16} />
          </button>
          <button type="button" onClick={() => moveToMatch(1)} disabled={!matches.length} aria-label={copy.song.nextMatch}>
            <ChevronDown size={16} />
          </button>
        </div>
      </section>

      <article className="song-sheet">
          <div className="song-sheet-intro">
          <div>
            <span className="eyebrow">{song.category}</span>
            <h1><SongMatchText value={song.title} query={query} fieldId="title" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></h1>
            <p className="song-poet"><SongMatchText value={song.poet || copy.library.noAuthor} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>
          </div>
          <div className="song-insight">
            <Music2 size={19} />
            <span>{song.verses.length} {song.verses.length === 1 ? copy.song.verse : copy.song.verses}</span>
          </div>
          <span className="mantra-line song-sheet-mantra" aria-hidden="true" />
        </div>

        {song.comment && <p className="song-comment"><SongMatchText value={song.comment} query={query} fieldId="comment" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>}

        <div className="song-verses">
          {song.verses.map((verse, verseIndex) => (
            <section className="verse-block" id={verse.id} key={verse.id}>
              <div className="verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>
                {String(verseIndex + 1).padStart(2, "0")}
              </div>
              <div className="verse-copy">
                {verse.lines.map((line) => (
                  <p className={`transliteration ${line.isIndented ? "is-indented" : ""}`} key={line.id}>
                    <SongMatchText value={line.transliteration} query={query} fieldId={`line:${line.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} />
                  </p>
                ))}
                {verse.translation && <p className="translation"><SongMatchText value={verse.translation} query={query} fieldId={`translation:${verse.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>}
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
          <Link href={songHref(previous.id)} className="neighbour-link previous">
            <ChevronLeft size={18} />
            <span><small>{copy.song.previous}</small>{previous.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link href={songHref(next.id)} className="neighbour-link next">
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
