/**
 * A slim player bar for a SoundCloud recording: play/pause, the track's waveform (always shown, not
 * only while playing), the time, and SoundCloud's cloud linking to the track. SoundCloud's own
 * widget plays the sound in a hidden frame; this bar drives it through the widget API.
 * A recording that is one part of a longer track shows just that part, unless `wholeTrack`.
 */

import { formatTrackLength, soundCloudPageUrl, soundCloudSegment, soundCloudTrackUrl } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { loadSoundCloudWaveform, type SoundCloudWidget } from "@/lib/soundCloudWidget";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const BARS = 96;
const POLL_MS = 250;

type Props = {
  widget: SoundCloudWidget | null;
  /** The recording's address: the track, with its part ("#t=…") if it has one. */
  url: string;
  showPlayButton?: boolean;
  /** Show the whole track even when the recording is a part of it (the admin's editor). */
  wholeTrack?: boolean;
  /** Start and end marks to draw over a whole track, in seconds. */
  marks?: { start: number | null; end: number | null };
  /** The play position in milliseconds, as it changes. */
  onPosition?: (milliseconds: number) => void;
  className?: string;
};

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
};

export function SoundCloudBar({ widget, url, showPlayButton = true, wholeTrack = false, marks, onPosition, className = "" }: Props) {
  const { copy } = useTranslation();
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [samples, setSamples] = useState<number[] | null>(null);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;
  const trackPath = pathOf(soundCloudTrackUrl(url));

  // Follow the widget: where it is, whether it plays, and (once per track) its length and waveform.
  useEffect(() => {
    if (!widget) return;
    let active = true;
    let soundRead = false;
    let tries = 0;
    setSamples(null);
    setDuration(0);
    const poll = () => {
      widget.getPosition((milliseconds) => {
        if (!active || !Number.isFinite(milliseconds)) return;
        setPosition(milliseconds);
        onPositionRef.current?.(milliseconds);
      });
      widget.isPaused((paused) => active && setIsPlaying(!paused));
      if (soundRead) return;
      widget.getCurrentSound((sound) => {
        if (!active || soundRead || !sound) return;
        tries += 1;
        // Right after loading another track the widget may still report the last one.
        const permalink = pathOf(sound.permalink_url ?? "");
        if (trackPath && permalink && permalink !== trackPath && !trackPath.startsWith("/tracks") && tries < 20) return;
        soundRead = true;
        const total = sound.full_duration ?? sound.duration ?? 0;
        if (total > 0) setDuration(total);
        if (sound.waveform_url) void loadSoundCloudWaveform(sound.waveform_url).then((values) => active && setSamples(values));
      });
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [widget, trackPath]);

  const segment = wholeTrack ? null : soundCloudSegment(url);
  const windowStart = (segment?.start ?? 0) * 1000;
  const windowEnd = segment?.end != null ? segment.end * 1000 : duration;
  const span = Math.max(1, windowEnd - windowStart);
  const shown = Math.min(Math.max(position - windowStart, 0), span);
  const ready = Boolean(widget && duration);

  // The waveform of the shown window, as bars of 0–1.
  const bars = Array.from({ length: BARS }, (_, index) => {
    if (!samples || !duration) return 0.08;
    const from = windowStart + (span * index) / BARS;
    const to = windowStart + (span * (index + 1)) / BARS;
    const first = Math.floor((from / duration) * samples.length);
    const last = Math.max(first + 1, Math.ceil((to / duration) * samples.length));
    let peak = 0;
    for (let sample = first; sample < last && sample < samples.length; sample += 1) peak = Math.max(peak, samples[sample]);
    return Math.max(0.06, peak);
  });
  const playedBars = (shown / span) * BARS;
  const markAt = (seconds: number | null | undefined) => (seconds == null || !duration ? null : ((seconds * 1000 - windowStart) / span) * BARS);
  const startMark = markAt(marks?.start);
  const endMark = markAt(marks?.end);
  const outside = (index: number) => (startMark !== null && index + 1 <= startMark) || (endMark !== null && index >= endMark);

  // Play or pause as the button shows. On iPhones the first play can stop right after it starts:
  // when the reader asked to play and the sound stopped on its own, ask once more.
  const wantsPlayRef = useRef(false);
  useEffect(() => () => { wantsPlayRef.current = false; }, [widget]);
  const togglePlay = () => {
    if (!widget) return;
    if (isPlaying) {
      wantsPlayRef.current = false;
      widget.pause();
      setIsPlaying(false);
      return;
    }
    wantsPlayRef.current = true;
    widget.play();
    setIsPlaying(true);
    window.setTimeout(() => {
      if (!wantsPlayRef.current) return;
      widget.isPaused((paused) => {
        if (paused && wantsPlayRef.current) widget.play();
        wantsPlayRef.current = false;
      });
    }, 1500);
  };

  const seekFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!widget || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    widget.seekTo(windowStart + fraction * span);
    setPosition(windowStart + fraction * span);
  };

  return (
    <div className={`sc-bar${ready ? "" : " is-loading"} ${className}`.trim()}>
      {showPlayButton && (
        <button type="button" className="sc-bar-play" onClick={togglePlay} disabled={!widget} aria-label={isPlaying ? copy.playlist.pause : copy.playlist.play} title={isPlaying ? copy.playlist.pause : copy.playlist.play}>
          {isPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
      )}
      <span className="sc-bar-time" aria-label={copy.song.audioPosition}>{formatTrackLength(Math.floor(shown / 1000))}</span>
      <svg
        className="sc-bar-wave"
        viewBox={`0 0 ${BARS} 20`}
        preserveAspectRatio="none"
        role="slider"
        aria-label={copy.song.audioSeek}
        aria-valuemin={0}
        aria-valuemax={Math.round(span / 1000)}
        aria-valuenow={Math.round(shown / 1000)}
        tabIndex={ready ? 0 : -1}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); seekFromPointer(event); }}
        onPointerMove={(event) => { if (event.buttons) seekFromPointer(event); }}
        onKeyDown={(event) => {
          if (!widget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          widget.seekTo(Math.min(windowEnd, Math.max(windowStart, position + (event.key === "ArrowRight" ? 5000 : -5000))));
        }}
      >
        {bars.map((height, index) => (
          <rect
            key={index}
            x={index + 0.15}
            width={0.7}
            y={10 - height * 10}
            height={height * 20}
            className={outside(index) ? "is-outside" : index < playedBars ? "is-played" : undefined}
          />
        ))}
        {startMark !== null && <line className="sc-bar-mark" x1={startMark} x2={startMark} y1={0} y2={20} />}
        {endMark !== null && <line className="sc-bar-mark" x1={endMark} x2={endMark} y1={0} y2={20} />}
      </svg>
      <span className="sc-bar-time is-total">{duration ? formatTrackLength(Math.round(span / 1000)) : "–:––"}</span>
      <a className="sc-bar-cloud" href={soundCloudPageUrl(url)} target="_blank" rel="noreferrer" onClick={() => { wantsPlayRef.current = false; widget?.pause(); }} aria-label={copy.song.openAudioOnSoundCloud} title={copy.song.openAudioOnSoundCloud}>
        <svg viewBox="0 0 32 16" aria-hidden="true">
          <path d="M14 3.2c.9-.5 2-.8 3.1-.8 3.5 0 6.4 2.6 6.8 6 .3-.1.7-.2 1.1-.2 2.2 0 4 1.7 4 3.9S27.2 16 25 16H14V3.2z" />
          <rect x="11.6" y="4" width="1.2" height="12" rx=".6" />
          <rect x="9.2" y="5.5" width="1.2" height="10.5" rx=".6" />
          <rect x="6.8" y="7" width="1.2" height="9" rx=".6" />
          <rect x="4.4" y="8.5" width="1.2" height="7.5" rx=".6" />
          <rect x="2" y="10" width="1.2" height="6" rx=".6" />
        </svg>
      </a>
    </div>
  );
}
