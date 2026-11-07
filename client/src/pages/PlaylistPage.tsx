/**
 * The playlist: recordings gathered from the Recordings page and song pages,
 * played one after another by a single SoundCloud player.
 */

import { AppShell } from "@/components/AppShell";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { formatTrackLength, getSongRecordings, type SongRecording } from "@/domain/song";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useTranslation } from "@/i18n/LanguageContext";
import { loadSoundCloudWidgetApi, soundCloudPlayerSrc, SOUNDCLOUD_PLAYER_OPTIONS, type SoundCloudWidget } from "@/lib/soundCloudWidget";
import { ArrowDown, ArrowUp, ListMusic, SkipBack, SkipForward, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

function PlaylistContent() {
  const { songs, status } = useSongLibrary();
  const { copy } = useTranslation();
  const { tracks, remove, move, clear } = usePlaylist();
  const byUrl = useMemo(() => new Map(getSongRecordings(songs).map((recording) => [recording.url, recording])), [songs]);
  // Tracks whose song has left the book are skipped.
  const items = useMemo(() => tracks.map((url) => byUrl.get(url)).filter((item): item is SongRecording => Boolean(item)), [byUrl, tracks]);

  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const currentRef = useRef(currentUrl);
  currentRef.current = currentUrl;

  const current = items.find((item) => item.url === currentUrl) ?? items[0] ?? null;
  const currentIndex = current ? items.indexOf(current) : -1;
  // The iframe keeps its first address; later tracks are loaded into the same widget.
  const [initialSrc, setInitialSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!initialSrc && current) setInitialSrc(soundCloudPlayerSrc(current.url));
  }, [current, initialSrc]);

  useEffect(() => {
    if (!items.length) setInitialSrc(null);
  }, [items.length]);

  const playUrl = useCallback((url: string) => {
    setCurrentUrl(url);
    widgetRef.current?.load(url, { ...SOUNDCLOUD_PLAYER_OPTIONS, auto_play: true });
  }, []);

  const step = useCallback((offset: -1 | 1) => {
    const list = itemsRef.current;
    const index = list.findIndex((item) => item.url === (currentRef.current ?? list[0]?.url));
    const next = list[index + offset];
    if (next) playUrl(next.url);
    return Boolean(next);
  }, [playUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !initialSrc) return;
    let active = true;
    void loadSoundCloudWidgetApi().then((api) => {
      if (!active) return;
      const widget = api.Widget(iframe);
      widgetRef.current = widget;
      widget.bind(api.Widget.Events.PLAY, () => setIsPlaying(true));
      widget.bind(api.Widget.Events.PAUSE, () => setIsPlaying(false));
      widget.bind(api.Widget.Events.FINISH, () => {
        if (!step(1)) setIsPlaying(false);
      });
    }).catch(() => {});
    return () => {
      active = false;
      widgetRef.current = null;
    };
  }, [initialSrc, step]);

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
        <section className="playlist-section" aria-labelledby="playlist-heading">
          <div className="playlist-deck">
            <div className="playlist-now">
              <span className="eyebrow">{isPlaying ? copy.playlist.nowPlaying : copy.playlist.upNext}</span>
              <h2 id="playlist-heading"><Link href={`/song/${current.song.id}`}>{current.song.title}</Link></h2>
              <p>{current.singer ?? copy.recordings.unknownSinger}{current.seconds ? ` · ${formatTrackLength(current.seconds)}` : ""}</p>
            </div>
            <div className="playlist-controls">
              <button type="button" className="playlist-control" onClick={() => step(-1)} disabled={currentIndex <= 0} aria-label={copy.playlist.previous} title={copy.playlist.previous}><SkipBack size={17} aria-hidden="true" /></button>
              <button type="button" className="playlist-control" onClick={() => step(1)} disabled={currentIndex >= items.length - 1} aria-label={copy.playlist.next} title={copy.playlist.next}><SkipForward size={17} aria-hidden="true" /></button>
            </div>
            {initialSrc && <iframe ref={iframeRef} className="soundcloud-player playlist-player" src={initialSrc} title={copy.playlist.playerTitle} allow="autoplay" />}
            <p className="playlist-hint">{copy.playlist.hint}</p>
          </div>

          <ol className="audio-list playlist-list">
            {items.map((item, index) => {
              const singer = item.singer ?? copy.recordings.unknownSinger;
              const isCurrent = item.url === current.url;
              return (
                <li className={`audio-row playlist-row${isCurrent ? " is-current" : ""}`} key={item.url}>
                  <div className="audio-row-head">
                    <button className="audio-row-toggle" type="button" onClick={() => playUrl(item.url)} aria-current={isCurrent ? "true" : undefined} aria-label={copy.playlist.playTrack.replace("{track}", `${item.song.title} (${singer})`)}>
                      <span className="playlist-row-number">{isCurrent && isPlaying ? "♪" : index + 1}</span>
                      <span className="audio-row-title">{item.song.title}<small>{singer}</small></span>
                      {item.seconds ? <span className="audio-row-length">{formatTrackLength(item.seconds)}</span> : null}
                    </button>
                    <button type="button" className="playlist-row-action" onClick={() => move(item.url, -1)} disabled={index === 0} aria-label={copy.playlist.moveUp} title={copy.playlist.moveUp}><ArrowUp size={14} aria-hidden="true" /></button>
                    <button type="button" className="playlist-row-action" onClick={() => move(item.url, 1)} disabled={index === items.length - 1} aria-label={copy.playlist.moveDown} title={copy.playlist.moveDown}><ArrowDown size={14} aria-hidden="true" /></button>
                    <button type="button" className="playlist-row-action" onClick={() => remove(item.url)} aria-label={copy.playlist.removeTrack.replace("{track}", item.song.title)} title={copy.playlist.removeTrack.replace("{track}", item.song.title)}><X size={14} aria-hidden="true" /></button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button className="clear-history-button playlist-clear" type="button" onClick={() => { clear(); setCurrentUrl(null); setInitialSrc(null); }}><Trash2 size={13} aria-hidden="true" />{copy.playlist.clear}</button>
        </section>
      ) : (
        <section className="favorites-empty">
          <ListMusic size={23} aria-hidden="true" />
          <span className="eyebrow">{copy.playlist.emptyEyebrow}</span>
          <h2>{copy.playlist.emptyTitle}</h2>
          <p>{copy.playlist.emptyDetail}</p>
          <Link href="/recordings" className="text-action">{copy.playlist.browseRecordings}</Link>
        </section>
      )}
    </div>
  );
}

export default function PlaylistPage() {
  return <AppShell><PlaylistContent /></AppShell>;
}
