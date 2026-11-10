/**
 * The playlist: recordings gathered from the library and song pages. They play one after another
 * in the shared player docked at the foot of the app.
 */

import { AppShell } from "@/components/AppShell";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { formatTrackLength, WITH_RECORDINGS_FILTER } from "@/domain/song";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useTranslation } from "@/i18n/LanguageContext";
import { ArrowDown, ArrowUp, ListMusic, Pause, Play, Trash2, X } from "lucide-react";
import { usePageMeta } from "@/lib/pageMeta";
import { Link } from "wouter";

function PlaylistContent() {
  const { status } = useSongLibrary();
  const { copy } = useTranslation();
  usePageMeta("Playlist");
  const { remove, move, clear } = usePlaylist();
  const { items, current, isOpen, isPlaying, play, togglePlay, open, close } = usePlayer();

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>{copy.song.opening}</p>
      </section>
    );
  }

  return (
    <div className="favorites-page playlist-page">
      <header className="favorites-header">
        <span className="eyebrow">{copy.playlist.eyebrow}</span>
        <h1>{copy.playlist.title}<br /><em>{copy.playlist.titleEmphasis}</em></h1>
        <p>{copy.playlist.lede}</p>
        <div className="favorites-count">
          <ListMusic size={18} />
          <strong>{items.length}</strong>
          <span>{copy.playlist.count}</span>
        </div>
      </header>

      {items.length && current ? (
        <section className="playlist-section" aria-label={copy.navigation.playlist}>
          <div className="playlist-toolbar">
            <button type="button" className="playlist-play-button" onClick={() => (isOpen ? togglePlay() : play(current.url))}>
              {isOpen && isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {isOpen && isPlaying ? copy.playlist.pause : copy.playlist.playFrom.replace("{track}", current.song.title)}
            </button>
            {!isOpen && <button type="button" className="text-action" onClick={open}>{copy.playlist.showPlayer}</button>}
            {isOpen && !isPlaying && <button type="button" className="text-action" onClick={close}>{copy.playlist.hidePlayer}</button>}
          </div>

          <ol className="playlist-list">
            {items.map((item, index) => {
              const singer = item.singer ?? copy.playlist.unknownSinger;
              const isCurrent = item.url === current.url;
              return (
                <li className={`playlist-row${isCurrent ? " is-current" : ""}`} key={item.url}>
                  <button className="playlist-row-play" type="button" onClick={() => play(item.url)} aria-current={isCurrent ? "true" : undefined} aria-label={copy.playlist.playTrack.replace("{track}", `${item.song.title} (${singer})`)}>
                    <span className="playlist-row-number" aria-hidden="true">{isCurrent && isOpen && isPlaying ? "♪" : index + 1}</span>
                    <span className="playlist-row-text">
                      <strong>{item.song.title}</strong>
                      <small>{singer}{item.seconds ? ` · ${formatTrackLength(item.seconds)}` : ""}</small>
                    </span>
                  </button>
                  <span className="playlist-row-actions">
                    <button type="button" className="playlist-row-action" onClick={() => move(item.url, -1)} disabled={index === 0} aria-label={copy.playlist.moveUp} title={copy.playlist.moveUp}><ArrowUp size={14} aria-hidden="true" /></button>
                    <button type="button" className="playlist-row-action" onClick={() => move(item.url, 1)} disabled={index === items.length - 1} aria-label={copy.playlist.moveDown} title={copy.playlist.moveDown}><ArrowDown size={14} aria-hidden="true" /></button>
                    <button type="button" className="playlist-row-action" onClick={() => remove(item.url)} aria-label={copy.playlist.removeTrack.replace("{track}", item.song.title)} title={copy.playlist.removeTrack.replace("{track}", item.song.title)}><X size={14} aria-hidden="true" /></button>
                  </span>
                </li>
              );
            })}
          </ol>
          <button className="clear-history-button playlist-clear" type="button" onClick={() => { close(); clear(); }}><Trash2 size={13} aria-hidden="true" />{copy.playlist.clear}</button>
        </section>
      ) : (
        <section className="favorites-empty">
          <ListMusic size={23} aria-hidden="true" />
          <span className="eyebrow">{copy.playlist.emptyEyebrow}</span>
          <h2>{copy.playlist.emptyTitle}</h2>
          <p>{copy.playlist.emptyDetail}</p>
          <Link href={`/?recording=${WITH_RECORDINGS_FILTER}#library`} className="text-action">{copy.playlist.browseRecordings}</Link>
        </section>
      )}
    </div>
  );
}

export default function PlaylistPage() {
  return <AppShell><PlaylistContent /></AppShell>;
}
