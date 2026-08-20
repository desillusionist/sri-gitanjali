/**
 * Паломнический свиток: светлая редакционная библиотека с шафрановыми акцентами,
 * асимметричной reading rail и поиском как главным действием.
 */

import { AppShell } from "@/components/AppShell";
import { SongListItem } from "@/components/SongListItem";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brandAssets } from "@/data/sources";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import {
  ALL_AUTHORS_FILTER,
  ALL_CATEGORIES_FILTER,
  UNLISTED_AUTHOR_FILTER,
  defaultSongSearchFilters,
  filterSongs,
  getSongAuthors,
  getSongCategories,
  groupSongsByCategory,
  hasActiveSongFilters,
} from "@/domain/song";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { ArrowUpRight, BookOpen, Clock3, DatabaseZap, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useEffect, useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Link } from "wouter";

function LibraryHome() {
  const { songs, status, error, reload } = useSongLibrary();
  const { copy } = useTranslation();
  const [filters, setFilters] = useState(defaultSongSearchFilters);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { recentSearches, rememberSearch, clearRecentSearches } = useRecentSearches();

  const filteredSongs = useMemo(() => filterSongs(songs, filters), [filters, songs]);
  const authors = useMemo(() => getSongAuthors(songs), [songs]);
  const availableCategories = useMemo(() => getSongCategories(songs), [songs]);
  const hasUnlistedAuthors = useMemo(() => songs.some((song) => !song.poet?.trim()), [songs]);
  const filtersActive = hasActiveSongFilters(filters);

  const categories = useMemo(() => groupSongsByCategory(filteredSongs), [filteredSongs]);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const nextFilters = {
      query: parameters.get("q") ?? defaultSongSearchFilters.query,
      author: parameters.get("author") ?? defaultSongSearchFilters.author,
      category: parameters.get("category") ?? defaultSongSearchFilters.category,
    };

    setFilters((current) => (
      current.query === nextFilters.query && current.author === nextFilters.author && current.category === nextFilters.category
        ? current
        : nextFilters
    ));

    const targetId = window.location.hash.slice(1);
    if (targetId && (targetId === "search" || status === "ready")) {
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [status]);

  const updateFilters = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch }));
  const clearFilters = () => setFilters(defaultSongSearchFilters);
  const handleSearchBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    rememberSearch(filters.query);
    setIsSearchFocused(false);
  };
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") rememberSearch(filters.query);
  };
  const applyRecentSearch = (query: string) => {
    updateFilters({ query });
    rememberSearch(query);
    setIsSearchFocused(false);
  };

  return (
    <div className="library-page">
      <header className="library-header">
        <div className="header-copy">
          <p className="eyebrow">{copy.library.eyebrow}</p>
          <h1>{copy.library.title}<br /><em>{copy.library.titleEmphasis}</em></h1>
          <p className="header-lede">{copy.library.lede}</p>
          <span className="mantra-line header-mantra" aria-hidden="true" />
        </div>
        <div className="hero-art" role="img" aria-label={copy.library.heroAlt}>
          <img src={brandAssets.libraryHero} alt="" />
          <div className="hero-art-caption"><span />{copy.library.heroCaption}</div>
        </div>
      </header>

      <section className="search-deck" id="search" aria-labelledby="search-heading">
        <div className="search-deck-title">
          <span className="eyebrow">{copy.library.searchEyebrow}</span>
          <h2 id="search-heading">{copy.library.searchTitle}</h2>
        </div>
        <div className="library-search-stack" onFocusCapture={() => setIsSearchFocused(true)} onBlurCapture={handleSearchBlur}>
          <label className="library-search">
            <Search size={20} aria-hidden="true" />
            <input
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              onKeyDown={handleSearchKeyDown}
              placeholder={copy.library.searchPlaceholder}
              aria-label={copy.library.searchLabel}
            />
            {filtersActive && <span className="search-count">{filteredSongs.length}</span>}
          </label>

          {isSearchFocused && recentSearches.length > 0 ? (
            <section className="recent-searches" aria-label={copy.library.recentSearches}>
              <div className="recent-searches-heading">
                <span><Clock3 size={14} aria-hidden="true" />{copy.library.recentSearches}</span>
                <button
                  className="clear-history-button"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    clearRecentSearches();
                    setIsSearchFocused(false);
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />{copy.library.clearSearchHistory}
                </button>
              </div>
              <div className="recent-searches-list">
                {recentSearches.map((query) => (
                  <button
                    className="recent-search-chip"
                    type="button"
                    key={query}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyRecentSearch(query)}
                    aria-label={copy.library.applyRecentSearch.replace("{query}", query)}
                  >
                    <Search size={13} aria-hidden="true" />
                    <span>{query}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <div className="filter-controls" role="group" aria-label={copy.library.filtersLabel}>
          <label className="filter-field">
            <span>{copy.library.filterAuthor}</span>
            <Select value={filters.author} onValueChange={(author) => updateFilters({ author })}>
              <SelectTrigger className="filter-select w-full" aria-label={copy.library.filterAuthor}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="filter-select-content">
                <SelectItem value={ALL_AUTHORS_FILTER}>{copy.library.allAuthors}</SelectItem>
                {hasUnlistedAuthors && <SelectItem value={UNLISTED_AUTHOR_FILTER}>{copy.library.unlistedAuthor}</SelectItem>}
                {authors.map((author) => <SelectItem value={author} key={author}>{author}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="filter-field">
            <span>{copy.library.filterCategory}</span>
            <Select value={filters.category} onValueChange={(category) => updateFilters({ category })}>
              <SelectTrigger className="filter-select w-full" aria-label={copy.library.filterCategory}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="filter-select-content">
                <SelectItem value={ALL_CATEGORIES_FILTER}>{copy.library.allCategories}</SelectItem>
                {availableCategories.map((category) => <SelectItem value={category} key={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="filter-summary" aria-live="polite">
          <p><strong>{filteredSongs.length}</strong> {copy.library.matchingSongs}</p>
          {filtersActive ? (
            <>
              <span>{copy.library.filtersApplied}</span>
              <button className="clear-filters-button" type="button" onClick={clearFilters}>{copy.library.clearAllFilters} <X size={14} /></button>
            </>
          ) : <span>{copy.library.searchStatusIdle}</span>}
        </div>
        <p className="search-note">{filtersActive ? copy.library.searchActiveNote : copy.library.searchIdleNote}</p>
      </section>

      {status === "loading" || status === "idle" ? (
        <section className="data-loading" aria-live="polite">
          <Loader2 className="loading-orbit" size={22} />
          <div><span className="eyebrow">{copy.library.loadingEyebrow}</span><p>{copy.library.loadingText}</p></div>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="data-error" role="alert">
          <span className="eyebrow">{copy.library.errorEyebrow}</span>
          <p>{error}</p>
          <button className="text-action" type="button" onClick={reload}>{copy.library.retry} <ArrowUpRight size={16} /></button>
        </section>
      ) : null}

      {status === "ready" ? (
        <>
          <section className="library-content" id="library" aria-labelledby="library-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{copy.library.structureEyebrow}</span>
                <h2 id="library-heading">{filtersActive ? copy.library.resultsHeading.replace("{count}", String(filteredSongs.length)) : copy.library.sectionsHeading}</h2>
              </div>
              <p>{filtersActive ? copy.library.filterResultsDetail : copy.library.sectionsDetail}</p>
            </div>
            <span className="mantra-line section-mantra" aria-hidden="true" />

            {categories.length ? (
              <div className="category-list">
                {categories.map((category, categoryIndex) => (
                  <section className="category-block" key={category.id} style={{ "--entry-index": categoryIndex } as React.CSSProperties}>
                    <header className="category-heading">
                      <span className="category-index">{String(categoryIndex + 1).padStart(2, "0")}</span>
                      <h3>{category.name}</h3>
                      <span>{category.songs.length} {copy.library.songCount}</span>
                    </header>
                    <span className="mantra-line category-mantra" aria-hidden="true" />
                    <div className="song-list">
                      {category.songs.slice(0, filtersActive ? category.songs.length : 4).map((song) => <SongListItem song={song} query={filters.query} key={song.id} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <section className="empty-search">
                <span className="eyebrow">{copy.library.noMatchesEyebrow}</span>
                <h2>{copy.library.noMatchesTitle}</h2>
                <button type="button" className="text-action" onClick={clearFilters}>{copy.library.clearAllFilters} <ArrowUpRight size={16} /></button>
              </section>
            )}
          </section>

          <section className="library-metrics" aria-label={copy.library.libraryTrustLabel}>
            <div className="library-metrics-intro">
              <span className="eyebrow">{copy.library.metricsEyebrow}</span>
              <p>{copy.library.metricsNote}</p>
            </div>
            <div className="metric-card metric-primary">
              <DatabaseZap size={19} />
              <p><strong>{songs.length}</strong><span>{copy.library.metricSongs}</span></p>
            </div>
            <div className="metric-card">
              <BookOpen size={19} />
              <p><strong>{groupSongsByCategory(songs).length}</strong><span>{copy.library.metricSections}</span></p>
            </div>
            <div className="metric-card metric-return">
              <Sparkles size={19} />
              <p><strong>∞</strong><span>{copy.library.metricReturn}</span></p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function Home() {
  return <AppShell><LibraryHome /></AppShell>;
}
