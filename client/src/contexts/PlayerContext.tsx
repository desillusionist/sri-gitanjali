/**
 * One SoundCloud player for the whole app. It plays the playlist in order, survives moving
 * between pages, remembers the last recording, and can be hidden from the dock it lives in.
 */

import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getSongRecordings, soundCloudSegment, soundCloudTrackUrl, type SongRecording } from "@/domain/song";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useRecordingEdits } from "@/lib/recordingEdits";
import { createSegmentFollower, createSoundCloudWidget, loadSoundCloudWidgetApi, soundCloudPlayerSrc, SOUNDCLOUD_LOAD_OPTIONS, type SoundCloudWidget } from "@/lib/soundCloudWidget";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

const PLAYER_STORAGE_KEY = "kirtan-guide.player";

type StoredPlayer = { url: string | null; isOpen: boolean };

function readStoredPlayer(): StoredPlayer {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLAYER_STORAGE_KEY) ?? "null") as Partial<StoredPlayer> | null;
    return { url: typeof parsed?.url === "string" ? parsed.url : null, isOpen: parsed?.isOpen === true };
  } catch {
    return { url: null, isOpen: false };
  }
}

function storePlayer(player: StoredPlayer) {
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
  } catch {
    // Storage blocked: the player forgets its place after this visit.
  }
}

type PlayerContextValue = {
  /** Playlist entries whose songs are still in the book. */
  items: SongRecording[];
  current: SongRecording | null;
  currentIndex: number;
  isPlaying: boolean;
  isOpen: boolean;
  /** Address the dock's iframe starts with; later tracks are loaded into the same widget. */
  initialSrc: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** The widget playing in that iframe, once it is ready. */
  widget: SoundCloudWidget | null;
  play: (url: string) => void;
  step: (offset: -1 | 1) => boolean;
  togglePlay: () => void;
  open: () => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { songs } = useSongLibrary();
  const { tracks } = usePlaylist();
  // Recordings changed in the admin tools count at once.
  const edits = useRecordingEdits();
  const byUrl = useMemo(() => new Map(getSongRecordings(songs).map((recording) => [recording.url, recording])), [songs, edits]);
  const items = useMemo(() => tracks.map((url) => byUrl.get(url)).filter((item): item is SongRecording => Boolean(item)), [byUrl, tracks]);

  const [stored] = useState(readStoredPlayer);
  const [currentUrl, setCurrentUrl] = useState<string | null>(stored.url);
  const [isOpen, setIsOpen] = useState(stored.isOpen);
  const [isPlaying, setIsPlaying] = useState(false);
  const [initialSrc, setInitialSrc] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);
  const [widget, setWidget] = useState<SoundCloudWidget | null>(null);
  const followerRef = useRef<ReturnType<typeof createSegmentFollower> | null>(null);
  /** The first track is a part of a longer one: start playing it once the player is ready, at the part's start. */
  const startOnReadyRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // The remembered recording, or the first one when it has left the playlist.
  const current = items.find((item) => item.url === currentUrl) ?? items[0] ?? null;
  const currentIndex = current ? items.indexOf(current) : -1;
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    storePlayer({ url: current?.url ?? null, isOpen });
  }, [current?.url, isOpen]);

  // The iframe exists only while the dock is open, and starts on the current recording.
  const visible = isOpen && Boolean(current);
  useEffect(() => {
    if (!visible) {
      setInitialSrc(null);
      setIsPlaying(false);
      return;
    }
    setInitialSrc((src) => src ?? (currentRef.current ? soundCloudPlayerSrc(currentRef.current.url) : null));
  }, [visible]);

  const play = useCallback((url: string) => {
    setCurrentUrl(url);
    setIsOpen(true);
    const widget = widgetRef.current;
    const follower = followerRef.current;
    follower?.hold();
    // A part of a longer track: wait at its start before playing, as a jump right after playing starts can stop the sound on iPhones.
    const segment = soundCloudSegment(url);
    if (widget) widget.load(soundCloudTrackUrl(url), {
      ...SOUNDCLOUD_LOAD_OPTIONS,
      auto_play: !segment?.start,
      callback: () => {
        follower?.reset();
        if (!segment?.start) return;
        follower?.prepare(segment);
        widget.play();
      },
    });
    else {
      startOnReadyRef.current = Boolean(segment?.start);
      setInitialSrc(soundCloudPlayerSrc(url, !segment?.start));
    }
  }, []);

  const step = useCallback((offset: -1 | 1) => {
    const list = itemsRef.current;
    const index = currentRef.current ? list.indexOf(currentRef.current) : -1;
    const next = list[index + offset];
    if (next) play(next.url);
    return Boolean(next);
  }, [play]);

  const togglePlay = useCallback(() => {
    if (widgetRef.current) widgetRef.current.toggle();
    else if (currentRef.current) play(currentRef.current.url);
  }, [play]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    widgetRef.current?.pause();
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !initialSrc) return;
    let active = true;
    void loadSoundCloudWidgetApi().then((api) => {
      if (!active) return;
      const widget = createSoundCloudWidget(api, iframe);
      widgetRef.current = widget;
      setWidget(widget);
      // A recording that is one part of a longer track starts and ends there.
      const follower = createSegmentFollower(widget);
      followerRef.current = follower;
      const segment = () => (currentRef.current ? soundCloudSegment(currentRef.current.url) : null);
      const next = () => {
        if (!step(1)) setIsPlaying(false);
      };
      widget.bind(api.Widget.Events.PLAY, () => {
        setIsPlaying(true);
        follower.onPlay(segment());
      });
      widget.bind(api.Widget.Events.PLAY_PROGRESS, (event) => {
        if (!follower.onProgress(segment(), event?.currentPosition)) return;
        widget.pause();
        if (!step(1)) {
          setIsPlaying(false);
          follower.rewind(segment());
        }
      });
      widget.bind(api.Widget.Events.READY, () => {
        if (!startOnReadyRef.current) return;
        startOnReadyRef.current = false;
        follower.prepare(segment());
        widget.play();
      });
      widget.bind(api.Widget.Events.PAUSE, () => setIsPlaying(false));
      widget.bind(api.Widget.Events.FINISH, next);
    }).catch(() => {});
    return () => {
      active = false;
      widgetRef.current = null;
      followerRef.current = null;
      setWidget(null);
    };
  }, [initialSrc, step]);

  const value = useMemo<PlayerContextValue>(() => ({
    items, current, currentIndex, isPlaying, isOpen: visible, initialSrc, iframeRef, widget, play, step, togglePlay, open, close,
  }), [items, current, currentIndex, isPlaying, visible, initialSrc, widget, play, step, togglePlay, open, close]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}
