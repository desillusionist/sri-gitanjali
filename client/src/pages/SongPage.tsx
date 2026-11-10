/**
 * Паломнический свиток: страница песни строится как развёрнутый лист,
 * где текст и ритм куплетов остаются главным визуальным объектом; при
 * доступной записи SoundCloud tempo бережно подстраивается под её длительность,
 * но ручная перемотка и настройка темпа всегда остаются под рукой.
 */

import { AppShell } from "@/components/AppShell";
import { WordForWordText } from "@/components/WordForWordText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HolyNameText } from "@/components/HolyNameText";
import songNotesByLanguage from "@/data/song-notes-i18n.json";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { getHighlightParts, getSongSearchMatches, getSoundCloudRecordingUrls, soundCloudSingerName, soundCloudTrackSecondsFor, formatTrackLength, hideSecondarySongOrnamentsInLines, normalizeSearchText, songFirstLine, type SongSearchMatch } from "@/domain/song";
import { useTranslation } from "@/i18n/LanguageContext";
import { useTeleprompter } from "@/hooks/useTeleprompter";
import { useTeleprompterGestures } from "@/hooks/useTeleprompterGestures";
import { READING_PREFERENCES_STORAGE_KEY } from "@/hooks/useSecondarySearch";
import { PlaylistToggleButton } from "@/components/PlaylistToggleButton";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import { useSingingFollower, type SingingFollowerStatus } from "@/hooks/useSingingFollower";
import { availableSecondaryTranslationLanguages, isDraftPackagedVerse, isDraftSecondaryTranslation, loadPackagedSecondaryTranslations, secondaryTranslationLanguages, isSecondaryTranslationLanguage, usesStaticSecondaryTranslation, type SecondaryTranslationLanguage } from "@/lib/secondaryTranslations";
import { loadSoundCloudWidgetApi } from "@/lib/soundCloudWidget";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Info, Bookmark, BookmarkCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Gauge, Languages, Mic, MicOff, Pause, PanelsTopLeft, Play, ScrollText, Search, Share2, SlidersHorizontal, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useRoute } from "wouter";
import { AuthorChip } from "@/components/AuthorChip";
import { findAuthorByPoet } from "@/lib/authors";
import { getSongLanguage, SONG_LANGUAGES } from "@/lib/songLanguages";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/pageMeta";
import { buildSongShareText, parseSongShareParams, songShareParams } from "@/lib/songShare";

const READING_FONT_SIZE_ADJUSTMENTS = [-0.18, -0.09, 0, 0.12, 0.24] as const;
const READING_LINE_HEIGHTS = [1.04, 1.08, 1.12, 1.18, 1.26] as const;
const DEFAULT_READING_STEP = 2;
const DEFAULT_TELEPROMPTER_SPEED = 30;
const MIN_TELEPROMPTER_SPEED = 1;
const MAX_TELEPROMPTER_SPEED = 72;
const SECONDARY_TRANSLATION_CONCURRENCY = 2;
/**
 * Share of a recording the printed lyrics take up. Most recordings close with a few rounds of
 * the Hare Krishna mahā-mantra, and singers skip some of the bracketed ornaments, so pacing the
 * lyrics over the whole track would run behind the singer.
 */
const LYRICS_SHARE_OF_RECORDING = 0.85;
/** Songs with more recordings than this show them behind a single summary row. */
const FOLDED_RECORDING_THRESHOLD = 2;

type PaceLandmark = "slow" | "steady" | "fast";

function getPaceLandmark(speed: number): PaceLandmark {
  if (speed <= 24) return "slow";
  if (speed >= 48) return "fast";
  return "steady";
}

function countVerseSyllables(lines: Array<{ transliteration: string }>) {
  const text = lines.map((line) => line.transliteration).join(" ").toLocaleLowerCase();
  return text.match(/[aeiouāīūṛṝḷēō]+/gi)?.length ?? 1;
}

function getSlideshowIntervalMs(
  verse: { lines: Array<{ transliteration: string }> } | undefined,
  verses: Array<{ lines: Array<{ transliteration: string }> }>,
  speed: number,
  soundCloudDurationMs: number | null,
) {
  const verseSyllables = Math.max(1, countVerseSyllables(verse?.lines ?? []));
  const totalSyllables = verses.reduce((total, candidate) => total + Math.max(1, countVerseSyllables(candidate.lines)), 0);
  if (soundCloudDurationMs && totalSyllables > 0) {
    return Math.max(1_000, Math.round(soundCloudDurationMs * (verseSyllables / totalSyllables)));
  }

  const baselineSeconds = Math.max(1, countVerseSyllables(verse?.lines ?? []));
  return Math.round(baselineSeconds * 1_000 * (DEFAULT_TELEPROMPTER_SPEED / Math.max(MIN_TELEPROMPTER_SPEED, speed)));
}

function getAudioMatchedScrollSpeed(scrollRange: number, soundCloudDurationMs: number | null) {
  if (!soundCloudDurationMs || scrollRange <= 0) return null;
  return Math.max(MIN_TELEPROMPTER_SPEED, scrollRange / (soundCloudDurationMs / 1_000));
}

function getAudioMatchedSlideshowSpeed(
  verse: { lines: Array<{ transliteration: string }> } | undefined,
  verses: Array<{ lines: Array<{ transliteration: string }> }>,
  soundCloudDurationMs: number | null,
) {
  if (!soundCloudDurationMs) return null;
  const manualBaselineMs = getSlideshowIntervalMs(verse, verses, DEFAULT_TELEPROMPTER_SPEED, null);
  const audioMatchedMs = getSlideshowIntervalMs(verse, verses, DEFAULT_TELEPROMPTER_SPEED, soundCloudDurationMs);
  if (audioMatchedMs <= 0) return null;

  return Math.min(MAX_TELEPROMPTER_SPEED, Math.max(MIN_TELEPROMPTER_SPEED, Math.round(DEFAULT_TELEPROMPTER_SPEED * (manualBaselineMs / audioMatchedMs))));
}

function getSoundCloudPlayerUrl(embedHtml: unknown) {
  if (typeof embedHtml !== "string") return null;
  const sourceMatch = embedHtml.match(/src="([^"]+)"/i);
  if (!sourceMatch?.[1]) return null;

  try {
    const playerUrl = new URL(sourceMatch[1].replaceAll("&amp;", "&"));
    if (playerUrl.origin !== "https://w.soundcloud.com" || playerUrl.pathname !== "/player/") return null;

    playerUrl.searchParams.set("auto_play", "false");
    playerUrl.searchParams.set("hide_related", "true");
    playerUrl.searchParams.set("show_comments", "false");
    playerUrl.searchParams.set("show_reposts", "false");
    playerUrl.searchParams.set("show_teaser", "false");
    playerUrl.searchParams.set("visual", "false");
    playerUrl.searchParams.set("color", "#b85e32");
    return playerUrl.toString();
  } catch {
    return null;
  }
}

type ReadingPreferences = {
  areTranslationsShown: boolean;
  areSecondaryOrnamentsHidden: boolean;
  readingFontSizeStep: number;
  readingLineHeightStep: number;
  teleprompterScrollSpeed: number;
  teleprompterSlideshowSpeed: number;
  isManualTeleprompterScrollPace: boolean;
  isManualTeleprompterSlideshowPace: boolean;
  secondaryTranslationLanguage: SecondaryTranslationLanguage | null;
  /**
   * Pixels of lyrics per sung syllable on the screen where the manual scroll speed was chosen.
   * The speed is rescaled by the current screen's density, so turning the phone (or changing
   * the font) keeps the same singing pace instead of the same pixels per second.
   */
  teleprompterScrollDensity?: number;
  /** Teleprompter lyrics size, set with a pinch (1 = the size the reading font gives). */
  teleprompterFontScale?: number;
  /** Legacy values are read once for backwards-compatible localStorage migration. */
  teleprompterSpeed?: number;
  isManualTeleprompterPace?: boolean;
};

const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  areTranslationsShown: true,
  areSecondaryOrnamentsHidden: false,
  readingFontSizeStep: DEFAULT_READING_STEP,
  readingLineHeightStep: DEFAULT_READING_STEP,
  teleprompterScrollSpeed: DEFAULT_TELEPROMPTER_SPEED,
  teleprompterSlideshowSpeed: DEFAULT_TELEPROMPTER_SPEED,
  isManualTeleprompterScrollPace: false,
  isManualTeleprompterSlideshowPace: false,
  secondaryTranslationLanguage: null,
};

type TeleprompterView = "scroll" | "slideshow";

const MIN_TELEPROMPTER_FONT_SCALE = 0.6;
const MAX_TELEPROMPTER_FONT_SCALE = 2.2;
/** Idle time before the teleprompter's control bar slides away. */
const TELEPROMPTER_CHROME_IDLE_MS = 3500;

function clampTeleprompterFontScale(scale: number) {
  return Math.min(MAX_TELEPROMPTER_FONT_SCALE, Math.max(MIN_TELEPROMPTER_FONT_SCALE, scale));
}

function readReadingPreferences(): ReadingPreferences {
  if (typeof window === "undefined") return DEFAULT_READING_PREFERENCES;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(READING_PREFERENCES_STORAGE_KEY) ?? "null") as Partial<ReadingPreferences> | null;
    if (!parsed) return DEFAULT_READING_PREFERENCES;

    const fontSizeStep = typeof parsed.readingFontSizeStep === "number"
      ? Math.min(READING_FONT_SIZE_ADJUSTMENTS.length - 1, Math.max(0, parsed.readingFontSizeStep))
      : DEFAULT_READING_STEP;
    const lineHeightStep = typeof parsed.readingLineHeightStep === "number"
      ? Math.min(READING_LINE_HEIGHTS.length - 1, Math.max(0, parsed.readingLineHeightStep))
      : DEFAULT_READING_STEP;
    const legacyTeleprompterSpeed = typeof parsed.teleprompterSpeed === "number"
      ? Math.min(MAX_TELEPROMPTER_SPEED, Math.max(MIN_TELEPROMPTER_SPEED, parsed.teleprompterSpeed))
      : DEFAULT_TELEPROMPTER_SPEED;
    const scrollSpeed = typeof parsed.teleprompterScrollSpeed === "number"
      ? Math.min(MAX_TELEPROMPTER_SPEED, Math.max(MIN_TELEPROMPTER_SPEED, parsed.teleprompterScrollSpeed))
      : legacyTeleprompterSpeed;
    const slideshowSpeed = typeof parsed.teleprompterSlideshowSpeed === "number"
      ? Math.min(MAX_TELEPROMPTER_SPEED, Math.max(MIN_TELEPROMPTER_SPEED, parsed.teleprompterSlideshowSpeed))
      : legacyTeleprompterSpeed;
    const legacyManualPace = typeof parsed.isManualTeleprompterPace === "boolean" ? parsed.isManualTeleprompterPace : false;

    return {
      areTranslationsShown: typeof parsed.areTranslationsShown === "boolean" ? parsed.areTranslationsShown : true,
      areSecondaryOrnamentsHidden: typeof parsed.areSecondaryOrnamentsHidden === "boolean" ? parsed.areSecondaryOrnamentsHidden : false,
      readingFontSizeStep: fontSizeStep,
      readingLineHeightStep: lineHeightStep,
      teleprompterScrollSpeed: scrollSpeed,
      teleprompterSlideshowSpeed: slideshowSpeed,
      isManualTeleprompterScrollPace: typeof parsed.isManualTeleprompterScrollPace === "boolean" ? parsed.isManualTeleprompterScrollPace : legacyManualPace,
      isManualTeleprompterSlideshowPace: typeof parsed.isManualTeleprompterSlideshowPace === "boolean" ? parsed.isManualTeleprompterSlideshowPace : legacyManualPace,
      secondaryTranslationLanguage: isSecondaryTranslationLanguage(parsed.secondaryTranslationLanguage) ? parsed.secondaryTranslationLanguage : null,
      teleprompterFontScale: typeof parsed.teleprompterFontScale === "number" ? clampTeleprompterFontScale(parsed.teleprompterFontScale) : 1,
      teleprompterScrollDensity: typeof parsed.teleprompterScrollDensity === "number" && parsed.teleprompterScrollDensity > 0 ? parsed.teleprompterScrollDensity : undefined,
    };
  } catch {
    return DEFAULT_READING_PREFERENCES;
  }
}

