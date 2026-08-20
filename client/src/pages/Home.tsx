/**
 * Паломнический свиток: светлая редакционная библиотека с шафрановыми акцентами,
 * асимметричной reading rail и поиском как главным действием.
 */

import { AppShell } from "@/components/AppShell";
import { brandAssets } from "@/data/sources";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { groupSongsByCategory, songFirstLine, songSearchText } from "@/domain/song";
import { ArrowUpRight, BookOpen, ChevronRight, DatabaseZap, Loader2, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function LibraryHome() {
  const { songs, status, source, error, reload } = useSongLibrary();
  const [query, setQuery] = useState("");
  const normalizedQuery = query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const filteredSongs = useMemo(() => {
    if (!normalizedQuery) return songs;
    return songs.filter((song) => songSearchText(song).includes(normalizedQuery));
  }, [songs, normalizedQuery]);

  const categories = useMemo(() => groupSongsByCategory(filteredSongs), [filteredSongs]);

  return (
    <div className="library-page">
      <header className="library-header">
        <div className="header-copy">
          <p className="eyebrow">Kīrtan Guide / локальная библиотека</p>
          <h1>Найдите строку,<br /><em>с которой начинается пение.</em></h1>
          <p className="header-lede">Базовый PWA-каркас уже читает реальный каталог SwiftUI-проекта: песни, куплеты, переводы и отступы строк.</p>
        </div>
        <div className="hero-art" role="img" aria-label="Открытый песенник на тёплой бумажной поверхности">
          <img src={brandAssets.libraryHero} alt="" />
          <div className="hero-art-caption"><span />собранная тетрадь · web edition</div>
        </div>
      </header>

      <section className="search-deck" id="search" aria-labelledby="search-heading">
        <div className="search-deck-title">
          <span className="eyebrow">Открыть библиотеку</span>
          <h2 id="search-heading">Искать по названию, автору или строке.</h2>
        </div>
        <label className="library-search">
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например, jaya rādhā или morning…"
            aria-label="Поиск по библиотеке песен"
          />
          {query && <span className="search-count">{filteredSongs.length}</span>}
        </label>
        <p className="search-note">{query ? "Результаты обновляются без отправки формы." : "В следующей версии сюда перейдут расширенные синтаксис и фонетический поиск."}</p>
      </section>

      {status === "loading" || status === "idle" ? (
        <section className="data-loading" aria-live="polite">
          <Loader2 className="loading-orbit" size={22} />
          <div><span className="eyebrow">Импортируем сборник</span><p>Преобразуем строки CSV в веб-модели песен…</p></div>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="data-error" role="alert">
          <span className="eyebrow">Источник недоступен</span>
          <p>{error}</p>
          <button className="text-action" type="button" onClick={reload}>Попробовать снова <ArrowUpRight size={16} /></button>
        </section>
      ) : null}

      {status === "ready" ? (
        <>
          <section className="library-metrics" aria-label="Статус переноса данных">
            <div className="metric-card metric-primary">
              <DatabaseZap size={19} />
              <p><strong>{songs.length}</strong><span>песен перенесено из исходного CSV</span></p>
            </div>
            <div className="metric-card">
              <BookOpen size={19} />
              <p><strong>{groupSongsByCategory(songs).length}</strong><span>разделов в навигационной карте</span></p>
            </div>
            <div className="metric-card metric-source">
              <Sparkles size={19} />
              <p><strong>{source?.toUpperCase()}</strong><span>активный источник с резервным CSV-путём</span></p>
            </div>
          </section>

          <section className="library-content" id="library" aria-labelledby="library-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Структура исходного песенника</span>
                <h2 id="library-heading">{query ? `Найдено: ${filteredSongs.length}` : "Разделы библиотеки"}</h2>
              </div>
              <p>{query ? "Совпадения ищутся по перенесённой модели Song." : "Нажмите на песню, чтобы проверить маршрут, куплеты и перевод."}</p>
            </div>

            {categories.length ? (
              <div className="category-list">
                {categories.map((category, categoryIndex) => (
                  <section className="category-block" key={category.id} style={{ "--entry-index": categoryIndex } as React.CSSProperties}>
                    <header className="category-heading">
                      <span className="category-index">{String(categoryIndex + 1).padStart(2, "0")}</span>
                      <h3>{category.name}</h3>
                      <span>{category.songs.length} песн.</span>
                    </header>
                    <div className="song-list">
                      {category.songs.slice(0, query ? 12 : 4).map((song) => (
                        <Link href={`/song/${song.id}`} className="song-row" key={song.id}>
                          <span className="song-row-ornament" aria-hidden="true" />
                          <span className="song-row-copy">
                            <strong>{song.title}</strong>
                            <small>{song.poet || "Автор не указан"} · {songFirstLine(song)}</small>
                          </span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <section className="empty-search">
                <span className="eyebrow">Нет совпадений</span>
                <h2>Попробуйте другую строку или имя автора.</h2>
                <button type="button" className="text-action" onClick={() => setQuery("")}>Очистить поиск <ArrowUpRight size={16} /></button>
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
