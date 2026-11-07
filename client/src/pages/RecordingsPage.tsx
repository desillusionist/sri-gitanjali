/**
 * Every SoundCloud recording in the book on one page: each opens SoundCloud's
 * one-line player in place, and any of them can go into the playlist.
 */

import { AppShell } from "@/components/AppShell";
import { PlaylistToggleButton } from "@/components/PlaylistToggleButton";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { formatTrackLength, getSongRecordings, normalizeSearchText, SOUNDCLOUD_SINGER_LIST, type SongRecording } from "@/domain/song";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useTranslation } from "@/i18n/LanguageContext";
import { soundCloudPlayerSrc } from "@/lib/soundCloudWidget";
import { ChevronRight, ListMusic, ListPlus, Search, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const ALL_SINGERS = "all";

export function RecordingRow({ recording, isOpen, onToggle, unknownSinger }: { recording: SongRecording; isOpen: boolean; onToggle: () => void; unknownSinger: string }) {
  const { copy } = useTranslation();
  const playerId = `recording-player-${recording.url.replace(/[^a-z0-9]+/gi, "-")}`;
  const singer = recording.singer ?? unknownSinger;
  return (
    <li className={`audio-row recording-row${isOpen ? " is-open" : ""}`}>
      <div className="audio-row-head">
        <button className="audio-row-toggle" type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={playerId}>
          <ChevronRight className="audio-row-chevron" size={15} aria-hidden="true" />
          <span className="audio-row-note" aria-hidden="true">♪</span>
          <span className="audio-row-title">{recording.song.title}<small>{singer}</small></span>
          {recording.seconds ? <span className="audio-row-length">{formatTrackLength(recording.seconds)}</span> : null}
        </button>
        <PlaylistToggleButton url={recording.url} label={`${recording.song.title} (${singer})`} />
      </div>
      {isOpen && (
        <div className="audio-row-player">
          <iframe
            id={playerId}
            className="soundcloud-player"
            src={soundCloudPlayerSrc(recording.url)}
            title={copy.song.soundCloudPlayerTitle.replace("{song}", recording.song.title)}
            allow="autoplay"
          />
          <Link className="recording-song-link" href={`/song/${recording.song.id}`}>{copy.recordings.openSong}</Link>
        </div>
      )}
    </li>
  );
}

function RecordingsContent() {
  const { songs, status } = useSongLibrary();
  const { copy } = useTranslation();
  const { tracks, addMany } = usePlaylist();
  const [query, setQuery] = useState("");
  const [singer, setSinger] = useState(ALL_SINGERS);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const recordings = useMemo(() => getSongRecordings(songs), [songs]);
  const shown = useMemo(() => {
    const normalized = normalizeSearchText(query);
    return recordings.filter((recording) =>
      (singer === ALL_SINGERS || recording.url.includes(`soundcloud.com/${singer}/`))
      && (!normalized || normalizeSearchText(`${recording.song.title} ${recording.singer ?? ""} ${recording.song.poet ?? ""}`).includes(normalized)));
  }, [query, recordings, singer]);
  const notInPlaylist = shown.filter((recording) => !tracks.includes(recording.url));

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>{copy.song.opening}</p>
      </section>
    );
  }

  return (
    <div className="favorites-page recordings-page">
      <header className="favorites-header">
        <span className="eyebrow">{copy.recordings.eyebrow}</span>
        <h1>{copy.recordings.title}<br /><em>{copy.recordings.titleEmphasis}</em></h1>
        <p>{copy.recordings.lede}</p>
        <div className="favorites-count">
          <Volume2 size={18} />
          <strong>{recordings.length}</strong>
          <span>{copy.recordings.count}</span>
        </div>
      </header>

      <section className="recordings-section" aria-labelledby="recordings-heading">
        <div className="recordings-toolbar">
          <h2 id="recordings-heading" className="sr-only">{copy.recordings.title}</h2>
          <label className="recordings-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.recordings.searchPlaceholder} aria-label={copy.recordings.searchPlaceholder} />
          </label>
          <div className="recordings-singers" role="group" aria-label={copy.recordings.singersLabel}>
            {[{ account: ALL_SINGERS, name: copy.recordings.allSingers }, ...SOUNDCLOUD_SINGER_LIST].map((option) => (
              <button key={option.account} type="button" className={`recordings-singer${singer === option.account ? " is-active" : ""}`} aria-pressed={singer === option.account} onClick={() => setSinger(option.account)}>{option.name}</button>
            ))}
          </div>
          <button className="text-action recordings-add-all" type="button" disabled={!notInPlaylist.length} onClick={() => addMany(notInPlaylist.map((recording) => recording.url))}>
            <ListPlus size={15} aria-hidden="true" />{copy.recordings.addAll.replace("{count}", String(notInPlaylist.length))}
          </button>
          <Link className="text-action" href="/playlist"><ListMusic size={15} aria-hidden="true" />{copy.recordings.openPlaylist.replace("{count}", String(tracks.length))}</Link>
        </div>
        {shown.length ? (
          <ul className="audio-list recordings-list">
            {shown.map((recording) => (
              <RecordingRow
                key={recording.url}
                recording={recording}
                isOpen={openUrl === recording.url}
                onToggle={() => setOpenUrl((current) => (current === recording.url ? null : recording.url))}
                unknownSinger={copy.recordings.unknownSinger}
              />
            ))}
          </ul>
        ) : <p className="recordings-empty">{copy.recordings.noMatches}</p>}
      </section>
    </div>
  );
}

export default function RecordingsPage() {
  return <AppShell><RecordingsContent /></AppShell>;
}