function SongMatchText({
  value,
  query,
  fieldId,
  matchesByField,
  activeMatchId,
  registerMatch,
  matchIndexOffset = 0,
}: {
  value: string;
  query: string;
  fieldId: string;
  matchesByField: Map<string, SongSearchMatch[]>;
  activeMatchId: string | null;
  registerMatch: (matchId: string) => (element: HTMLElement | null) => void;
  matchIndexOffset?: number;
}) {
  const fieldMatches = matchesByField.get(fieldId) ?? [];

  return getHighlightParts(value, query).map((part, index) => {
    if (!part.isMatch) return <span key={`${fieldId}:text:${index}`}>{part.text}</span>;
    const match = fieldMatches[(part.matchIndex ?? 0) + matchIndexOffset];
    if (!match) return <span key={`${fieldId}:fallback:${index}`}>{part.text}</span>;

    return (
      <mark
        className={`in-song-highlight ${match.id === activeMatchId ? "is-active" : ""}`}
        id={`match-${match.id}`}
        key={match.id}
        ref={registerMatch(match.id)}
      >
        {part.text}
      </mark>
    );
  });
}

type SingingFollowControlsProps = {
  copy: ReturnType<typeof useTranslation>["copy"];
  isOn: boolean;
  onToggle: (on: boolean) => void;
  isCallAndResponse: boolean;
  onCallAndResponse: (on: boolean) => void;
  status: SingingFollowerStatus;
  isSinging: boolean;
  syllablesPerSecond: number | null;
  level: number;
};

/** The “Follow the singing” switch and its live status, shown in the pace panel. */
function SingingFollowControls({ copy, isOn, onToggle, isCallAndResponse, onCallAndResponse, status, isSinging, syllablesPerSecond, level }: SingingFollowControlsProps) {
  const statusText = status === "denied" ? copy.song.teleprompterFollowDenied
    : status === "unavailable" ? copy.song.teleprompterFollowUnavailable
    : status === "starting" ? copy.song.teleprompterFollowStarting
    : !isSinging ? copy.song.teleprompterFollowWaiting
    : syllablesPerSecond === null ? copy.song.teleprompterFollowListening
    : copy.song.teleprompterFollowRate.replace("{rate}", syllablesPerSecond.toFixed(1));
  return (
    <div className="singing-follow">
      <label className="singing-follow-toggle">
        <input type="checkbox" checked={isOn} onChange={(event) => onToggle(event.target.checked)} />
        <Mic size={14} aria-hidden="true" />
        <span>{copy.song.teleprompterFollowSinging}</span>
      </label>
      {isOn && (
        <>
          <p className={`singing-follow-status is-${status}`} aria-live="polite">
            {status === "listening" && <span className="singing-follow-meter" aria-hidden="true"><span style={{ transform: `scaleX(${level})` }} /></span>}
            {status === "denied" || status === "unavailable" ? <MicOff size={13} aria-hidden="true" /> : null}
            {statusText}
          </p>
          <label className="singing-follow-toggle is-secondary">
            <input type="checkbox" checked={isCallAndResponse} onChange={(event) => onCallAndResponse(event.target.checked)} />
            <span>{copy.song.teleprompterFollowCallResponse}</span>
          </label>
        </>
      )}
    </div>
  );
}

