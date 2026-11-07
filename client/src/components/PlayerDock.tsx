/** The shared player, docked at the foot of every page while it is open. */

import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { ListMusic, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export function PlayerDock() {
  const { current, currentIndex, items, isOpen, isPlaying, initialSrc, iframeRef, step, togglePlay, close } = usePlayer();
  const { copy } = useTranslation();
  const [location] = useLocation();
  const shown = isOpen && current;

  // Pages leave room at the bottom so the dock never covers their last lines.
  useEffect(() => {
    document.documentElement.classList.toggle("has-player-dock", Boolean(shown));
    return () => document.documentElement.classList.remove("has-player-dock");
  }, [shown]);

  if (!shown) return null;
  const singer = current.singer ?? copy.playlist.unknownSinger;

  return (
    <aside className="player-dock" aria-label={copy.playlist.playerTitle}>
      <div className="player-dock-inner">
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
            {location !== "/playlist" && (
              <Link href="/playlist" className="playlist-control" aria-label={copy.navigation.playlist} title={copy.navigation.playlist}><ListMusic size={16} aria-hidden="true" /></Link>
            )}
            <button type="button" className="playlist-control" onClick={close} aria-label={copy.playlist.hidePlayer} title={copy.playlist.hidePlayer}><X size={16} aria-hidden="true" /></button>
          </div>
        </div>
        {initialSrc && <iframe ref={iframeRef} className="soundcloud-player player-dock-iframe" src={initialSrc} title={copy.playlist.playerTitle} allow="autoplay" />}
      </div>
    </aside>
  );
}
