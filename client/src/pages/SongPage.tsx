/**
 * Паломнический свиток: страница песни строится как развёрнутый лист,
 * где текст и ритм куплетов остаются главным визуальным объектом.
 */

import { AppShell } from "@/components/AppShell";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getHighlightParts, getSongSearchMatches, hideSecondarySongOrnamentsInLines, normalizeSearchText, songFirstLine, type SongSearchMatch } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { useTeleprompter } from "@/hooks/useTeleprompter";
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Gauge, Languages, Music2, Pause, Play, ScrollText, Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

const READING_FONT_SIZE_ADJUSTMENTS = [-0.18, -0.09, 0, 0.12, 0.24] as const;
const READING_LINE_HEIGHTS = [1.04, 1.08, 1.12, 1.18, 1.26] as const;
const DEFAULT_READING_STEP = 2;

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
  const [areTranslationsShown, setAreTranslationsShown] = useState(true);
  const [translationOverrides, setTranslationOverrides] = useState<Record<string, boolean>>({});
  const [areSecondaryOrnamentsHidden, setAreSecondaryOrnamentsHidden] = useState(false);
  const [readingFontSizeStep, setReadingFontSizeStep] = useState(DEFAULT_READING_STEP);
  const [readingLineHeightStep, setReadingLineHeightStep] = useState(DEFAULT_READING_STEP);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(30);
  const matchElements = useRef(new Map<string, HTMLElement>());
  const teleprompterScrollRef = useRef<HTMLDivElement>(null);
  const song = songs.find((item) => item.id === params?.id);
  const index = song ? songs.findIndex((item) => item.id === song.id) : -1;
  const previous = index > 0 ? songs[index - 1] : null;
  const next = index >= 0 && index < songs.length - 1 ? songs[index + 1] : null;
  const displayedVerses = useMemo(() => {
    if (!song) return [];

    return song.verses.map((verse) => ({
      ...verse,
      lines: areSecondaryOrnamentsHidden ? hideSecondarySongOrnamentsInLines(verse.lines) : verse.lines,
    }));
  }, [areSecondaryOrnamentsHidden, song]);
  const matches = useMemo(() => song ? getSongSearchMatches(song, query) : [], [query, song]);
  const matchesByField = useMemo(() => {
    const byField = new Map<string, SongSearchMatch[]>();
    matches.forEach((match) => byField.set(match.fieldId, [...(byField.get(match.fieldId) ?? []), match]));
    return byField;
  }, [matches]);
  const activeMatch = matches[activeMatchIndex] ?? null;
  const { isPlaying: isTeleprompterPlaying, pause: pauseTeleprompter, toggle: toggleTeleprompter } = useTeleprompter(isTeleprompterOpen, teleprompterSpeed, teleprompterScrollRef);

  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [query, song?.id]);

  useEffect(() => {
    setAreTranslationsShown(true);
    setTranslationOverrides({});
    setIsTeleprompterOpen(false);
  }, [song?.id]);

  useLayoutEffect(() => {
    if (!song?.id) return;

    const resetScrollPosition = () => {
      window.scrollTo(0, 0);
      teleprompterScrollRef.current?.scrollTo(0, 0);
    };

    // Reset both immediately and on the following frame so a browser-restored
    // SPA position cannot place a newly opened song at its final verses.
    resetScrollPosition();
    const frame = window.requestAnimationFrame(resetScrollPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [song?.id]);

  useEffect(() => {
    if (!isTeleprompterOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const documentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = documentOverflow;
    };
  }, [isTeleprompterOpen]);

  useEffect(() => {
    const translationVerseId = activeMatch?.kind === "translation" ? activeMatch.verseId : undefined;
    if (!translationVerseId) return;
    setTranslationOverrides((current) => current[translationVerseId] === true ? current : { ...current, [translationVerseId]: true });
  }, [activeMatch]);

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
  const author = song.poet;
  const toggleSongFavorite = () => {
    toggleFavorite(song.id);
    toast.success(favorite ? copy.song.removedFavorite : copy.song.addedFavorite);
  };
  const categoryFilterHref = `/?category=${encodeURIComponent(song.category)}#search`;
  const authorFilterHref = author ? `/?author=${encodeURIComponent(author)}#search` : null;

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

  const setAllTranslationsVisibility = (nextVisible: boolean) => {
    setAreTranslationsShown(nextVisible);
    setTranslationOverrides({});
  };

  const isVerseTranslationVisible = (verseId: string) => translationOverrides[verseId] ?? areTranslationsShown;

  const toggleVerseTranslation = (verseId: string) => {
    setTranslationOverrides((current) => ({ ...current, [verseId]: !(current[verseId] ?? areTranslationsShown) }));
  };

  const adjustReadingFontSize = (direction: -1 | 1) => {
    setReadingFontSizeStep((current) => Math.min(READING_FONT_SIZE_ADJUSTMENTS.length - 1, Math.max(0, current + direction)));
  };

  const adjustReadingLineHeight = (direction: -1 | 1) => {
    setReadingLineHeightStep((current) => Math.min(READING_LINE_HEIGHTS.length - 1, Math.max(0, current + direction)));
  };

  const closeTeleprompter = () => {
    pauseTeleprompter();
    setIsTeleprompterOpen(false);
  };

  const registerMatch = (matchId: string) => (element: HTMLElement | null) => {
    if (element) matchElements.current.set(matchId, element);
    else matchElements.current.delete(matchId);
  };

  const songHref = (songId: string) => `/song/${songId}${normalizeSearchText(query) ? `?q=${encodeURIComponent(query.trim())}` : ""}`;
  const hasTranslations = song.verses.some((verse) => Boolean(verse.translation));
  const readingTypographyStyle = {
    "--reading-font-size-adjustment": `${READING_FONT_SIZE_ADJUSTMENTS[readingFontSizeStep]}rem`,
    "--reading-line-height": String(READING_LINE_HEIGHTS[readingLineHeightStep]),
    "--teleprompter-line-height": String(READING_LINE_HEIGHTS[readingLineHeightStep]),
  } as CSSProperties;
  const fontSizeState = readingFontSizeStep === DEFAULT_READING_STEP
    ? copy.song.readingDefault
    : readingFontSizeStep < DEFAULT_READING_STEP ? copy.song.readingSmaller : copy.song.readingLarger;
  const lineHeightState = readingLineHeightStep === DEFAULT_READING_STEP
    ? copy.song.readingDefault
    : readingLineHeightStep < DEFAULT_READING_STEP ? copy.song.readingTighter : copy.song.readingLooser;

  return (
    <div className={`song-page ${isTeleprompterOpen ? "is-teleprompter" : ""}`} style={readingTypographyStyle}>
      <div className="song-toolbar">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> {copy.song.backToLibrary}</Link>
        <div className="song-toolbar-actions">
          <button className={`teleprompter-toggle ${isTeleprompterOpen ? "is-active" : ""}`} type="button" onClick={() => setIsTeleprompterOpen((current) => !current)} aria-expanded={isTeleprompterOpen} aria-controls="teleprompter-controls" aria-label={copy.song.teleprompterOpen}>
            <ScrollText size={16} aria-hidden="true" />
            <span>{copy.song.teleprompterToggle}</span>
          </button>
          <button className="quiet-icon-button" type="button" onClick={copySong} aria-label={copy.song.copyLabel}>
            <Copy size={17} />
          </button>
          <button className={`quiet-icon-button ${favorite ? "is-favorite" : ""}`} type="button" onClick={toggleSongFavorite} aria-label={favorite ? copy.song.removeFavorite : copy.song.addFavorite} aria-pressed={favorite}>
            {favorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        </div>
      </div>

      {isTeleprompterOpen && (
        <section className="teleprompter-overlay" role="dialog" aria-modal="true" aria-label={copy.song.teleprompterTitle}>
          <header className="teleprompter-overlay-controls" data-teleprompter-controls>
            <div className="teleprompter-status" aria-live="polite">
              <span aria-hidden="true" />
              {isTeleprompterPlaying ? copy.song.teleprompterPlaying : copy.song.teleprompterReady}
            </div>
            <div className="teleprompter-speed-control">
              <label htmlFor="teleprompter-speed"><Gauge size={15} aria-hidden="true" /> {copy.song.teleprompterSpeed}</label>
              <Slider
                id="teleprompter-speed"
                value={[teleprompterSpeed]}
                min={12}
                max={72}
                step={2}
                onValueChange={([nextSpeed]) => setTeleprompterSpeed(nextSpeed ?? 30)}
                aria-label={copy.song.teleprompterSpeed}
              />
              <output htmlFor="teleprompter-speed">{copy.song.teleprompterSpeedValue.replace("{speed}", String(teleprompterSpeed))}</output>
            </div>
            <div className="teleprompter-actions">
              <button className={`teleprompter-play-button ${isTeleprompterPlaying ? "is-playing" : ""}`} type="button" onClick={toggleTeleprompter}>
                {isTeleprompterPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                <span>{isTeleprompterPlaying ? copy.song.teleprompterPause : copy.song.teleprompterStart}</span>
              </button>
              <button className="teleprompter-close-button" type="button" onClick={closeTeleprompter} aria-label={copy.song.teleprompterClose}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="teleprompter-reading-surface" ref={teleprompterScrollRef} tabIndex={0} aria-label={copy.song.teleprompterTitle}>
            <div className="teleprompter-reading-content">
              {displayedVerses.map((verse, verseIndex) => (
                <section className="teleprompter-shloka" key={verse.id}>
                  <span className="teleprompter-verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>{String(verseIndex + 1).padStart(2, "0")}</span>
                  <div>
                    {verse.lines.map((line) => <p className={`teleprompter-line ${line.isIndented ? "is-indented" : ""}`} key={line.id}>{line.transliteration}</p>)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <Link className="eyebrow song-category-link" href={categoryFilterHref} aria-label={copy.song.filterByCategory.replace("{category}", song.category)}>{song.category}</Link>
            <h1><SongMatchText value={song.title} query={query} fieldId="title" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></h1>
            <p className="song-poet">{author && authorFilterHref ? <Link className="song-poet-link" href={authorFilterHref} aria-label={copy.song.filterByAuthor.replace("{author}", author)}><SongMatchText value={author} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></Link> : <SongMatchText value={copy.library.noAuthor} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} />}</p>
          </div>
          <div className="song-insight">
            <Music2 size={19} />
            <span>{song.verses.length} {song.verses.length === 1 ? copy.song.verse : copy.song.verses}</span>
          </div>
          <span className="mantra-line song-sheet-mantra" aria-hidden="true" />
        </div>

        {song.comment && <p className="song-comment"><SongMatchText value={song.comment} query={query} fieldId="comment" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>}

        <section className="reading-typography-controls" aria-labelledby="reading-typography-label">
          <div className="reading-typography-heading">
            <span className="eyebrow" id="reading-typography-label">{copy.song.readingControlsEyebrow}</span>
            <p className="visually-hidden">{copy.song.readingControlsDescription}</p>
          </div>
          <div className="reading-typography-actions">
            <div className="reading-stepper-control">
              <span className="reading-stepper-label">{copy.song.readingFontSize}</span>
              <div className="reading-stepper" role="group" aria-label={copy.song.readingFontSize}>
                <button type="button" className="reading-step-button reading-type-button is-small" onClick={() => adjustReadingFontSize(-1)} disabled={readingFontSizeStep === 0} aria-label={copy.song.decreaseFontSize}>A</button>
                <button type="button" className="reading-step-button reading-type-button is-large" onClick={() => adjustReadingFontSize(1)} disabled={readingFontSizeStep === READING_FONT_SIZE_ADJUSTMENTS.length - 1} aria-label={copy.song.increaseFontSize}>A</button>
              </div>
              <output className="visually-hidden" aria-live="polite">{fontSizeState}</output>
            </div>
            <div className="reading-stepper-control">
              <span className="reading-stepper-label">{copy.song.readingLineHeight}</span>
              <div className="reading-stepper" role="group" aria-label={copy.song.readingLineHeight}>
                <button type="button" className="reading-step-button" onClick={() => adjustReadingLineHeight(-1)} disabled={readingLineHeightStep === 0} aria-label={copy.song.decreaseLineSpacing}><span className="line-spacing-glyph is-tight" aria-hidden="true"><i /><i /><i /></span></button>
                <button type="button" className="reading-step-button" onClick={() => adjustReadingLineHeight(1)} disabled={readingLineHeightStep === READING_LINE_HEIGHTS.length - 1} aria-label={copy.song.increaseLineSpacing}><span className="line-spacing-glyph is-loose" aria-hidden="true"><i /><i /><i /></span></button>
              </div>
              <output className="visually-hidden" aria-live="polite">{lineHeightState}</output>
            </div>
          </div>
          <div className="reading-visibility-controls" role="group" aria-label={copy.song.readingControlsEyebrow}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`reading-visibility-toggle reading-ornament-toggle ${areSecondaryOrnamentsHidden ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setAreSecondaryOrnamentsHidden((current) => !current)}
                  aria-pressed={areSecondaryOrnamentsHidden}
                  aria-label={areSecondaryOrnamentsHidden ? copy.song.showSecondaryOrnaments : copy.song.hideSecondaryOrnaments}
                >
                  <span aria-hidden="true">()</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{copy.song.secondaryOrnamentsDescription}</TooltipContent>
            </Tooltip>
            {hasTranslations && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`reading-visibility-toggle ${areTranslationsShown ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setAllTranslationsVisibility(!areTranslationsShown)}
                    aria-pressed={areTranslationsShown}
                    aria-label={areTranslationsShown ? copy.song.hideAllTranslations : copy.song.showAllTranslations}
                  >
                    <Languages size={15} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{copy.song.translationsDescription}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </section>

        <div className="song-verses">
          {displayedVerses.map((verse, verseIndex) => {
            const translationVisible = isVerseTranslationVisible(verse.id);

            return (
              <section className="verse-block" id={verse.id} key={verse.id}>
                {verse.translation ? (
                  <button
                    className="verse-number verse-translation-marker"
                    type="button"
                    onClick={() => toggleVerseTranslation(verse.id)}
                    aria-controls={`translation-${verse.id}`}
                    aria-expanded={translationVisible}
                    aria-label={`${translationVisible ? copy.song.hideVerseTranslation : copy.song.showVerseTranslation}: ${copy.song.verse} ${verse.originalVerseNumber}`}
                  >
                    <span>{String(verseIndex + 1).padStart(2, "0")}</span>
                    <ChevronDown size={11} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>
                    {String(verseIndex + 1).padStart(2, "0")}
                  </div>
                )}
                <div className="verse-copy">
                  {verse.lines.map((line) => (
                    <p className={`transliteration ${line.isIndented ? "is-indented" : ""}`} key={line.id}>
                      <SongMatchText value={line.transliteration} query={query} fieldId={`line:${line.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} />
                    </p>
                  ))}
                  {verse.translation && (
                    <>
                      <div id={`translation-${verse.id}`} hidden={!translationVisible}>
                        <p className="translation"><SongMatchText value={verse.translation} query={query} fieldId={`translation:${verse.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>
                      </div>
                    </>
                  )}
                </div>
              </section>
            );
          })}
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
