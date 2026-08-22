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
  groupSongsByFirstLine,
  hasActiveSongFilters,
} from "@/domain/song";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { ArrowUpRight, ArrowDownAZ, BookOpen, Clock3, DatabaseZap, LibraryBig, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useEffect, useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LibraryHome() {
  const { songs, status, error, reload } = useSongLibrary();
  const { copy } = useTranslation();
  const [filters, setFilters] = useState(defaultSongSearchFilters);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());
  const [libraryView, setLibraryView] = useState<"library" | "index">("library");
  const { recentSearches, rememberSearch, clearRecentSearches } = useRecentSearches();

  const filteredSongs = useMemo(() => filterSongs(songs, filters), [filters, songs]);
  const authors = useMemo(() => getSongAuthors(songs), [songs]);
  const availableCategories = useMemo(() => getSongCategories(songs), [songs]);
  const hasUnlistedAuthors = useMemo(() => songs.some((song) => !song.poet?.trim()), [songs]);
  const filtersActive = hasActiveSongFilters(filters);

  const categories = useMemo(() => groupSongsByCategory(filteredSongs), [filteredSongs]);
  const initialIndex = useMemo(() => groupSongsByFirstLine(filteredSongs), [filteredSongs]);
  const indexJumpLetters = useMemo(() => {
    const alphabet = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    const additionalLetters = initialIndex.map((group) => group.letter).filter((letter) => !alphabet.includes(letter));
    return [...alphabet, ...additionalLetters];
  }, [initialIndex]);
  const indexedLetters = useMemo(() => new Set(initialIndex.map((group) => group.letter)), [initialIndex]);
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
    if (targetId.startsWith("index-letter-")) setLibraryView("index");
    if (targetId && (targetId === "search" || status === "ready")) {
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [status]);

  useEffect(() => {
    const syncIndexViewFromHash = () => {
      if (window.location.hash.startsWith("#index-letter-")) setLibraryView("index");
    };

    syncIndexViewFromHash();
    window.addEventListener("hashchange", syncIndexViewFromHash);
    return () => window.removeEventListener("hashchange", syncIndexViewFromHash);
  }, []);

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
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
    <div className="library-page">
      <header className="library-header">
        <div className="header-copy">
          <p className="eyebrow">{copy.library.eyebrow}</p>
          <h1>{copy.library.title}<br /><em>{copy.library.titleEmphasis}</em></h1>
          <p className="header-lede">{copy.library.lede}</p>
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
          <Tabs value={libraryView} onValueChange={(value) => setLibraryView(value as "library" | "index")} className="library-content" id="library">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{libraryView === "index" ? copy.library.indexEyebrow : copy.library.structureEyebrow}</span>
                <h2 id="library-heading">{libraryView === "index" ? copy.library.indexHeading : filtersActive ? copy.library.resultsHeading.replace("{count}", String(filteredSongs.length)) : copy.library.sectionsHeading}</h2>
              </div>
              <div className="library-view-controls">
                <p>{libraryView === "index" ? copy.library.indexDetail : filtersActive ? copy.library.filterResultsDetail : copy.library.sectionsDetail}</p>
                <TabsList className="library-view-tabs-list" aria-label={copy.library.viewLabel}>
                  <TabsTrigger value="library" className="library-view-tabs-trigger"><LibraryBig size={15} aria-hidden="true" />{copy.library.libraryView}</TabsTrigger>
                  <TabsTrigger value="index" className="library-view-tabs-trigger"><ArrowDownAZ size={15} aria-hidden="true" />{copy.library.indexView}</TabsTrigger>
                </TabsList>
              </div>
            </div>
            {filteredSongs.length ? (
              <>
                <TabsContent value="library" className="library-view-panel">
                  <div className="category-list">
                    {categories.map((category, categoryIndex) => (
                      (() => {
                        const canExpand = !filtersActive && category.songs.length > 4;
                        const isExpanded = expandedCategoryIds.has(category.id);
                        const visibleSongs = canExpand && !isExpanded ? category.songs.slice(0, 4) : category.songs;
                        const songListId = `category-songs-${category.id}`;

                        return (
                          <section className="category-block" key={category.id} style={{ "--entry-index": categoryIndex } as React.CSSProperties}>
                            <header className="category-heading">
                              <span className="category-index">{String(categoryIndex + 1).padStart(2, "0")}</span>
                              <h3>{category.name}</h3>
                              {canExpand ? (
                                <button
                                  className="category-count-control"
                                  type="button"
                                  aria-controls={songListId}
                                  aria-expanded={isExpanded}
                                  aria-label={(isExpanded ? copy.library.collapseCategory : copy.library.expandCategory)
                                    .replace("{category}", category.name)
                                    .replace("{count}", String(category.songs.length))}
                                  onClick={() => toggleCategoryExpansion(category.id)}
                                >
                                  <span>{category.songs.length} {copy.library.songCount}</span>
                                </button>
                              ) : <span className="category-song-count">{category.songs.length} {copy.library.songCount}</span>}
                            </header>
                            <div className="song-list" id={songListId}>
                              {visibleSongs.map((song) => <SongListItem song={song} query={filters.query} key={song.id} />)}
                            </div>
                          </section>
                        );
                      })()
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="index" className="library-view-panel">
                  <div className="alphabetical-index">
                    <nav className="index-jump-nav" aria-label={copy.library.indexJumpLabel}>
                      <span className="index-jump-label" aria-hidden="true">A–Z</span>
                      <div className="index-jump-letters">
                        {indexJumpLetters.map((letter) => {
                          const isAvailable = indexedLetters.has(letter);
                          const unavailableLabel = copy.library.indexLetterUnavailable.replace("{letter}", letter);

                          return isAvailable ? (
                            <a
                              className="index-jump-link"
                              href={`#index-letter-${letter}`}
                              key={letter}
                              aria-label={copy.library.indexJumpToLetter.replace("{letter}", letter)}
                            >
                              {letter}
                            </a>
                          ) : (
                            <span className="index-jump-link is-unavailable" key={letter} aria-label={unavailableLabel} title={unavailableLabel}>
                              {letter}
                            </span>
                          );
                        })}
                      </div>
                    </nav>
                    {initialIndex.map((group, groupIndex) => (
                      <section className="index-letter-group" id={`index-letter-${group.letter}`} key={group.letter} style={{ "--entry-index": groupIndex } as React.CSSProperties}>
                        <header className="index-letter-heading">
                          <span aria-hidden="true">{group.letter}</span>
                          <p>{copy.library.indexGroupCount.replace("{count}", String(group.songs.length))}</p>
                        </header>
                        <div className="song-list index-song-list">
                          {group.songs.map((song) => <SongListItem song={song} query={filters.query} variant="opening-line" key={song.id} />)}
                        </div>
                      </section>
                    ))}
                  </div>
                </TabsContent>
              </>
            ) : (
              <section className="empty-search">
                <span className="eyebrow">{copy.library.noMatchesEyebrow}</span>
                <h2>{copy.library.noMatchesTitle}</h2>
                <button type="button" className="text-action" onClick={clearFilters}>{copy.library.clearAllFilters} <ArrowUpRight size={16} /></button>
              </section>
            )}
          </Tabs>

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
