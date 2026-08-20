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
import { ArrowUpRight, BookOpen, DatabaseZap, Loader2, Search, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function LibraryHome() {
  const { songs, status, source, error, reload } = useSongLibrary();
  const { copy } = useTranslation();
  const [filters, setFilters] = useState(defaultSongSearchFilters);

  const filteredSongs = useMemo(() => filterSongs(songs, filters), [filters, songs]);
  const authors = useMemo(() => getSongAuthors(songs), [songs]);
  const availableCategories = useMemo(() => getSongCategories(songs), [songs]);
  const hasUnlistedAuthors = useMemo(() => songs.some((song) => !song.poet?.trim()), [songs]);
  const filtersActive = hasActiveSongFilters(filters);

  const categories = useMemo(() => groupSongsByCategory(filteredSongs), [filteredSongs]);
  const updateFilters = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch }));
  const clearFilters = () => setFilters(defaultSongSearchFilters);

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
        <label className="library-search">
          <Search size={20} aria-hidden="true" />
          <input
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder={copy.library.searchPlaceholder}
            aria-label={copy.library.searchLabel}
          />
          {filtersActive && <span className="search-count">{filteredSongs.length}</span>}
        </label>
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
          ) : <span>{copy.library.searchIdleNote}</span>}
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
          <section className="library-metrics" aria-label="Data migration status">
            <div className="metric-card metric-primary">
              <DatabaseZap size={19} />
              <p><strong>{songs.length}</strong><span>{copy.library.metricSongs}</span></p>
            </div>
            <div className="metric-card">
              <BookOpen size={19} />
              <p><strong>{groupSongsByCategory(songs).length}</strong><span>{copy.library.metricSections}</span></p>
            </div>
            <div className="metric-card metric-source">
              <Sparkles size={19} />
              <p><strong>{source?.toUpperCase()}</strong><span>{copy.library.metricSource}</span></p>
            </div>
          </section>

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
                    <div className="song-list">
                      {category.songs.slice(0, filtersActive ? category.songs.length : 4).map((song) => <SongListItem song={song} key={song.id} />)}
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
        </>
      ) : null}
    </div>
  );
}

export default function Home() {
  return <AppShell><LibraryHome /></AppShell>;
}