function SongPageContent() {
  const [, params] = useRoute("/song/:id");
  const { songs, status, isFavorite, toggleFavorite } = useSongLibrary();
  const { copy } = useTranslation();
  const routeQuery = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "";
  const [initialReadingPreferences] = useState(readReadingPreferences);
  const [query, setQuery] = useState(routeQuery);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [areTranslationsShown, setAreTranslationsShown] = useState(initialReadingPreferences.areTranslationsShown);
  const [translationOverrides, setTranslationOverrides] = useState<Record<string, boolean>>({});
  /** A shared link's second language and ornament setting are shown for this visit, not saved as the reader's own. */
  const sharedViewRef = useRef<{ songId: string; secondaryLanguage?: SecondaryTranslationLanguage | null; areOrnamentsHidden?: boolean } | null>(null);
  const [areSecondaryOrnamentsHidden, setAreSecondaryOrnamentsHidden] = useState(initialReadingPreferences.areSecondaryOrnamentsHidden);
  const [readingFontSizeStep, setReadingFontSizeStep] = useState(initialReadingPreferences.readingFontSizeStep);
  const [readingLineHeightStep, setReadingLineHeightStep] = useState(initialReadingPreferences.readingLineHeightStep);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [teleprompterScrollSpeed, setTeleprompterScrollSpeed] = useState(initialReadingPreferences.teleprompterScrollSpeed);
  const [teleprompterScrollDensity, setTeleprompterScrollDensity] = useState(initialReadingPreferences.teleprompterScrollDensity);
  const [teleprompterFontScale, setTeleprompterFontScale] = useState(initialReadingPreferences.teleprompterFontScale ?? 1);
  const [isTeleprompterChromeHidden, setIsTeleprompterChromeHidden] = useState(false);
  const [teleprompterActivity, setTeleprompterActivity] = useState(0);
  const teleprompterOverlayRef = useRef<HTMLElement | null>(null);
  const pinchStartScaleRef = useRef(1);
  const [teleprompterSlideshowSpeed, setTeleprompterSlideshowSpeed] = useState(initialReadingPreferences.teleprompterSlideshowSpeed);
  const [isManualTeleprompterScrollPace, setIsManualTeleprompterScrollPace] = useState(initialReadingPreferences.isManualTeleprompterScrollPace);
  const [isManualTeleprompterSlideshowPace, setIsManualTeleprompterSlideshowPace] = useState(initialReadingPreferences.isManualTeleprompterSlideshowPace);
  const [secondaryTranslationLanguage, setSecondaryTranslationLanguage] = useState<SecondaryTranslationLanguage | null>(initialReadingPreferences.secondaryTranslationLanguage);
  const [teleprompterView, setTeleprompterView] = useState<TeleprompterView>("scroll");
  const [slideshowVerseIndex, setSlideshowVerseIndex] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [slideshowCountdown, setSlideshowCountdown] = useState({ remainingMs: 0, totalMs: 0 });
  const [isTeleprompterControlsCollapsed, setIsTeleprompterControlsCollapsed] = useState(false);
  const [isTeleprompterPacePanelOpen, setIsTeleprompterPacePanelOpen] = useState(false);
  const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);
  const [isSoundCloudPlayerOpen, setIsSoundCloudPlayerOpen] = useState(false);
  // Songs with many recordings fold their list, so the lyrics stay near the top.
  const [isAudioListExpanded, setIsAudioListExpanded] = useState(false);
  const [soundCloudRecordingIndex, setSoundCloudRecordingIndex] = useState(0);
  const [soundCloudPlayerUrl, setSoundCloudPlayerUrl] = useState<string | null>(null);
  const [soundCloudPlayerStatus, setSoundCloudPlayerStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [soundCloudTrackMs, setSoundCloudDurationMs] = useState<number | null>(null);
  // Pace the lyrics over the part of the track they are sung in.
  const soundCloudDurationMs = soundCloudTrackMs ? soundCloudTrackMs * LYRICS_SHARE_OF_RECORDING : null;
  const [teleprompterScrollRange, setTeleprompterScrollRange] = useState(0);
  // Height of the lyrics alone, without the lead-in and run-out space around them.
  const [teleprompterTextHeight, setTeleprompterTextHeight] = useState(0);
  const [isPageScrolled, setIsPageScrolled] = useState(false);
  const matchElements = useRef(new Map<string, HTMLElement>());
  const teleprompterScrollRef = useRef<HTMLDivElement>(null);
  const readerPanelRef = useRef<HTMLElement>(null);
  const soundCloudPlayerRef = useRef<HTMLIFrameElement>(null);
  const song = songs.find((item) => item.id === params?.id);
  usePageMeta(song?.title ?? (status === "ready" ? copy.song.notFoundTitle : null), song ? [song.poet, song.verses.find((verse) => verse.translation)?.translation].filter(Boolean).join(" — ") : null);
  const index = song ? songs.findIndex((item) => item.id === song.id) : -1;
  const previous = index > 0 ? songs[index - 1] : null;
  const next = index >= 0 && index < songs.length - 1 ? songs[index + 1] : null;
  const soundCloudSourceUrls = useMemo(() => (song ? getSoundCloudRecordingUrls(song) : []), [song]);
  const soundCloudSourceUrl = soundCloudSourceUrls[soundCloudRecordingIndex] ?? soundCloudSourceUrls[0] ?? null;
  const displayedVerses = useMemo(() => {
    if (!song) return [];

    return song.verses.map((verse) => ({
      ...verse,
      lines: areSecondaryOrnamentsHidden ? hideSecondarySongOrnamentsInLines(verse.lines) : verse.lines,
      // The verse as stored, so word-for-word links stay on the right words when ornaments are hidden.
      sourceContextValue: verse.lines.map((line) => line.transliteration).join("\n"),
    }));
  }, [areSecondaryOrnamentsHidden, song]);
  const secondaryTranslationInput = useMemo(() => {
    if (!secondaryTranslationLanguage || usesStaticSecondaryTranslation(secondaryTranslationLanguage) || !song) return undefined;
    const verses = song.verses
      .filter((verse) => Boolean(verse.translation.trim()))
      .map((verse) => ({ verseId: `${song.id}::${verse.id}`, englishText: verse.translation }));
    return verses.length ? { language: secondaryTranslationLanguage, verses } : undefined;
  }, [secondaryTranslationLanguage, song]);
  const [secondaryTranslationsByVerse, setSecondaryTranslationsByVerse] = useState<Map<string, string>>(() => new Map());
  const [pendingSecondaryTranslationVerseIds, setPendingSecondaryTranslationVerseIds] = useState<Set<string>>(() => new Set());
  const [failedSecondaryTranslationVerseIds, setFailedSecondaryTranslationVerseIds] = useState<Set<string>>(() => new Set());
  // A packaged language may cover only part of the book; such songs get one quiet note, not an error per verse.
  const [isSongUntranslatedInPackage, setIsSongUntranslatedInPackage] = useState(false);
  // In-song search also covers the second translation on screen.
  const secondarySearchLookup = useMemo(() => secondaryTranslationsByVerse.size ? (_song: unknown, verse: { id: string }) => secondaryTranslationsByVerse.get(verse.id) : undefined, [secondaryTranslationsByVerse]);
  const matches = useMemo(() => song ? getSongSearchMatches(song, query, secondarySearchLookup) : [], [query, song, secondarySearchLookup]);
  const matchesByField = useMemo(() => {
    const byField = new Map<string, SongSearchMatch[]>();
    matches.forEach((match) => byField.set(match.fieldId, [...(byField.get(match.fieldId) ?? []), match]));
    return byField;
  }, [matches]);
  const activeMatch = matches[activeMatchIndex] ?? null;
  const [isSongNoteOpen, setIsSongNoteOpen] = useState(false);
  // A search hit inside the note opens it, so the highlighted words can be seen.
  useEffect(() => { if (activeMatch?.fieldId === "comment") setIsSongNoteOpen(true); }, [activeMatch]);
  const { mutateAsync: requestSecondaryTranslationVerse } = trpc.secondaryTranslation.translateVerse.useMutation();
  const audioMatchedScrollSpeed = getAudioMatchedScrollSpeed(teleprompterScrollRange, soundCloudDurationMs);
  const followerSpeedRef = useRef<number | null>(null);
  const [isFollowingSinging, setIsFollowingSinging] = useState(false);
  const [isCallAndResponse, setIsCallAndResponse] = useState(false);
  const singing = useSingingFollower(isTeleprompterOpen && isFollowingSinging);
  const isSingingFollowActive = isFollowingSinging && singing.status === "listening";
  const repeatFactor = isCallAndResponse ? 2 : 1;
  const totalTeleprompterSyllables = useMemo(() => displayedVerses.reduce((total, verse) => total + Math.max(1, countVerseSyllables(verse.lines)), 0), [displayedVerses]);
  // The manual speed keeps its singing pace across orientations, fonts and songs.
  const teleprompterDensity = teleprompterTextHeight > 0 ? teleprompterTextHeight / Math.max(1, totalTeleprompterSyllables) : null;
  useEffect(() => {
    if (teleprompterDensity !== null && teleprompterScrollDensity === undefined) setTeleprompterScrollDensity(teleprompterDensity);
  }, [teleprompterDensity, teleprompterScrollDensity]);
  const manualTeleprompterScrollSpeed = teleprompterDensity !== null && teleprompterScrollDensity
    ? Math.max(MIN_TELEPROMPTER_SPEED, teleprompterScrollSpeed * (teleprompterDensity / teleprompterScrollDensity))
    : teleprompterScrollSpeed;
  // Follow the singing: scroll at the sung syllable rate, hold still while nobody sings.
  const singingScrollSpeed = (() => {
    if (!isSingingFollowActive) return null;
    if (!singing.isSinging) return 0;
    if (singing.syllablesPerSecond === null || teleprompterScrollRange <= 0) return followerSpeedRef.current ?? manualTeleprompterScrollSpeed;
    const target = (singing.syllablesPerSecond / repeatFactor) * (teleprompterScrollRange / totalTeleprompterSyllables);
    const previous = followerSpeedRef.current ?? target;
    return Math.min(MAX_TELEPROMPTER_SPEED * 2, previous + (target - previous) * 0.3);
  })();
  followerSpeedRef.current = singingScrollSpeed && singingScrollSpeed > 0 ? singingScrollSpeed : followerSpeedRef.current;
  const effectiveTeleprompterSpeed = singingScrollSpeed !== null
    ? singingScrollSpeed
    : !isManualTeleprompterScrollPace && audioMatchedScrollSpeed !== null ? audioMatchedScrollSpeed : manualTeleprompterScrollSpeed;
  const { isPlaying: isAutoScrollPlaying, pause: pauseTeleprompter, rewindBy: rewindTeleprompter, toggle: toggleTeleprompter } = useTeleprompter(isTeleprompterOpen && teleprompterView === "scroll", effectiveTeleprompterSpeed, teleprompterScrollRef);
  // Keep the phone awake for as long as the reader is open, so a pause between verses never lets it lock.
  useScreenWakeLock(isTeleprompterOpen);

  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);


  useEffect(() => {
    setActiveMatchIndex(0);
  }, [query, song?.id]);

  useEffect(() => {
    let isCancelled = false;
    setSecondaryTranslationsByVerse(new Map());
    setPendingSecondaryTranslationVerseIds(new Set());
    setFailedSecondaryTranslationVerseIds(new Set());
    setIsSongUntranslatedInPackage(false);

    if (usesStaticSecondaryTranslation(secondaryTranslationLanguage) && song) {
      const translatableVerses = song.verses.filter((verse) => Boolean(verse.translation.trim()));
      const verseIds = new Set(translatableVerses.map((verse) => verse.id));
      setPendingSecondaryTranslationVerseIds(verseIds);

      void loadPackagedSecondaryTranslations(secondaryTranslationLanguage)
        .then((packageTranslations) => {
          if (isCancelled) return;
          const nextTranslations = new Map<string, string>();
          translatableVerses.forEach((verse) => {
            const translation = packageTranslations.get(`${song.id}::${verse.id}`);
            if (translation) nextTranslations.set(verse.id, translation);
          });
          setSecondaryTranslationsByVerse(nextTranslations);
          setIsSongUntranslatedInPackage(translatableVerses.length > 0 && nextTranslations.size === 0);
        })
        .catch(() => {
          if (!isCancelled) setFailedSecondaryTranslationVerseIds(verseIds);
        })
        .finally(() => {
          if (!isCancelled) setPendingSecondaryTranslationVerseIds(new Set());
        });

      return () => { isCancelled = true; };
    }

    if (!secondaryTranslationInput) return () => { isCancelled = true; };

    const queue = [...secondaryTranslationInput.verses];
    const translateNextVerse = async () => {
      while (!isCancelled) {
        const verse = queue.shift();
        if (!verse) return;
        const localVerseId = verse.verseId.split("::").at(-1) ?? verse.verseId;
        setPendingSecondaryTranslationVerseIds((current) => new Set(current).add(localVerseId));
        try {
          const result = await requestSecondaryTranslationVerse({ language: secondaryTranslationInput.language, verse });
          if (!isCancelled) {
            setSecondaryTranslationsByVerse((current) => {
              const next = new Map(current);
              next.set(localVerseId, result.translation.translation);
              return next;
            });
          }
        } catch {
          if (!isCancelled) setFailedSecondaryTranslationVerseIds((current) => new Set(current).add(localVerseId));
        } finally {
          if (!isCancelled) {
            setPendingSecondaryTranslationVerseIds((current) => {
              const next = new Set(current);
              next.delete(localVerseId);
              return next;
            });
          }
        }
      }
    };

    void Promise.all(Array.from({ length: Math.min(SECONDARY_TRANSLATION_CONCURRENCY, queue.length) }, () => translateNextVerse()));
    return () => { isCancelled = true; };
  }, [requestSecondaryTranslationVerse, secondaryTranslationInput, secondaryTranslationLanguage, song]);

  useEffect(() => {
    setTranslationOverrides({});
    setIsTeleprompterOpen(false);
    setSlideshowVerseIndex(0);
    setIsSlideshowPlaying(false);
    setIsTeleprompterControlsCollapsed(false);
    setIsSoundCloudPlayerOpen(false);
    setSoundCloudRecordingIndex(0);
    setSoundCloudPlayerUrl(null);
    setSoundCloudPlayerStatus("idle");
  }, [song?.id]);

  // A shared link opens the song as the sender saw it: the same translations open, second language and ornaments.
  useEffect(() => {
    if (!song || sharedViewRef.current?.songId === song.id) return;
    const verseIds = song.verses.map((verse) => verse.id);
    const shared = parseSongShareParams(window.location.search, verseIds);
    sharedViewRef.current = { songId: song.id };
    if (shared.translations) {
      const openIds = shared.translations === "all" ? verseIds : shared.translations === "none" ? [] : shared.translations;
      setTranslationOverrides(Object.fromEntries(verseIds.map((id) => [id, openIds.includes(id)])));
    }
    if (shared.secondaryLanguage !== undefined) {
      const language = isSecondaryTranslationLanguage(shared.secondaryLanguage) && availableSecondaryTranslationLanguages.some((item) => item.code === shared.secondaryLanguage) ? shared.secondaryLanguage : null;
      if (language) {
        sharedViewRef.current.secondaryLanguage = language;
        setSecondaryTranslationLanguage(language);
      }
    }
    if (shared.areOrnamentsHidden) {
      sharedViewRef.current.areOrnamentsHidden = true;
      setAreSecondaryOrnamentsHidden(true);
    }
    if (Object.keys(shared).length) {
      const url = new URL(window.location.href);
      ["tr", "lang", "plain"].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", url);
    }
  }, [song]);

  useEffect(() => {
    setIsSoundCloudPlayerOpen(false);
    setSoundCloudPlayerUrl(null);
    setSoundCloudPlayerStatus("idle");
    // A known track length paces the teleprompter at once; the player confirms it when it loads.
    const knownSeconds = soundCloudSourceUrl ? soundCloudTrackSecondsFor(soundCloudSourceUrl) : null;
    setSoundCloudDurationMs(knownSeconds ? knownSeconds * 1_000 : null);
  }, [soundCloudSourceUrl]);

  useEffect(() => {
    try {
      window.localStorage.setItem(READING_PREFERENCES_STORAGE_KEY, JSON.stringify({
        areTranslationsShown,
        areSecondaryOrnamentsHidden: sharedViewRef.current?.areOrnamentsHidden === areSecondaryOrnamentsHidden ? initialReadingPreferences.areSecondaryOrnamentsHidden : areSecondaryOrnamentsHidden,
        readingFontSizeStep,
        readingLineHeightStep,
        teleprompterScrollSpeed,
        teleprompterSlideshowSpeed,
        isManualTeleprompterScrollPace,
        isManualTeleprompterSlideshowPace,
        secondaryTranslationLanguage: sharedViewRef.current?.secondaryLanguage === secondaryTranslationLanguage ? initialReadingPreferences.secondaryTranslationLanguage : secondaryTranslationLanguage,
        teleprompterScrollDensity,
        teleprompterFontScale,
      } satisfies ReadingPreferences));
    } catch {
      // Reading remains fully functional when browser storage is unavailable.
    }
  }, [areSecondaryOrnamentsHidden, areTranslationsShown, isManualTeleprompterScrollPace, isManualTeleprompterSlideshowPace, readingFontSizeStep, readingLineHeightStep, secondaryTranslationLanguage, teleprompterFontScale, teleprompterScrollDensity, teleprompterScrollSpeed, teleprompterSlideshowSpeed]);

  useEffect(() => {
    if (!isReaderPanelOpen) return;

    const closeWhenUnused = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof HTMLElement && target.closest('[data-slot="dropdown-menu-content"]')) return;
      const songReaderPanelTrigger = document.getElementById("song-reading-tools-trigger");
      if (!readerPanelRef.current?.contains(target) && !songReaderPanelTrigger?.contains(target)) {
        setIsReaderPanelOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsReaderPanelOpen(false);
      document.getElementById("song-reading-tools-trigger")?.focus();
    };

    document.addEventListener("pointerdown", closeWhenUnused);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenUnused);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isReaderPanelOpen]);

  const openSoundCloudPlayer = () => setIsSoundCloudPlayerOpen(true);

  useEffect(() => {
    if (!soundCloudSourceUrl || (!isSoundCloudPlayerOpen && !isTeleprompterOpen)) return;
    let isActive = true;
    setSoundCloudPlayerStatus("loading");

    void fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(soundCloudSourceUrl)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("SoundCloud oEmbed request failed");
        const payload = await response.json() as { html?: unknown };
        const playerUrl = getSoundCloudPlayerUrl(payload.html);
        if (!playerUrl) throw new Error("SoundCloud oEmbed response did not include a supported player");
        if (!isActive) return;
        setSoundCloudPlayerUrl(playerUrl);
        setSoundCloudPlayerStatus("ready");
      })
      .catch(() => {
        if (isActive) setSoundCloudPlayerStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, [isSoundCloudPlayerOpen, isTeleprompterOpen, soundCloudSourceUrl]);

  useEffect(() => {
    const iframe = soundCloudPlayerRef.current;
    if (!iframe || !soundCloudPlayerUrl || !soundCloudSourceUrl) return;
    let isActive = true;

    void loadSoundCloudWidgetApi()
      .then((soundCloud) => {
        const widget = soundCloud.Widget(iframe);
        const readDuration = () => widget.getDuration((durationMs) => {
          if (!isActive || !Number.isFinite(durationMs) || durationMs <= 0) return;
          setSoundCloudDurationMs(durationMs);
        });

        widget.bind(soundCloud.Widget.Events.READY, readDuration);
        readDuration();
      })
      .catch(() => {
        // The reader retains its manual tempo when the official widget API is unavailable.
      });

    return () => {
      isActive = false;
    };
  }, [soundCloudPlayerUrl, soundCloudSourceUrl]);

  useEffect(() => {
    const syncScrollAffordance = () => setIsPageScrolled(window.scrollY > 260);
    syncScrollAffordance();
    window.addEventListener("scroll", syncScrollAffordance, { passive: true });
    return () => window.removeEventListener("scroll", syncScrollAffordance);
  }, []);

  useLayoutEffect(() => {
    if (!song?.id) return;

    const resetScrollPosition = () => {
      window.scrollTo(0, 0);
      teleprompterScrollRef.current?.scrollTo(0, 0);
    };

    // Reset both immediately and on the following frame so a browser-restored
    // SPA position cannot place a newly opened song at its final verses.
    resetScrollPosition();
    const frame = window.requestAnimationFrame(resetScrollPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [song?.id]);

  useLayoutEffect(() => {
    const scrollContainer = teleprompterScrollRef.current;
    if (!isTeleprompterOpen || teleprompterView !== "scroll" || !scrollContainer) {
      setTeleprompterScrollRange(0);
      setTeleprompterTextHeight(0);
      return;
    }

    const measureScrollRange = () => {
      setTeleprompterScrollRange(Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight));
      const shlokas = scrollContainer.querySelectorAll<HTMLElement>(".teleprompter-shloka");
      const first = shlokas[0];
      const last = shlokas[shlokas.length - 1];
      setTeleprompterTextHeight(first && last ? Math.max(0, last.offsetTop + last.offsetHeight - first.offsetTop) : 0);
    };
    const frame = window.requestAnimationFrame(measureScrollRange);
    const resizeObserver = new ResizeObserver(measureScrollRange);
    resizeObserver.observe(scrollContainer);
    window.addEventListener("resize", measureScrollRange);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureScrollRange);
    };
  }, [displayedVerses, isTeleprompterOpen, readingFontSizeStep, readingLineHeightStep, teleprompterView]);

  useEffect(() => {
    if (!isTeleprompterOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const documentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.classList.add("is-teleprompter-open");

    return () => {
      document.documentElement.classList.remove("is-teleprompter-open");
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = documentOverflow;
    };
  }, [isTeleprompterOpen]);

  useEffect(() => {
    if (!isTeleprompterOpen || teleprompterView !== "slideshow" || !isSlideshowPlaying || displayedVerses.length < 2 || isSingingFollowActive) {
      setSlideshowCountdown((current) => current.remainingMs === 0 && current.totalMs === 0 ? current : { remainingMs: 0, totalMs: 0 });
      return;
    }

    const intervalMs = getSlideshowIntervalMs(displayedVerses[slideshowVerseIndex], displayedVerses, teleprompterSlideshowSpeed, isManualTeleprompterSlideshowPace ? null : soundCloudDurationMs);
    const startedAt = performance.now();
    const updateCountdown = () => {
      const remainingMs = Math.max(0, intervalMs - (performance.now() - startedAt));
      setSlideshowCountdown({ remainingMs, totalMs: intervalMs });
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 125);
    const advanceTimer = window.setTimeout(() => {
      setSlideshowVerseIndex((current) => {
        if (current >= displayedVerses.length - 1) {
          setIsSlideshowPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [displayedVerses, isManualTeleprompterSlideshowPace, isSingingFollowActive, isSlideshowPlaying, isTeleprompterOpen, slideshowVerseIndex, soundCloudDurationMs, teleprompterSlideshowSpeed, teleprompterView]);

  // Follow the singing in Slideshow: a new slide once its syllables have been sung.
  const { resetSyllableCount } = singing;
  useEffect(() => { resetSyllableCount(); }, [resetSyllableCount, slideshowVerseIndex, isSlideshowPlaying, isSingingFollowActive]);
  const slideSyllableTarget = Math.max(1, countVerseSyllables(displayedVerses[slideshowVerseIndex]?.lines ?? [])) * repeatFactor;
  useEffect(() => {
    if (!isSingingFollowActive || teleprompterView !== "slideshow" || !isSlideshowPlaying) return;
    if (singing.syllableCount < slideSyllableTarget) return;
    setSlideshowVerseIndex((current) => {
      if (current >= displayedVerses.length - 1) {
        setIsSlideshowPlaying(false);
        return current;
      }
      return current + 1;
    });
  }, [displayedVerses.length, isSingingFollowActive, isSlideshowPlaying, singing.syllableCount, slideSyllableTarget, teleprompterView]);

  useEffect(() => {
    const translationVerseId = activeMatch?.kind === "translation" ? activeMatch.verseId : undefined;
    if (!translationVerseId) return;
    setTranslationOverrides((current) => current[translationVerseId] === true ? current : { ...current, [translationVerseId]: true });
  }, [activeMatch]);

  useEffect(() => {
    if (!activeMatch) return;
    const frame = window.requestAnimationFrame(() => {
      matchElements.current.get(activeMatch.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeMatch]);

  useEffect(() => {
    const isPlaying = teleprompterView === "scroll" ? isAutoScrollPlaying : isSlideshowPlaying;
    setIsTeleprompterControlsCollapsed(isPlaying);
  }, [isAutoScrollPlaying, isSlideshowPlaying, teleprompterView]);

  // The control bar shows again on any change of state, then slides away after a quiet spell.
  const revealTeleprompterChrome = useCallback(() => {
    setIsTeleprompterChromeHidden(false);
    setTeleprompterActivity((count) => count + 1);
  }, []);
  useEffect(revealTeleprompterChrome, [isTeleprompterOpen, isTeleprompterControlsCollapsed, teleprompterView, revealTeleprompterChrome]);
  useEffect(() => {
    if (!isTeleprompterOpen || isTeleprompterChromeHidden || isTeleprompterPacePanelOpen) return;
    const timer = window.setTimeout(() => setIsTeleprompterChromeHidden(true), TELEPROMPTER_CHROME_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [isTeleprompterChromeHidden, isTeleprompterOpen, isTeleprompterPacePanelOpen, teleprompterActivity]);
  useEffect(() => {
    if (!isTeleprompterOpen) return;
    // A mouse near the top edge brings the bar back on desktops.
    const onMouseMove = (event: MouseEvent) => { if (event.clientY < 110) revealTeleprompterChrome(); };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [isTeleprompterOpen, revealTeleprompterChrome]);

  useTeleprompterGestures(isTeleprompterOpen, teleprompterOverlayRef, {
    onSwipe: (direction) => {
      if (teleprompterView !== "slideshow") return;
      setSlideshowVerseIndex((current) => Math.min(displayedVerses.length - 1, Math.max(0, current + direction)));
    },
    onPinchStart: () => { pinchStartScaleRef.current = teleprompterFontScale; },
    onPinch: (ratio) => setTeleprompterFontScale(clampTeleprompterFontScale(Math.round(pinchStartScaleRef.current * ratio * 50) / 50)),
  });

  useEffect(() => {
    if (!isTeleprompterOpen) return;

    const handleTeleprompterKeyboardNavigation = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLElement && target.closest('[data-slot="popover-content"]')) return;
      revealTeleprompterChrome();

      if (teleprompterView === "slideshow" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        setSlideshowVerseIndex((current) => Math.min(displayedVerses.length - 1, Math.max(0, current + (event.key === "ArrowLeft" ? -1 : 1))));
      }

      if (teleprompterView === "scroll" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const step = Math.max(84, (teleprompterScrollRef.current?.clientHeight ?? 0) * 0.16);
        rewindTeleprompter(event.key === "ArrowUp" ? -step : step);
      }
    };

    window.addEventListener("keydown", handleTeleprompterKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleTeleprompterKeyboardNavigation);
  }, [displayedVerses.length, isTeleprompterOpen, revealTeleprompterChrome, rewindTeleprompter, teleprompterView]);

  if (status !== "ready") {
    return (
      <section className="song-loading" aria-live="polite">
        <div className="paper-spinner" />
        <p>{copy.song.opening}</p>
      </section>
    );
  }

  if (!song) {
    return (
      <section className="not-found-panel">
        <span className="eyebrow">{copy.song.notFoundEyebrow}</span>
        <h1>{copy.song.notFoundTitle}</h1>
        <Link href="/" className="text-action"><ArrowLeft size={16} /> {copy.song.backToLibrary}</Link>
      </section>
    );
  }

  const copySong = async (format: "plain" | "markdown") => {
    const plainText = [
      song.title,
      song.poet ?? "",
      "",
      ...song.verses.flatMap((verse) => [
        `(${verse.originalVerseNumber})`,
        ...verse.lines.map((line) => line.transliteration),
        verse.translation,
        "",
      ]),
    ]
      .filter(Boolean)
      .join("\n");

    const markdownText = [
      `# ${song.title}`,
      song.poet ? `*${song.poet}*` : "",
      "",
      ...song.verses.flatMap((verse) => [
        `## ${copy.song.verse} ${verse.originalVerseNumber}`,
        ...verse.lines.map((line) => line.transliteration),
        verse.translation ? `> ${verse.translation}` : "",
        "",
      ]),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(format === "plain" ? plainText : markdownText);
      toast.success(format === "plain" ? copy.song.copiedPlainText : copy.song.copiedMarkdownText);
    } catch {
      toast.error(copy.song.copyFailed);
    }
  };

  const shareSong = async (format: "link" | "plain" | "markdown") => {
    const verseIds = song.verses.map((verse) => verse.id);
    const openTranslationIds = song.verses.filter((verse) => verse.translation && isVerseTranslationVisible(verse.id)).map((verse) => verse.id);
    const translatedCount = song.verses.filter((verse) => verse.translation).length;
    const url = new URL(window.location.href);
    url.search = songShareParams({
      translations: !hasTranslations ? "none" : openTranslationIds.length === translatedCount ? "all" : openTranslationIds.length ? openTranslationIds : "none",
      secondaryLanguage: selectedSecondaryLanguage && openTranslationIds.length ? selectedSecondaryLanguage.code : null,
      areOrnamentsHidden: areSecondaryOrnamentsHidden,
    }, verseIds).toString();
    url.hash = "";
    const link = url.toString();
    const text = format === "link" ? link : buildSongShareText({
      title: song.title,
      poet: song.poet,
      verseLabel: copy.song.verse,
      secondaryLabel: selectedSecondaryLanguage?.code.toUpperCase(),
      url: link,
      verses: displayedVerses.map((verse) => {
        const isOpen = Boolean(verse.translation) && isVerseTranslationVisible(verse.id);
        return {
          originalVerseNumber: verse.originalVerseNumber,
          lines: verse.lines,
          translation: isOpen ? verse.translation : undefined,
          secondaryTranslation: isOpen && selectedSecondaryLanguage ? secondaryTranslationsByVerse.get(verse.id) : undefined,
        };
      }),
    }, format);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(format === "link" ? { title: song.title, url: link } : { title: song.title, text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(format === "link" ? copy.song.sharedLinkCopied : format === "plain" ? copy.song.copiedPlainText : copy.song.copiedMarkdownText);
    } catch {
      toast.error(copy.song.copyFailed);
    }
  };

  const favorite = isFavorite(song.id);
  const author = song.poet;
  const authorBio = findAuthorByPoet(author);
  const songLanguage = getSongLanguage(song.id);
  const songLanguageInfo = songLanguage ? SONG_LANGUAGES[songLanguage] : undefined;
  // Verses are Bengali or Sanskrit in Latin letters: tagged so, and kept out of machine translation.
  const verseLang = songLanguageInfo ? `${songLanguageInfo.lang}-Latn` : undefined;
  const toggleSongFavorite = () => {
    toggleFavorite(song.id);
    toast.success(favorite ? copy.song.removedFavorite : copy.song.addedFavorite);
  };
  const categoryFilterHref = `/?category=${encodeURIComponent(song.category)}#search`;
  const authorFilterHref = author ? `/?author=${encodeURIComponent(author)}#search` : null;

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const url = new URL(window.location.href);
    if (nextQuery.trim()) url.searchParams.set("q", nextQuery.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const moveToMatch = (direction: -1 | 1) => {
    if (!matches.length) return;
    setActiveMatchIndex((current) => (current + direction + matches.length) % matches.length);
  };

  const setAllTranslationsVisibility = (nextVisible: boolean) => {
    setAreTranslationsShown(nextVisible);
    setTranslationOverrides({});
  };

  const isVerseTranslationVisible = (verseId: string) => translationOverrides[verseId] ?? areTranslationsShown;

  const toggleVerseTranslation = (verseId: string) => {
    setTranslationOverrides((current) => ({ ...current, [verseId]: !(current[verseId] ?? areTranslationsShown) }));
  };

  const adjustReadingFontSize = (direction: -1 | 1) => {
    setReadingFontSizeStep((current) => Math.min(READING_FONT_SIZE_ADJUSTMENTS.length - 1, Math.max(0, current + direction)));
  };

  const adjustReadingLineHeight = (direction: -1 | 1) => {
    setReadingLineHeightStep((current) => Math.min(READING_LINE_HEIGHTS.length - 1, Math.max(0, current + direction)));
  };

  const closeTeleprompter = () => {
    pauseTeleprompter();
    setIsSlideshowPlaying(false);
    setIsTeleprompterControlsCollapsed(false);
    setIsTeleprompterPacePanelOpen(false);
    setIsTeleprompterOpen(false);
  };

  const openTeleprompter = () => {
    setIsReaderPanelOpen(false);
    setIsTeleprompterControlsCollapsed(false);
    setIsTeleprompterOpen(true);
  };

  const setReaderView = (nextView: TeleprompterView) => {
    pauseTeleprompter();
    setIsSlideshowPlaying(false);
    setIsTeleprompterControlsCollapsed(false);
    setIsTeleprompterPacePanelOpen(false);
    setTeleprompterView(nextView);
  };

  const moveSlideshowVerse = (direction: -1 | 1) => {
    setSlideshowVerseIndex((current) => Math.min(displayedVerses.length - 1, Math.max(0, current + direction)));
  };

  const updateManualTeleprompterSpeed = (nextSpeed: number | undefined) => {
    const speed = nextSpeed ?? DEFAULT_TELEPROMPTER_SPEED;
    if (teleprompterView === "scroll") {
      setIsManualTeleprompterScrollPace(true);
      setTeleprompterScrollSpeed(speed);
      if (teleprompterDensity !== null) setTeleprompterScrollDensity(teleprompterDensity);
      return;
    }

    setIsManualTeleprompterSlideshowPace(true);
    setTeleprompterSlideshowSpeed(speed);
  };

  const useAudioMatchedPace = () => {
    const matchedSpeed = teleprompterView === "scroll"
      ? audioMatchedScrollSpeed
      : getAudioMatchedSlideshowSpeed(displayedVerses[slideshowVerseIndex], displayedVerses, soundCloudDurationMs);

    if (teleprompterView === "scroll") {
      if (matchedSpeed !== null) setTeleprompterScrollSpeed(matchedSpeed);
      setIsManualTeleprompterScrollPace(false);
      return;
    }

    if (matchedSpeed !== null) setTeleprompterSlideshowSpeed(matchedSpeed);
    setIsManualTeleprompterSlideshowPace(false);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const registerMatch = (matchId: string) => (element: HTMLElement | null) => {
    if (element) matchElements.current.set(matchId, element);
    else matchElements.current.delete(matchId);
  };

  const songHref = (songId: string) => `/song/${songId}${normalizeSearchText(query) ? `?q=${encodeURIComponent(query.trim())}` : ""}`;
  const hasTranslations = song.verses.some((verse) => Boolean(verse.translation));
  const selectedSecondaryLanguage = secondaryTranslationLanguages.find((language) => language.code === secondaryTranslationLanguage) ?? null;
  // Notes on this song in the second translation's language (e.g. footnotes of the Russian edition).
  const secondaryNotes = selectedSecondaryLanguage ? ((songNotesByLanguage as unknown as Record<string, Record<string, string[]> | undefined>)[selectedSecondaryLanguage.code]?.[song.id] ?? []) : [];
  const hasSongNote = Boolean(song.comment || secondaryNotes.length || songLanguageInfo);
  const readingTypographyStyle = {
    "--reading-font-size-adjustment": `${READING_FONT_SIZE_ADJUSTMENTS[readingFontSizeStep]}rem`,
    "--reading-line-height": String(READING_LINE_HEIGHTS[readingLineHeightStep]),
    "--teleprompter-line-height": String(READING_LINE_HEIGHTS[readingLineHeightStep]),
    "--teleprompter-font-scale": String(teleprompterFontScale),
  } as CSSProperties;
  const fontSizeState = readingFontSizeStep === DEFAULT_READING_STEP
    ? copy.song.readingDefault
    : readingFontSizeStep < DEFAULT_READING_STEP ? copy.song.readingSmaller : copy.song.readingLarger;
  const lineHeightState = readingLineHeightStep === DEFAULT_READING_STEP
    ? copy.song.readingDefault
    : readingLineHeightStep < DEFAULT_READING_STEP ? copy.song.readingTighter : copy.song.readingLooser;
  const slideshowVerse = displayedVerses[slideshowVerseIndex];
  const slideshowCountdownSeconds = Math.max(0, Math.ceil(slideshowCountdown.remainingMs / 1_000));
  const slideshowCountdownProgress = slideshowCountdown.totalMs > 0
    ? Math.min(1, Math.max(0, 1 - slideshowCountdown.remainingMs / slideshowCountdown.totalMs))
    : 0;
  const slideshowCountdownLabel = copy.song.teleprompterCountdown.replace("{seconds}", String(slideshowCountdownSeconds));
  const isTeleprompterPlaying = teleprompterView === "scroll" ? isAutoScrollPlaying : isSlideshowPlaying;
  const isAudioPaceAvailable = teleprompterView === "scroll" ? audioMatchedScrollSpeed !== null : soundCloudDurationMs !== null;
  const activeTeleprompterSpeed = teleprompterView === "scroll" ? teleprompterScrollSpeed : teleprompterSlideshowSpeed;
  const isManualTeleprompterPace = teleprompterView === "scroll" ? isManualTeleprompterScrollPace : isManualTeleprompterSlideshowPace;
  const paceLandmark = getPaceLandmark(activeTeleprompterSpeed);
  const paceLandmarkLabel = paceLandmark === "slow" ? copy.song.teleprompterPaceSlow : paceLandmark === "fast" ? copy.song.teleprompterPaceFast : copy.song.teleprompterPaceSteady;
  const paceStatus = isSingingFollowActive ? copy.song.teleprompterPaceStatusFollowing : isManualTeleprompterPace
    ? copy.song.teleprompterPaceStatusManual.replace("{pace}", paceLandmarkLabel)
    : isAudioPaceAvailable ? copy.song.teleprompterPaceStatusAudio : copy.song.teleprompterPaceStatusSteady;
  const singingFollowControls = (
    <SingingFollowControls copy={copy} isOn={isFollowingSinging} onToggle={setIsFollowingSinging} isCallAndResponse={isCallAndResponse} onCallAndResponse={setIsCallAndResponse} status={singing.status} isSinging={singing.isSinging} syllablesPerSecond={singing.syllablesPerSecond} level={singing.level} />
  );
  const toggleSlideshow = () => {
    if (isSlideshowPlaying) {
      setIsSlideshowPlaying(false);
      return;
    }
    if (!displayedVerses.length) return;
    if (slideshowVerseIndex >= displayedVerses.length - 1) setSlideshowVerseIndex(0);
    setIsSlideshowPlaying(true);
  };

  // A tap on the lyrics (not on a control or a word's gloss) shows or hides the control bar.
  const toggleTeleprompterChromeOnTap = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, [role='button'], [role='dialog']:not(.teleprompter-overlay), [data-teleprompter-controls], [data-slot='popover-content']")) return;
    if (window.getSelection()?.toString()) return;
    if (isTeleprompterChromeHidden) revealTeleprompterChrome();
    else setIsTeleprompterChromeHidden(true);
  };

  const pauseAndRestoreTeleprompterControls = () => {
    if (teleprompterView === "scroll") pauseTeleprompter();
    else setIsSlideshowPlaying(false);
    setIsTeleprompterControlsCollapsed(false);
  };

  return (
    <div className={`song-page ${isTeleprompterOpen ? "is-teleprompter" : ""}`} style={readingTypographyStyle}>
      {isTeleprompterOpen && (
        <section ref={teleprompterOverlayRef} className={`teleprompter-overlay${isTeleprompterChromeHidden ? " is-chrome-hidden" : ""}`} role="dialog" aria-modal="true" aria-label={copy.song.teleprompterTitle} onClick={toggleTeleprompterChromeOnTap}>
          <header className={`teleprompter-overlay-controls ${isTeleprompterControlsCollapsed ? "is-collapsed" : ""}${isTeleprompterChromeHidden ? " is-hidden" : ""}`} data-teleprompter-controls onPointerDown={revealTeleprompterChrome}>
            {isTeleprompterControlsCollapsed ? (
              <div className="teleprompter-collapsed-actions">
                <Popover open={isTeleprompterPacePanelOpen} onOpenChange={setIsTeleprompterPacePanelOpen}>
                  <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><button className={`teleprompter-speed-trigger ${isManualTeleprompterPace ? "is-manual" : ""}`} type="button" aria-label={copy.song.teleprompterPaceSettings}><Gauge size={16} aria-hidden="true" /></button></PopoverTrigger></TooltipTrigger><TooltipContent side="left">{copy.song.teleprompterPaceSettings}</TooltipContent></Tooltip>
                  <PopoverContent className="teleprompter-speed-popover" align="end" side="bottom" sideOffset={8}>
                    <div className="teleprompter-speed-popover-heading"><Gauge size={15} aria-hidden="true" /><span>{copy.song.teleprompterManualPace}</span></div>
                    <Slider id="teleprompter-speed-collapsed" value={[activeTeleprompterSpeed]} min={MIN_TELEPROMPTER_SPEED} max={MAX_TELEPROMPTER_SPEED} step={1} onValueChange={([nextSpeed]) => updateManualTeleprompterSpeed(nextSpeed)} disabled={isSingingFollowActive} aria-label={copy.song.teleprompterManualPace} />
                    <p className="teleprompter-pace-status" aria-live="polite">{paceStatus}</p>
                    <div className="teleprompter-speed-landmarks" aria-hidden="true"><span>{copy.song.teleprompterPaceSlow}</span><span>{copy.song.teleprompterPaceSteady}</span><span>{copy.song.teleprompterPaceFast}</span></div>
                    {isAudioPaceAvailable && !isSingingFollowActive && <button className="teleprompter-audio-pace-reset" type="button" onClick={useAudioMatchedPace}><Volume2 size={14} aria-hidden="true" /> {copy.song.teleprompterUseAudioPace}</button>}
                    {singingFollowControls}
                  </PopoverContent>
                </Popover>
                <button className="teleprompter-collapsed-control" type="button" onClick={pauseAndRestoreTeleprompterControls} aria-label={teleprompterView === "slideshow" ? `${copy.song.teleprompterPauseAndShowControls}. ${slideshowCountdownLabel}` : copy.song.teleprompterPauseAndShowControls}>
                  {teleprompterView === "slideshow" && <span className="teleprompter-countdown-ring" style={{ background: `conic-gradient(var(--saffron) ${slideshowCountdownProgress * 360}deg, rgba(24,36,43,0.14) 0deg)` }} aria-hidden="true" />}
                  <Pause size={17} aria-hidden="true" />
                </button>
              </div>
            ) : <>
              <div className="teleprompter-status" aria-live="polite">
              <span aria-hidden="true" />
              {isSingingFollowActive && <span className={`teleprompter-follow-badge ${singing.isSinging ? "is-hearing" : ""}`} title={copy.song.teleprompterFollowSinging}><Mic size={12} aria-hidden="true" /></span>}
              {isTeleprompterPlaying
                ? (teleprompterView === "scroll" ? copy.song.teleprompterPlaying : copy.song.teleprompterPlayingSlideshow)
                : (teleprompterView === "scroll" ? copy.song.teleprompterReady : copy.song.teleprompterReadySlideshow)}
              </div>
              <div className="teleprompter-view-switch" role="group" aria-label={copy.song.teleprompterViewLabel}>
              <button className={teleprompterView === "scroll" ? "is-active" : ""} type="button" onClick={() => setReaderView("scroll")} aria-pressed={teleprompterView === "scroll"}>
                <ScrollText size={14} aria-hidden="true" />
                <span>{copy.song.teleprompterScrollView}</span>
              </button>
              <button className={teleprompterView === "slideshow" ? "is-active" : ""} type="button" onClick={() => setReaderView("slideshow")} aria-pressed={teleprompterView === "slideshow"}>
                <PanelsTopLeft size={14} aria-hidden="true" />
                <span>{copy.song.teleprompterSlideshowView}</span>
              </button>
            </div>
            <div className="teleprompter-mode-controls">
            {teleprompterView === "slideshow" && isTeleprompterPlaying && (
              <output className="teleprompter-slideshow-countdown" aria-label={slideshowCountdownLabel}>
                <span className="teleprompter-countdown-dot" style={{ background: `conic-gradient(var(--saffron) ${slideshowCountdownProgress * 360}deg, rgba(24,36,43,0.14) 0deg)` }} aria-hidden="true" />
                {slideshowCountdownLabel}
              </output>
            )}
            </div>
            <div className="teleprompter-actions">
              <Popover open={isTeleprompterPacePanelOpen} onOpenChange={setIsTeleprompterPacePanelOpen}>
                <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><button className={`teleprompter-speed-trigger ${isManualTeleprompterPace ? "is-manual" : ""}`} type="button" aria-label={copy.song.teleprompterPaceSettings}><Gauge size={16} aria-hidden="true" /></button></PopoverTrigger></TooltipTrigger><TooltipContent side="bottom">{copy.song.teleprompterPaceSettings}</TooltipContent></Tooltip>
                <PopoverContent className="teleprompter-speed-popover" align="end" side="bottom" sideOffset={8}>
                  <div className="teleprompter-speed-popover-heading"><Gauge size={15} aria-hidden="true" /><span>{copy.song.teleprompterManualPace}</span></div>
                  <Slider id="teleprompter-speed" value={[activeTeleprompterSpeed]} min={MIN_TELEPROMPTER_SPEED} max={MAX_TELEPROMPTER_SPEED} step={1} onValueChange={([nextSpeed]) => updateManualTeleprompterSpeed(nextSpeed)} disabled={isSingingFollowActive} aria-label={copy.song.teleprompterManualPace} />
                  <p className="teleprompter-pace-status" aria-live="polite">{paceStatus}</p>
                  <div className="teleprompter-speed-landmarks" aria-hidden="true"><span>{copy.song.teleprompterPaceSlow}</span><span>{copy.song.teleprompterPaceSteady}</span><span>{copy.song.teleprompterPaceFast}</span></div>
                  {isAudioPaceAvailable && !isSingingFollowActive && <button className="teleprompter-audio-pace-reset" type="button" onClick={useAudioMatchedPace}><Volume2 size={14} aria-hidden="true" /> {copy.song.teleprompterUseAudioPace}</button>}
                    {singingFollowControls}
                </PopoverContent>
              </Popover>
              <button className={`teleprompter-play-button ${isTeleprompterPlaying ? "is-playing" : ""}`} type="button" onClick={teleprompterView === "scroll" ? toggleTeleprompter : toggleSlideshow}>
                {isTeleprompterPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                <span className="visually-hidden">{isTeleprompterPlaying
                  ? (teleprompterView === "scroll" ? copy.song.teleprompterPause : copy.song.teleprompterPauseSlideshow)
                  : (teleprompterView === "scroll" ? copy.song.teleprompterStart : copy.song.teleprompterStartSlideshow)}</span>
              </button>
              <button className="teleprompter-close-button" type="button" onClick={closeTeleprompter} aria-label={copy.song.teleprompterClose}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            </>}
          </header>
          {teleprompterView === "scroll" ? (
            <div className="teleprompter-reading-surface" ref={teleprompterScrollRef} tabIndex={0} aria-label={copy.song.teleprompterTitle}>
              <div className="teleprompter-reading-content">
                {displayedVerses.map((verse, verseIndex) => (
                  <section className="teleprompter-shloka" key={verse.id}>
                    <span className="teleprompter-verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>{String(verseIndex + 1).padStart(2, "0")}</span>
                    <div>
                      {verse.lines.map((line, lineIndex) => <p className={`teleprompter-line ${line.isIndented ? "is-indented" : ""}`} key={line.id} lang={verseLang} translate="no"><WordForWordText value={line.transliteration} songTitle={song.title} verseNumber={verse.originalVerseNumber} songId={song.id} verseId={verse.id} contextValue={verse.lines.map((verseLine) => verseLine.transliteration).join("\n")} sourceContextValue={verse.sourceContextValue} contextOffset={verse.lines.slice(0, lineIndex).reduce((offset, verseLine) => offset + verseLine.transliteration.length + 1, 0)} /></p>)}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : slideshowVerse ? (
            <div className="teleprompter-slideshow-surface" tabIndex={0} aria-label={copy.song.teleprompterSlideshowView}>
              <button className="teleprompter-slide-nav is-previous" type="button" onClick={() => moveSlideshowVerse(-1)} disabled={slideshowVerseIndex === 0} aria-label={copy.song.teleprompterPreviousSlide}><ChevronLeft size={22} aria-hidden="true" /></button>
              <section className="teleprompter-slideshow-verse" aria-live="polite">
                <span className="teleprompter-verse-number" aria-label={`${copy.song.verse} ${slideshowVerse.originalVerseNumber}`}>{String(slideshowVerseIndex + 1).padStart(2, "0")}</span>
                <div>
                  {slideshowVerse.lines.map((line, lineIndex) => <p className={`teleprompter-line ${line.isIndented ? "is-indented" : ""}`} key={line.id} lang={verseLang} translate="no"><WordForWordText value={line.transliteration} songTitle={song.title} verseNumber={slideshowVerse.originalVerseNumber} songId={song.id} verseId={slideshowVerse.id} contextValue={slideshowVerse.lines.map((verseLine) => verseLine.transliteration).join("\n")} sourceContextValue={slideshowVerse.sourceContextValue} contextOffset={slideshowVerse.lines.slice(0, lineIndex).reduce((offset, verseLine) => offset + verseLine.transliteration.length + 1, 0)} /></p>)}
                </div>
                <output className="teleprompter-slide-position" aria-live="polite">{copy.song.teleprompterSlidePosition.replace("{current}", String(slideshowVerseIndex + 1)).replace("{total}", String(displayedVerses.length))}</output>
              </section>
              <button className="teleprompter-slide-nav is-next" type="button" onClick={() => moveSlideshowVerse(1)} disabled={slideshowVerseIndex === displayedVerses.length - 1} aria-label={copy.song.teleprompterNextSlide}><ChevronRight size={22} aria-hidden="true" /></button>
            </div>
          ) : null}
        </section>
      )}

      <div className={`reader-panel-dock ${isReaderPanelOpen ? "is-open" : ""}`}>
        <section
          ref={readerPanelRef}
          id="reader-panel"
          className="reader-panel"
          aria-label={copy.song.readerPanelLabel}
          aria-hidden={!isReaderPanelOpen}
        >
          <div className="reader-panel-toolbar" role="group" aria-label={copy.song.readingControlsLabel}>
            <p className="visually-hidden">{copy.song.readingControlsDescription}</p>
            <Tooltip><TooltipTrigger asChild><button type="button" className="reading-step-button reading-type-button is-small" onClick={() => adjustReadingFontSize(-1)} disabled={readingFontSizeStep === 0} aria-label={copy.song.decreaseFontSize}>A</button></TooltipTrigger><TooltipContent side="bottom">{copy.song.decreaseFontSize}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button type="button" className="reading-step-button reading-type-button is-large" onClick={() => adjustReadingFontSize(1)} disabled={readingFontSizeStep === READING_FONT_SIZE_ADJUSTMENTS.length - 1} aria-label={copy.song.increaseFontSize}>A</button></TooltipTrigger><TooltipContent side="bottom">{copy.song.increaseFontSize}</TooltipContent></Tooltip>
            <span className="reader-panel-space" aria-hidden="true" />
            <Tooltip><TooltipTrigger asChild><button type="button" className="reading-step-button" onClick={() => adjustReadingLineHeight(-1)} disabled={readingLineHeightStep === 0} aria-label={copy.song.decreaseLineSpacing}><span className="line-spacing-glyph is-tight" aria-hidden="true"><i /><i /><i /></span></button></TooltipTrigger><TooltipContent side="bottom">{copy.song.decreaseLineSpacing}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button type="button" className="reading-step-button" onClick={() => adjustReadingLineHeight(1)} disabled={readingLineHeightStep === READING_LINE_HEIGHTS.length - 1} aria-label={copy.song.increaseLineSpacing}><span className="line-spacing-glyph is-loose" aria-hidden="true"><i /><i /><i /></span></button></TooltipTrigger><TooltipContent side="bottom">{copy.song.increaseLineSpacing}</TooltipContent></Tooltip>
            <span className="reader-panel-space" aria-hidden="true" /><span className="reader-panel-divider" aria-hidden="true" /><span className="reader-panel-space" aria-hidden="true" />
            <Tooltip><TooltipTrigger asChild><button className={`reading-visibility-toggle ${areSecondaryOrnamentsHidden ? "is-active" : ""}`} type="button" onClick={() => setAreSecondaryOrnamentsHidden((current) => !current)} aria-pressed={areSecondaryOrnamentsHidden} aria-label={areSecondaryOrnamentsHidden ? copy.song.showSecondaryOrnaments : copy.song.hideSecondaryOrnaments}><span aria-hidden="true">()</span></button></TooltipTrigger><TooltipContent side="bottom">{areSecondaryOrnamentsHidden ? copy.song.showSecondaryOrnaments : copy.song.secondaryOrnamentsDescription}</TooltipContent></Tooltip>
            {hasTranslations && <><span className="reader-panel-space" aria-hidden="true" /><Tooltip><TooltipTrigger asChild><button className={`reading-visibility-toggle ${areTranslationsShown ? "is-active" : ""}`} type="button" onClick={() => setAllTranslationsVisibility(!areTranslationsShown)} aria-pressed={areTranslationsShown} aria-label={areTranslationsShown ? copy.song.hideAllTranslations : copy.song.showAllTranslations}><Languages size={15} aria-hidden="true" /></button></TooltipTrigger><TooltipContent side="bottom">{areTranslationsShown ? copy.song.hideAllTranslations : copy.song.translationsDescription}</TooltipContent></Tooltip></>}
            {hasTranslations && <><span className="reader-panel-space" aria-hidden="true" /><DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><button className={`reader-panel-action-button reader-language-button ${selectedSecondaryLanguage ? "is-active" : ""}`} type="button" aria-label={copy.song.secondaryTranslationsLabel}><Languages size={15} aria-hidden="true" /><span className="reader-language-code" aria-hidden="true">{selectedSecondaryLanguage?.code.toUpperCase() ?? "A"}</span></button></DropdownMenuTrigger></TooltipTrigger><TooltipContent side="bottom">{copy.song.secondaryTranslationsDescription}</TooltipContent></Tooltip><DropdownMenuContent className="reader-menu secondary-language-menu" align="end" side="bottom" sideOffset={7}><DropdownMenuItem className={`reader-menu-item ${!secondaryTranslationLanguage ? "is-selected" : ""}`} onSelect={() => setSecondaryTranslationLanguage(null)}>{copy.song.secondaryTranslationsNone}</DropdownMenuItem>{availableSecondaryTranslationLanguages.map((language) => <DropdownMenuItem className={`reader-menu-item ${language.code === secondaryTranslationLanguage ? "is-selected" : ""}`} key={language.code} onSelect={() => { setSecondaryTranslationLanguage(language.code); setAllTranslationsVisibility(true); }}><span lang={language.lang}>{language.name}</span><small>{isDraftSecondaryTranslation(language.code) ? copy.song.secondaryTranslationsDraftLabel.replace("{language}", language.label) : language.label}</small></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></>}
            <span className="reader-panel-space" aria-hidden="true" /><span className="reader-panel-divider" aria-hidden="true" /><span className="reader-panel-space" aria-hidden="true" />
            <Tooltip><TooltipTrigger asChild><button className="reader-panel-action-button" type="button" onClick={openTeleprompter} aria-label={copy.song.teleprompterOpen}><ScrollText size={16} aria-hidden="true" /></button></TooltipTrigger><TooltipContent side="bottom">{copy.song.teleprompterOpen}</TooltipContent></Tooltip>
            <span className="reader-panel-space" aria-hidden="true" />
            <Tooltip><TooltipTrigger asChild><button className={`reader-panel-action-button ${favorite ? "is-favorite" : ""}`} type="button" onClick={toggleSongFavorite} aria-label={favorite ? copy.song.removeFavorite : copy.song.addFavorite} aria-pressed={favorite}>{favorite ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}</button></TooltipTrigger><TooltipContent side="bottom">{favorite ? copy.song.removeFavorite : copy.song.addFavorite}</TooltipContent></Tooltip>
            <span className="reader-panel-space" aria-hidden="true" />
            <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><button className="reader-panel-action-button" type="button" aria-label={copy.song.copyLabel}><Copy size={16} aria-hidden="true" /></button></DropdownMenuTrigger></TooltipTrigger><TooltipContent side="bottom">{copy.song.copyLabel}</TooltipContent></Tooltip><DropdownMenuContent className="reader-menu" align="end" side="bottom" sideOffset={7}><DropdownMenuItem className="reader-menu-item" onSelect={() => void copySong("plain")}>{copy.song.copyPlainText}</DropdownMenuItem><DropdownMenuItem className="reader-menu-item" onSelect={() => void copySong("markdown")}>{copy.song.copyMarkdownText}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            <span className="reader-panel-space" aria-hidden="true" />
            <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><button className="reader-panel-action-button" type="button" aria-label={copy.song.shareLabel}><Share2 size={16} aria-hidden="true" /></button></DropdownMenuTrigger></TooltipTrigger><TooltipContent side="bottom">{copy.song.shareDescription}</TooltipContent></Tooltip><DropdownMenuContent className="reader-menu" align="end" side="bottom" sideOffset={7}><DropdownMenuItem className="reader-menu-item" onSelect={() => void shareSong("link")}>{copy.song.shareLink}</DropdownMenuItem><DropdownMenuItem className="reader-menu-item" onSelect={() => void shareSong("plain")}>{copy.song.copyPlainText}</DropdownMenuItem><DropdownMenuItem className="reader-menu-item" onSelect={() => void shareSong("markdown")}>{copy.song.copyMarkdownText}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            <span className="reader-panel-space" aria-hidden="true" /><span className="reader-panel-divider" aria-hidden="true" /><span className="reader-panel-space" aria-hidden="true" />
            <Tooltip><TooltipTrigger asChild><button id="reader-panel-close" className="reader-panel-action-button reader-panel-close-button" type="button" onClick={() => setIsReaderPanelOpen(false)} aria-label={copy.song.closeReaderPanel}><X size={16} aria-hidden="true" /></button></TooltipTrigger><TooltipContent side="bottom">{copy.song.closeReaderPanel}</TooltipContent></Tooltip>
            <output className="visually-hidden" aria-live="polite">{fontSizeState}, {lineHeightState}</output>
          </div>
          <section className="in-song-search" aria-label={copy.song.inSongSearchLabel}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={copy.song.inSongSearchPlaceholder}
              aria-label={copy.song.inSongSearchLabel}
            />
            {query && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="in-song-search-clear" type="button" onClick={() => updateQuery("")} aria-label={copy.song.clearInSongSearch}>
                    <X size={15} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copy.song.clearInSongSearch}</TooltipContent>
              </Tooltip>
            )}
            <span className="in-song-match-count" aria-live="polite">
              {normalizeSearchText(query) ? (matches.length ? copy.song.matchPosition.replace("{current}", String(activeMatchIndex + 1)).replace("{total}", String(matches.length)) : copy.song.noInSongMatches) : ""}
            </span>
            <div className="in-song-search-controls">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => moveToMatch(-1)} disabled={!matches.length} aria-label={copy.song.previousMatch}>
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copy.song.previousMatch}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => moveToMatch(1)} disabled={!matches.length} aria-label={copy.song.nextMatch}>
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copy.song.nextMatch}</TooltipContent>
              </Tooltip>
            </div>
          </section>
        </section>
      </div>

      {isPageScrolled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="song-back-to-top" type="button" onClick={scrollToTop} aria-label={copy.song.backToTop}>
              <ChevronUp size={18} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{copy.song.backToTop}</TooltipContent>
        </Tooltip>
      )}

      <article className="song-sheet">
        <div className={`song-reading-tools-dock ${isReaderPanelOpen ? "is-panel-open" : ""}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id="song-reading-tools-trigger"
                className={`song-reading-tools-trigger ${isReaderPanelOpen ? "is-active" : ""}`}
                type="button"
                onClick={() => setIsReaderPanelOpen((current) => !current)}
                aria-expanded={isReaderPanelOpen}
                aria-controls="reader-panel"
                aria-label={isReaderPanelOpen ? copy.song.closeReaderPanel : copy.song.openReaderPanel} style={{ marginBottom: "10px", marginLeft: "10px", marginRight: "-10px", marginTop: "-10px" }}
              >
                <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.8} />
                <span>{copy.song.readingTools}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{isReaderPanelOpen ? copy.song.closeReaderPanel : copy.song.openReaderPanel}</TooltipContent>
          </Tooltip>
        </div>
        <div className="song-sheet-intro">
          <div>
            <Link className="eyebrow song-category-link" href={categoryFilterHref} aria-label={copy.song.filterByCategory.replace("{category}", song.category)}>{song.category}</Link>
            {songLanguage && songLanguageInfo && (
              <>
                <span className="song-language-divider" aria-hidden="true">·</span>
                <Link className={`song-language is-${songLanguage}`} href={`/?language=${songLanguage}#search`} lang={songLanguageInfo.lang} title={copy.song.composedIn.replace("{language}", songLanguageInfo.english)} aria-label={copy.song.filterByLanguage.replace("{language}", songLanguageInfo.english)}>{songLanguageInfo.native}</Link>
              </>
            )}
            <h1 lang={verseLang} translate="no"><SongMatchText value={song.title} query={query} fieldId="title" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></h1>
            <div className="song-meta">
              <p className="song-poet">{authorBio && authorFilterHref ? <AuthorChip author={authorBio} libraryHref={authorFilterHref} label={<SongMatchText value={author!} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} />} /> : author && authorFilterHref ? <Link className="song-poet-link" href={authorFilterHref} aria-label={copy.song.filterByAuthor.replace("{author}", author)}><SongMatchText value={author} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></Link> : <SongMatchText value={copy.library.noAuthor} query={query} fieldId="author" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} />}</p>
            </div>
          </div>
        </div>

        <div className="song-utility-row">
          <p className="song-verse-count">{song.verses.length} {song.verses.length === 1 ? copy.song.verse : copy.song.verses}</p>
          {hasSongNote && (
            <Popover open={isSongNoteOpen} onOpenChange={setIsSongNoteOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={`song-note-button${isSongNoteOpen ? " is-open" : ""}`} aria-label={copy.song.songNote} title={copy.song.songNote}>
                  <span className="song-note-glyph" aria-hidden="true">i</span>
                  <Info className="song-note-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="song-note-popover" align="end" side="bottom" sideOffset={8} collisionPadding={12}>
                <span className="info-card-eyebrow">{copy.song.songNote}</span>
                {song.comment && <p className="song-note-body"><SongMatchText value={song.comment} query={query} fieldId="comment" matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} /></p>}
                {selectedSecondaryLanguage && secondaryNotes.map((note) => <p className="song-note-body" lang={selectedSecondaryLanguage.lang} translate="no" key={note.slice(0, 24)}>{note}</p>)}
                {songLanguageInfo && <p className="song-note-meta">{copy.song.originalLanguage.replace("{language}", songLanguageInfo.english)}</p>}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {soundCloudSourceUrl && (
          <section className="song-audio" aria-label={copy.song.audioPlayerLabel}>
            {soundCloudSourceUrls.length > FOLDED_RECORDING_THRESHOLD && (
              <div className="audio-row-head audio-list-summary">
                <button className="audio-row-toggle" type="button" onClick={() => setIsAudioListExpanded((expanded) => !expanded)} aria-expanded={isAudioListExpanded} aria-controls={`audio-list-${song.id}`}>
                  <ChevronRight className="audio-row-chevron" size={15} aria-hidden="true" />
                  <span className="audio-row-note" aria-hidden="true">♪</span>
                  <span className="audio-row-title">{copy.song.audioRecordingsSummary.replace("{count}", String(soundCloudSourceUrls.length))}</span>
                  <span className="audio-row-length">{isAudioListExpanded ? copy.song.audioRecordingsHide : copy.song.audioRecordingsShow}</span>
                </button>
                <PlaylistToggleButton urls={soundCloudSourceUrls} addLabel={copy.playlist.addSong.replace("{song}", song.title)} removeLabel={copy.playlist.removeSong.replace("{song}", song.title)} />
              </div>
            )}
            <ul className={`audio-list${soundCloudSourceUrls.length > FOLDED_RECORDING_THRESHOLD ? " is-foldable" : ""}`} id={`audio-list-${song.id}`}>
              {soundCloudSourceUrls.map((url, recordingIndex) => {
                const isCurrent = recordingIndex === soundCloudRecordingIndex;
                const isOpen = isCurrent && isSoundCloudPlayerOpen;
                const seconds = soundCloudTrackSecondsFor(url);
                const singer = soundCloudSingerName(url) ?? copy.song.audioVersion.replace("{number}", String(recordingIndex + 1));
                // A folded list still keeps the open player, and the hidden probe that reads the track length.
                const isTucked = soundCloudSourceUrls.length > FOLDED_RECORDING_THRESHOLD && !isAudioListExpanded && !isOpen;
                return (
                  <li className={`audio-row${isOpen ? " is-open" : ""}${isTucked ? " is-tucked" : ""}`} key={url}>
                    <div className="audio-row-head">
                    <button className="audio-row-toggle" type="button" onClick={() => {
                        if (isOpen) {
                          setIsSoundCloudPlayerOpen(false);
                          return;
                        }
                        setSoundCloudRecordingIndex(recordingIndex);
                        openSoundCloudPlayer();
                      }} aria-expanded={isOpen} aria-controls={`soundcloud-player-${song.id}`} aria-label={`${isOpen ? copy.song.hideAudioPlayer : copy.song.playAudioTrack}: ${singer}`}>
                      <ChevronRight className="audio-row-chevron" size={15} aria-hidden="true" />
                      <span className="audio-row-note" aria-hidden="true">♪</span>
                      <span className="audio-row-title">{singer}</span>
                      {seconds ? <span className="audio-row-length">{formatTrackLength(seconds)}</span> : null}
                    </button>
                    <PlaylistToggleButton urls={[url]} addLabel={copy.playlist.addTrack.replace("{track}", `${song.title} (${singer})`)} removeLabel={copy.playlist.removeTrack.replace("{track}", `${song.title} (${singer})`)} />
                    </div>
                    {isCurrent && (
                      <div className="audio-row-player">
                        {isOpen && soundCloudPlayerStatus === "loading" && <p className="song-audio-status" role="status">{copy.song.audioPlayerLoading}</p>}
                        {isOpen && soundCloudPlayerStatus === "error" && <p className="song-audio-status is-error">{copy.song.audioPlayerUnavailable} <a href={url} target="_blank" rel="noreferrer">{copy.song.openAudioOnSoundCloud}</a></p>}
                        {soundCloudPlayerUrl && (
                          <iframe
                            id={`soundcloud-player-${song.id}`}
                            ref={soundCloudPlayerRef}
                            className={`soundcloud-player ${isOpen ? "is-visible" : "is-duration-probe"}`}
                            src={soundCloudPlayerUrl}
                            title={copy.song.soundCloudPlayerTitle.replace("{song}", song.title)}
                            allow="autoplay"
                            loading="eager"
                            aria-hidden={!isOpen}
                            tabIndex={isOpen ? 0 : -1}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {selectedSecondaryLanguage && isSongUntranslatedInPackage && <p className="secondary-translation-status song-untranslated-note" role="status">{copy.song.secondaryTranslationNotYet.replace("{language}", selectedSecondaryLanguage.label)}</p>}

        <div className="song-verses">
          {displayedVerses.map((verse, verseIndex) => {
            const translationVisible = isVerseTranslationVisible(verse.id);
            const secondaryTranslation = secondaryTranslationsByVerse.get(verse.id);
            const isSecondaryTranslationLoading = pendingSecondaryTranslationVerseIds.has(verse.id);
            const isSecondaryTranslationError = failedSecondaryTranslationVerseIds.has(verse.id);

            return (
              <section className="verse-block" id={verse.id} key={verse.id}>
                {verse.translation ? (
                  <button
                    className="verse-number verse-translation-marker"
                    type="button"
                    onClick={() => toggleVerseTranslation(verse.id)}
                    aria-controls={`translation-${verse.id}`}
                    aria-expanded={translationVisible}
                    aria-label={`${translationVisible ? copy.song.hideVerseTranslation : copy.song.showVerseTranslation}: ${copy.song.verse} ${verse.originalVerseNumber}`}
                  >
                    <span>{String(verseIndex + 1).padStart(2, "0")}</span>
                    <ChevronDown size={11} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="verse-number" aria-label={`${copy.song.verse} ${verse.originalVerseNumber}`}>
                    {String(verseIndex + 1).padStart(2, "0")}
                  </div>
                )}
                <div className="verse-copy">
                  {verse.lines.map((line, lineIndex) => (
                    <p className={`transliteration ${line.isIndented ? "is-indented" : ""}`} key={line.id} lang={verseLang} translate="no">
                      <WordForWordText
                        value={line.transliteration}
                        songTitle={song.title}
                        verseNumber={verse.originalVerseNumber}
                        songId={song.id}
                        verseId={verse.id}
                        contextValue={verse.lines.map((verseLine) => verseLine.transliteration).join("\n")}
                        sourceContextValue={verse.sourceContextValue} contextOffset={verse.lines.slice(0, lineIndex).reduce((offset, verseLine) => offset + verseLine.transliteration.length + 1, 0)}
                        renderText={(text, offset) => (
                          <SongMatchText
                            value={text}
                            query={query}
                            fieldId={`line:${line.id}`}
                            matchesByField={matchesByField}
                            activeMatchId={activeMatch?.id ?? null}
                            registerMatch={registerMatch}
                            matchIndexOffset={getHighlightParts(line.transliteration.slice(0, offset), query).filter((part) => part.isMatch).length}
                          />
                        )}
                      />
                    </p>
                  ))}
                  {verse.translation && (
                    <>
                      <div id={`translation-${verse.id}`} hidden={!translationVisible}>
                        <p className="translation"><HolyNameText value={verse.translation} renderText={(text, offset) => <SongMatchText value={text} query={query} fieldId={`translation:${verse.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} matchIndexOffset={getHighlightParts(verse.translation.slice(0, offset), query).filter((part) => part.isMatch).length} />} /></p>
                        {selectedSecondaryLanguage && isSecondaryTranslationLoading && <p className="secondary-translation-status" aria-live="polite">{copy.song.secondaryTranslationsLoading.replace("{language}", selectedSecondaryLanguage.name)}</p>}
                        {selectedSecondaryLanguage && isSecondaryTranslationError && <p className="secondary-translation-status is-error" role="status">{copy.song.secondaryTranslationsUnavailable}</p>}
                        {selectedSecondaryLanguage && secondaryTranslation && <p className="translation secondary-translation" lang={selectedSecondaryLanguage.lang} translate="no"><span className="secondary-translation-language" lang="en" aria-hidden="true" title={selectedSecondaryLanguage.label}>{selectedSecondaryLanguage.code.toUpperCase()}</span><HolyNameText noteLanguage={selectedSecondaryLanguage} value={secondaryTranslation} renderText={(text, offset) => <SongMatchText value={text} query={query} fieldId={`secondary:${verse.id}`} matchesByField={matchesByField} activeMatchId={activeMatch?.id ?? null} registerMatch={registerMatch} matchIndexOffset={getHighlightParts(secondaryTranslation.slice(0, offset), query).filter((part) => part.isMatch).length} />} />{isDraftPackagedVerse(selectedSecondaryLanguage.code, `${song.id}::${verse.id}`) && <small className="secondary-translation-draft" lang="en" title={copy.song.secondaryTranslationDraftVerseHint}>{copy.song.secondaryTranslationDraftVerse}</small>}</p>}
                      </div>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <div className="song-sheet-footer">
          <p>{copy.song.initialLine} <em>{songFirstLine(song)}</em></p>
          <p>{copy.song.songCode} <span>{song.id}</span></p>
        </div>
      </article>

      <nav className="song-neighbours" aria-label={copy.song.neighbourLabel}>
        {previous ? (
          <Link href={songHref(previous.id)} className="neighbour-link previous">
            <ChevronLeft size={18} />
            <span><small>{copy.song.previous}</small>{previous.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link href={songHref(next.id)} className="neighbour-link next">
            <span><small>{copy.song.next}</small>{next.title}</span>
            <ChevronRight size={18} />
          </Link>
        ) : <div />}
      </nav>
    </div>
  );
}

export default function SongPage() {
  return <AppShell><SongPageContent /></AppShell>;
}
