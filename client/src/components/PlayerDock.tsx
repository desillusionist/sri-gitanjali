/** The shared player, docked at the foot of every page while it is open, with the playlist in a drawer. */

import { usePlayer } from "@/contexts/PlayerContext";
import { formatTrackLength } from "@/domain/song";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useTranslation } from "@/i18n/LanguageContext";
import { ArrowRight, ChevronDown, ListMusic, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

export function PlayerDock() {
  const { current, currentIndex, items, isOpen, isPlaying, initialSrc, iframeRef, play, step, togglePlay, close } = usePlayer();
  const { remove } = usePlaylist();
  const { copy } = useTranslation();
  const [location] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const currentRowRef = useRef<HTMLLIElement>(null);
  const shown = isOpen && current;

  // Pages leave room at the bottom so the dock never covers their last lines.
  useEffect(() => {
    document.documentElement.classList.toggle("has-player-dock", Boolean(shown));
    return () => document.documentElement.classList.remove("has-player-dock");
  }, [shown]);

  // A new page closes the drawer.
  useEffect(() => setIsDrawerOpen(false), [location]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    currentRowRef.current?.scrollIntoView({ block: "nearest" });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsDrawerOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  if (!shown) return null;
  const singer = current.singer ?? copy.playlist.unknownSinger;
  const drawerLabel = isDrawerOpen ? copy.playlist.hideDrawer : copy.playlist.showDrawer;

  return (
    <aside className={`player-dock${isDrawerOpen ? " has-drawer" : ""}`} aria-label={copy.playlist.playerTitle}>
      <div className="player-dock-inner">
        {isDrawerOpen && (
          <div className="player-drawer" id="player-drawer">
            <div className="player-drawer-head">
              <span className="eyebrow">{copy.navigation.playlist} · {items.length}</span>
              {location !== "/playlist" && (
                <Link href="/playlist" className="player-drawer-page-link">{copy.playlist.openPage}<ArrowRight size={13} aria-hidden="true" /></Link>
              )}
            </div>
            <ol className="player-drawer-list">
              {items.map((item, index) => {
                const isCurrent = item.url === current.url;
                const itemSinger = item.singer ?? copy.playlist.unknownSinger;
                return (
                  <li key={item.url} ref={isCurrent ? currentRowRef : undefined} className={`player-drawer-row${isCurrent ? " is-current" : ""}`}>
                    <button type="button" className="player-drawer-play" onClick={() => play(item.url)} aria-current={isCurrent ? "true" : undefined} aria-label={copy.playlist.playTrack.replace("{track}", `${item.song.title} (${itemSinger})`)}>
                      <span className="player-drawer-number" aria-hidden="true">{isCurrent && isPlaying ? "♪" : index + 1}</span>
                      <span className="player-drawer-text">
                        <strong>{item.song.title}</strong>
                        <small>{itemSinger}{item.seconds ? ` · ${formatTrackLength(item.seconds)}` : ""}</small>
                      </span>
                    </button>
                    <button type="button" className="playlist-row-action" onClick={() => remove(item.url)} aria-label={copy.playlist.removeTrack.replace("{track}", item.song.title)} title={copy.playlist.removeTrack.replace("{track}", item.song.title)}><X size={13} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <div className="player-dock-head">
          <div className="player-dock-now">
            <Link href={`/song/${current.song.id}`} className="player-dock-title">{current.song.title}</Link>
            <small>{singer} · {currentIndex + 1}/{items.length}</small>
          </div>
          <div className="player-dock-controls">
            <button type="button" className="playlist-control" onClick={() => step(-1)} disabled={currentIndex <= 0} aria-label={copy.playlist.previous} title={copy.playlist.previous}><SkipBack size={16} aria-hidden="true" /></button>
            <button type="button" className="playlist-control is-primary" onClick={togglePlay} aria-label={isPlaying ? copy.playlist.pause : copy.playlist.play} title={isPlaying ? copy.playlist.pause : copy.playlist.play}>
              {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            </button>
            <button type="button" className="playlist-control" onClick={() => step(1)} disabled={currentIndex >= items.length - 1} aria-label={copy.playlist.next} title={copy.playlist.next}><SkipForward size={16} aria-hidden="true" /></button>
            <button type="button" className={`playlist-control${isDrawerOpen ? " is-active" : ""}`} onClick={() => setIsDrawerOpen((open) => !open)} aria-expanded={isDrawerOpen} aria-controls="player-drawer" aria-label={drawerLabel} title={drawerLabel}>
              {isDrawerOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ListMusic size={16} aria-hidden="true" />}
            </button>
            <button type="button" className="playlist-control" onClick={close} aria-label={copy.playlist.hidePlayer} title={copy.playlist.hidePlayer}><X size={16} aria-hidden="true" /></button>
          </div>
        </div>
        {initialSrc && <iframe ref={iframeRef} className="soundcloud-player player-dock-iframe" src={initialSrc} title={copy.playlist.playerTitle} allow="autoplay" />}
      </div>
    </aside>
  );
}
