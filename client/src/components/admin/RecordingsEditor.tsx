/**
 * The admin's editor for a song's SoundCloud recordings: add a link, remove one, change the order,
 * pick the singer, and mark the part of a longer track the song is (start and end, by ear with the
 * player). "Next song from this track" gives the following part of the same track to another song.
 * Saving keeps the changes on this device until Publish.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, ListPlus, Minus, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { SoundCloudBar } from "@/components/SoundCloudBar";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { formatTrackLength, getSoundCloudRecordingUrls, soundCloudSegment, soundCloudSingerId, soundCloudSingers, soundCloudTrackSecondsFor, soundCloudTrackUrl, textMatchesQuery, type Song } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { setRecordings } from "@/lib/admin/drafts";
import { soundCloudTrackPath, type RecordingEdits } from "@/lib/recordingEdits";
import { inspectSoundCloudTrack, loadSoundCloudWidgetApi, soundCloudPlayerSrc, type SoundCloudWidget } from "@/lib/soundCloudWidget";

let openSongId: string | null = null;
const listeners = new Set<() => void>();
export function openRecordingsEditor(songId: string) {
  openSongId = songId;
  listeners.forEach((listener) => listener());
}
function closeRecordingsEditor() {
  openSongId = null;
  listeners.forEach((listener) => listener());
}
const useOpenSongId = () => useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => openSongId, () => null);

export function RecordingsEditor() {
  const songId = useOpenSongId();
  const { songs } = useSongLibrary();
  const song = songs.find((candidate) => candidate.id === songId);
  return song ? <RecordingsEditorDialog key={song.id} firstSong={song} songs={songs} /> : null;
}

/** "1:06" or "1:02:03" → seconds; null when not a time. */
export function parseTime(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

/** A recording's address with its part: the whole track when neither time is set. */
export function withPart(url: string, start: number | null, end: number | null): string {
  const track = soundCloudTrackUrl(url);
  if (!start && end === null) return track;
  return `${track}#t=${formatTrackLength(start ?? 0)}${end !== null ? `-${formatTrackLength(end)}` : ""}`;
}

const slug = (name: string) => name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function RecordingsEditorDialog({ firstSong, songs }: { firstSong: Song; songs: Song[] }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const [songId, setSongId] = useState(firstSong.id);
  const original = useMemo(() => new Map<string, string[]>(), []);
  const [lists, setLists] = useState<Record<string, string[]>>(() => ({ [firstSong.id]: getSoundCloudRecordingUrls(firstSong) }));
  const [tracks, setTracks] = useState<RecordingEdits["tracks"]>({});
  const [singers, setSingers] = useState<RecordingEdits["singers"]>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const song = songs.find((candidate) => candidate.id === songId) ?? firstSong;
  const listOf = (id: string) => lists[id] ?? getSoundCloudRecordingUrls(songs.find((candidate) => candidate.id === id) ?? { audioLinks: [] });
  const list = listOf(songId);
  if (!original.has(firstSong.id)) original.set(firstSong.id, getSoundCloudRecordingUrls(firstSong));

  const setList = (id: string, next: string[]) => {
    if (!original.has(id)) original.set(id, listOf(id));
    setLists((all) => ({ ...all, [id]: next }));
  };
  const singerOptions = [...soundCloudSingers(), ...Object.entries(singers).map(([id, name]) => ({ id, name }))].filter((singer, index, all) => all.findIndex((other) => other.id === singer.id) === index);
  const singerIdOf = (url: string) => tracks[soundCloudTrackPath(url) ?? ""]?.singer ?? soundCloudSingerId(url);
  const singerNameOf = (url: string) => singerOptions.find((singer) => singer.id === singerIdOf(url))?.name ?? t.recordingUnknownSinger;
  const secondsOf = (url: string) => {
    const whole = tracks[soundCloudTrackPath(url) ?? ""]?.seconds ?? soundCloudTrackSecondsFor(soundCloudTrackUrl(url));
    const segment = soundCloudSegment(url);
    if (!segment) return whole;
    const end = segment.end ?? whole;
    return end === null ? null : end - segment.start;
  };

  const move = (index: number, step: -1 | 1) => {
    const next = [...list];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setList(songId, next);
    if (selected === index) setSelected(index + step);
  };
  const remove = (index: number) => {
    setList(songId, list.filter((_, other) => other !== index));
    setSelected(null);
  };

  const add = async () => {
    if (!link.trim()) return;
    setStatus({ text: t.recordingAdding });
    try {
      const track = await inspectSoundCloudTrack(link);
      if (!track) {
        setStatus({ text: t.recordingNotFound, error: true });
        return;
      }
      const path = soundCloudTrackPath(track.url);
      if (path) setTracks((all) => ({ ...all, [path]: { ...all[path], ...(track.seconds ? { seconds: track.seconds } : {}) } }));
      setList(songId, [...list, track.url]);
      setSelected(list.length);
      setLink("");
      setStatus(null);
    } catch {
      setStatus({ text: t.recordingNotFound, error: true });
    }
  };

  const save = () => {
    const changed = Object.fromEntries(Object.entries(lists).filter(([id, urls]) => JSON.stringify(urls) !== JSON.stringify(original.get(id))));
    const used = new Set(Object.values(lists).flat().map(soundCloudTrackPath));
    const keptTracks = Object.fromEntries(Object.entries(tracks).filter(([path]) => used.has(path)));
    if (Object.keys(changed).length || Object.keys(keptTracks).length) {
      // A singer or length change on a track counts as a change of the song that uses it.
      for (const id of Object.keys(lists)) if (!changed[id] && lists[id].some((url) => keptTracks[soundCloudTrackPath(url) ?? ""])) changed[id] = lists[id];
      setRecordings(changed, keptTracks, singers);
    }
    closeRecordingsEditor();
  };

  const touchedOthers = Object.keys(lists).filter((id) => id !== songId && JSON.stringify(lists[id]) !== JSON.stringify(original.get(id)));

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.editRecordings}>
      <div className="crop-editor-panel admin-recordings">
        <header>
          <strong>{t.editRecordings} · {song.title}</strong>
          <button type="button" className="crop-editor-icon" onClick={closeRecordingsEditor} aria-label={copy.portraitCrops.cancel}><X size={18} /></button>
        </header>
        {touchedOthers.length > 0 && (
          <p className="admin-pictures-note">
            {t.recordingsAlsoChanged}{" "}
            {[firstSong.id, ...touchedOthers].filter((id, index, all) => all.indexOf(id) === index && id !== songId).map((id) => (
              <button key={id} type="button" className="admin-recordings-song-link" onClick={() => { setSongId(id); setSelected(null); }}>{songs.find((candidate) => candidate.id === id)?.title ?? id}</button>
            ))}
          </p>
        )}
        {list.length ? (
          <ol className="admin-recordings-list">
            {list.map((url, index) => {
              const segment = soundCloudSegment(url);
              const seconds = secondsOf(url);
              return (
                <li key={index} className={selected === index ? "is-selected" : undefined}>
                  <button type="button" className="admin-recordings-row" onClick={() => setSelected(selected === index ? null : index)} aria-expanded={selected === index}>
                    <strong>{singerNameOf(url)}</strong>
                    <small>
                      {segment ? `${formatTrackLength(segment.start)}–${segment.end !== null ? formatTrackLength(segment.end) : t.recordingTrackEnd}` : t.recordingWholeTrack}
                      {seconds ? ` · ${formatTrackLength(seconds)}` : ""}
                      {" · "}{soundCloudTrackPath(url)}
                    </small>
                  </button>
                  <span className="admin-recordings-actions">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.recordingMoveUp} title={t.recordingMoveUp}><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === list.length - 1} aria-label={t.recordingMoveDown} title={t.recordingMoveDown}><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => setSelected(selected === index ? null : index)} aria-label={t.recordingEdit} title={t.recordingEdit}><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(index)} aria-label={t.recordingRemove} title={t.recordingRemove}><Trash2 size={14} /></button>
                  </span>
                  {selected === index && (
                    <RecordingDetail
                      url={url}
                      wholeSeconds={tracks[soundCloudTrackPath(url) ?? ""]?.seconds ?? soundCloudTrackSecondsFor(soundCloudTrackUrl(url))}
                      singerId={singerIdOf(url)}
                      singerOptions={singerOptions}
                      songs={songs}
                      currentSongId={songId}
                      onChange={(next) => setList(songId, list.map((other, otherIndex) => (otherIndex === index ? next : other)))}
                      onSinger={(id, name) => {
                        const path = soundCloudTrackPath(url);
                        if (!path) return;
                        if (name) setSingers((all) => ({ ...all, [id]: name }));
                        setTracks((all) => ({ ...all, [path]: { ...all[path], singer: id } }));
                      }}
                      onNextSong={(nextSongId, nextUrl) => {
                        const nextList = listOf(nextSongId);
                        setSongId(nextSongId);
                        // That song may already have its part of this track: open it instead of adding another.
                        const existing = nextList.findIndex((other) => soundCloudTrackUrl(other) === soundCloudTrackUrl(nextUrl));
                        if (existing >= 0) {
                          setSelected(existing);
                          return;
                        }
                        setList(nextSongId, [...nextList, nextUrl]);
                        setSelected(nextList.length);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        ) : <p className="admin-pictures-note">{t.recordingsNone}</p>}
        <form className="admin-recordings-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <input type="url" inputMode="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder={t.recordingLinkPlaceholder} aria-label={t.recordingLinkPlaceholder} />
          <button type="submit" disabled={!link.trim() || status?.text === t.recordingAdding}><Plus size={14} aria-hidden="true" />{t.recordingAdd}</button>
        </form>
        {status && <p className={`admin-pictures-note${status.error ? " is-error" : ""}`} role="status">{status.text}</p>}
        <p className="admin-pictures-note">{t.recordingsHint}</p>
        <div className="crop-editor-actions">
          <button type="button" onClick={closeRecordingsEditor}>{copy.portraitCrops.cancel}</button>
          <button type="button" className="is-primary" onClick={save}>{copy.portraitCrops.save}</button>
        </div>
      </div>
    </div>
  );
}

type DetailProps = {
  url: string;
  wholeSeconds: number | null;
  singerId: string | null;
  singerOptions: { id: string; name: string }[];
  songs: Song[];
  currentSongId: string;
  onChange: (url: string) => void;
  onSinger: (id: string, newName?: string) => void;
  onNextSong: (songId: string, url: string) => void;
};

const NEW_SINGER = "__new__";

/** One recording opened in the editor: its player over the whole track, the part's marks, its singer. */
function RecordingDetail({ url, wholeSeconds, singerId, singerOptions, songs, currentSongId, onChange, onSinger, onNextSong }: DetailProps) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [widget, setWidget] = useState<SoundCloudWidget | null>(null);
  const positionRef = useRef(0);
  const partEndRef = useRef<number | null>(null);
  const segment = soundCloudSegment(url);
  const [start, setStart] = useState(segment ? formatTrackLength(segment.start) : "");
  const [end, setEnd] = useState(segment?.end != null ? formatTrackLength(segment.end) : "");
  const [newSinger, setNewSinger] = useState<string | null>(null);
  const [nextQuery, setNextQuery] = useState<string | null>(null);
  const trackUrl = soundCloudTrackUrl(url);
  const src = useMemo(() => soundCloudPlayerSrc(trackUrl), [trackUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let active = true;
    void loadSoundCloudWidgetApi().then((api) => {
      if (!active) return;
      const next = api.Widget(iframe);
      next.bind(api.Widget.Events.READY, () => active && setWidget(next));
    }).catch(() => {});
    return () => {
      active = false;
      setWidget(null);
    };
  }, [src]);

  const startSeconds = start.trim() ? parseTime(start) : 0;
  const endSeconds = end.trim() ? parseTime(end) : null;
  const isValid = startSeconds !== null && (!end.trim() || (endSeconds !== null && endSeconds > startSeconds)) && (wholeSeconds === null || (endSeconds ?? 0) <= wholeSeconds);

  // Each change of the marks goes into the list at once, when the times make sense.
  const apply = (nextStart: string, nextEnd: string) => {
    setStart(nextStart);
    setEnd(nextEnd);
    const from = nextStart.trim() ? parseTime(nextStart) : 0;
    const to = nextEnd.trim() ? parseTime(nextEnd) : null;
    if (from === null || (nextEnd.trim() && (to === null || to <= from))) return;
    onChange(withPart(url, from, to));
  };
  const now = () => formatTrackLength(Math.floor(positionRef.current / 1000));
  const nudge = (value: string, step: number) => formatTrackLength(Math.max(0, (parseTime(value) ?? 0) + step));
  const playPart = () => {
    if (!widget) return;
    partEndRef.current = endSeconds;
    widget.seekTo((startSeconds ?? 0) * 1000);
    widget.play();
  };

  const matches = nextQuery?.trim() ? songs.filter((candidate) => candidate.id !== currentSongId && textMatchesQuery(`${candidate.title} ${candidate.verses[0]?.lines[0]?.transliteration ?? ""}`, nextQuery)).slice(0, 8) : [];

  return (
    <div className="admin-recording-detail">
      <iframe ref={iframeRef} className="soundcloud-player is-duration-probe" src={src} title="" aria-hidden="true" tabIndex={-1} allow="autoplay" />
      <SoundCloudBar
        widget={widget}
        url={url}
        wholeTrack
        marks={{ start: startSeconds || null, end: endSeconds }}
        onPosition={(milliseconds) => {
          positionRef.current = milliseconds;
          if (partEndRef.current !== null && milliseconds >= partEndRef.current * 1000) {
            partEndRef.current = null;
            widget?.pause();
          }
        }}
      />
      <div className="admin-recording-marks">
        <label>
          <span>{t.recordingStart}</span>
          <span className="admin-recording-time">
            <button type="button" onClick={() => apply(nudge(start, -1), end)} aria-label={t.recordingEarlier}><Minus size={12} /></button>
            <input value={start} onChange={(event) => apply(event.target.value, end)} placeholder="0:00" inputMode="numeric" />
            <button type="button" onClick={() => apply(nudge(start, 1), end)} aria-label={t.recordingLater}><Plus size={12} /></button>
          </span>
          <button type="button" className="admin-recording-here" onClick={() => apply(now(), end)}>{t.recordingSetHere}</button>
        </label>
        <label>
          <span>{t.recordingEnd}</span>
          <span className="admin-recording-time">
            <button type="button" onClick={() => apply(start, nudge(end, -1))} aria-label={t.recordingEarlier}><Minus size={12} /></button>
            <input value={end} onChange={(event) => apply(start, event.target.value)} placeholder={t.recordingTrackEnd} inputMode="numeric" />
            <button type="button" onClick={() => apply(start, nudge(end, 1))} aria-label={t.recordingLater}><Plus size={12} /></button>
          </span>
          <button type="button" className="admin-recording-here" onClick={() => apply(start, now())}>{t.recordingSetHere}</button>
        </label>
      </div>
      {!isValid && <p className="admin-pictures-note is-error">{t.recordingBadTimes}</p>}
      <div className="admin-recording-buttons">
        <button type="button" onClick={playPart} disabled={!widget || !isValid}><Play size={13} aria-hidden="true" />{t.recordingPlayPart}</button>
        {(start || end) && <button type="button" onClick={() => apply("", "")}>{t.recordingWholeTrack}</button>}
        {endSeconds !== null && isValid && <button type="button" onClick={() => setNextQuery(nextQuery === null ? "" : null)} aria-expanded={nextQuery !== null}><ListPlus size={13} aria-hidden="true" />{t.recordingNextSong}</button>}
      </div>
      {nextQuery !== null && endSeconds !== null && (
        <div className="admin-recording-next">
          <input value={nextQuery} onChange={(event) => setNextQuery(event.target.value)} placeholder={t.recordingNextSongSearch} aria-label={t.recordingNextSongSearch} autoFocus />
          {matches.length > 0 && (
            <ul>
              {matches.map((candidate) => (
                <li key={candidate.id}>
                  <button type="button" onClick={() => onNextSong(candidate.id, withPart(url, endSeconds, null))}>
                    <strong>{candidate.title}</strong>
                    <small>{candidate.verses[0]?.lines[0]?.transliteration}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <label className="admin-recording-singer">
        <span>{t.recordingSinger}</span>
        <select
          value={newSinger !== null ? NEW_SINGER : singerId ?? ""}
          onChange={(event) => {
            if (event.target.value === NEW_SINGER) setNewSinger("");
            else {
              setNewSinger(null);
              onSinger(event.target.value);
            }
          }}
        >
          {!singerOptions.some((singer) => singer.id === singerId) && <option value={singerId ?? ""}>{t.recordingUnknownSinger}</option>}
          {singerOptions.map((singer) => <option key={singer.id} value={singer.id}>{singer.name}</option>)}
          <option value={NEW_SINGER}>{t.recordingNewSinger}</option>
        </select>
      </label>
      {newSinger !== null && (
        <form className="admin-recordings-add" onSubmit={(event) => {
          event.preventDefault();
          const name = newSinger.trim();
          const id = slug(name);
          if (!id) return;
          onSinger(id, name);
          setNewSinger(null);
        }}>
          <input value={newSinger} onChange={(event) => setNewSinger(event.target.value)} placeholder={t.recordingNewSingerName} aria-label={t.recordingNewSingerName} autoFocus />
          <button type="submit" disabled={!slug(newSinger)}>{t.recordingAddSinger}</button>
        </form>
      )}
    </div>
  );
}
