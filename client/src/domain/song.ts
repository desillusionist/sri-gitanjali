/**
 * Паломнический свиток: доменные типы сохраняют текст песни в центре продукта,
 * а интерфейс использует спокойную редакционную иерархию вокруг него.
 */

import { soundCloudTrackSeconds } from "@/data/soundcloudDurations";
import { getFootnotes } from "@/lib/footnotes";
import { getSongLanguage, isSongLanguage } from "@/lib/songLanguages";

export type SongLine = {
  id: string;
  transliteration: string;
  isIndented: boolean;
};

export type Verse = {
  id: string;
  lines: SongLine[];
  translation: string;
  originalVerseNumber: number;
};

export type Song = {
  /** Stable web identifier; unlike the original SwiftUI title-based ID, it survives display changes. */
  id: string;
  title: string;
  poet?: string;
  verses: Verse[];
  category: string;
  comment?: string;
  audioLink?: string;
  audioLinks?: string[];
};

export type SongCategory = {
  id: string;
  name: string;
  songs: Song[];
};

export type SongInitialIndexGroup = {
  letter: string;
  songs: Song[];
};

export type SongDataStatus = "idle" | "loading" | "ready" | "error";

export const ALL_AUTHORS_FILTER = "__all_authors__";
export const ALL_CATEGORIES_FILTER = "__all_categories__";
export const UNLISTED_AUTHOR_FILTER = "__unlisted_author__";
export const ALL_RECORDINGS_FILTER = "__all_recordings__";
export const WITH_RECORDINGS_FILTER = "__with_recordings__";
export const ALL_LANGUAGES_FILTER = "__all_languages__";

/** A language code from the URL, or every language when it is missing or unknown. */
export function parseLanguageFilter(value: string | null): string {
  return isSongLanguage(value) ? value : ALL_LANGUAGES_FILTER;
}

/** Filter by recordings: any song, songs with a recording, or songs recorded by one singer (`singer:<SoundCloud account>`). */
export type RecordingFilter = typeof ALL_RECORDINGS_FILTER | typeof WITH_RECORDINGS_FILTER | `singer:${string}`;

export function singerRecordingFilter(account: string): RecordingFilter {
  return `singer:${account}`;
}

export function parseRecordingFilter(value: string | null): RecordingFilter {
  if (value === WITH_RECORDINGS_FILTER) return WITH_RECORDINGS_FILTER;
  const account = value?.startsWith("singer:") ? value.slice("singer:".length) : null;
  return account && SOUNDCLOUD_SINGER_LIST.some((singer) => singer.account === account) ? singerRecordingFilter(account) : ALL_RECORDINGS_FILTER;
}

export type SongSearchFilters = {
  query: string;
  author: string;
  category: string;
  recording: RecordingFilter;
  language: string;
};

export type HighlightPart = {
  text: string;
  isMatch: boolean;
  matchIndex?: number;
};

export type SongSearchMatchKind = "title" | "author" | "comment" | "line" | "translation" | "secondaryTranslation" | "footnote";

/**
 * Looks up a verse's second translation (in the reader's chosen language), when one is loaded.
 * Its language, when set, also brings that language's footnotes into the search.
 */
export type SecondaryTranslationLookup = ((song: Song, verse: Verse) => string | undefined) & { language?: string };

/** The footnotes to a verse's English translation and to its second translation. */
export function verseFootnoteTexts(song: Song, verse: Verse, secondary?: SecondaryTranslationLookup) {
  return {
    primary: getFootnotes("en", song.id, verse.id).map((note) => note.text),
    secondary: secondary?.language ? getFootnotes(secondary.language, song.id, verse.id).map((note) => note.text) : [],
  };
}

export type SongSearchMatch = {
  id: string;
  fieldId: string;
  matchIndex: number;
  kind: SongSearchMatchKind;
  verseId?: string;
};

export type SongSearchExcerpt = {
  text: string;
  source: "line" | "translation" | "secondaryTranslation" | "footnote" | "secondaryFootnote" | "comment";
};

export const defaultSongSearchFilters: SongSearchFilters = {
  query: "",
  author: ALL_AUTHORS_FILTER,
  category: ALL_CATEGORIES_FILTER,
  recording: ALL_RECORDINGS_FILTER,
  language: ALL_LANGUAGES_FILTER,
};

export const categoryOrder = [
  "Invocations",
  "Morning Songs",
  "Midday Songs",
  "Evening Songs",
  "Songs to Śrī Nityānanda Prabhu",
  "Songs to Śrī Chaitanya Mahāprabhu",
  "Other Songs",
  "Śrī Śikṣāṣṭakam",
  "Songs to Śrīmatī Rādhārāṇī",
  "Songs to Śrī Krishna",
  "Songs on Special Days",
  "Poems of Śrīla Śrīdhar Mahārāja",
  "Poems of Śrīla Govinda Mahārāja",
] as const;

export function songFirstLine(song: Song): string {
  return song.verses[0]?.lines[0]?.transliteration.trim() || song.title;
}

export function getSoundCloudRecordingUrls(song: Pick<Song, "audioLink" | "audioLinks">): string[] {
  const candidates = [...(song.audioLinks ?? []), ...(song.audioLink ? [song.audioLink] : [])];
  const validUrls = candidates.flatMap((candidate) => {
    try {
      const sourceUrl = new URL(candidate);
      return /(^|\.)soundcloud\.com$/i.test(sourceUrl.hostname) ? [sourceUrl.toString()] : [];
    } catch {
      return [];
    }
  });

  return Array.from(new Set(validUrls));
}

/**
 * Singers named in the recording picker and the library filter. `account` is the
 * singer's id: mostly their SoundCloud account, except where one account holds
 * more than one singer (see ACCOUNT_TRACK_SINGERS).
 */
export const SOUNDCLOUD_SINGER_LIST: readonly { account: string; name: string }[] = [
  { account: "kostya-netrebenko", name: "Śrīla Govinda Mahārāja" },
  { account: "acharya-maharaja", name: "Śrīla Āchārya Mahārāja" },
  { account: "huron", name: "Manasa Krishna" },
  { account: "bhakti-lalita-devi", name: "Bhakti Lalita Devi" },
];

/**
 * Tracks on an account sung by someone other than its main singer, as SoundCloud's
 * "artist" field names them. On soundcloud.com/kostya-netrebenko the tracks numbered
 * with three digits are by Śrīla B.N. Āchārya Mahārāja.
 */
const ACCOUNT_TRACK_SINGERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "kostya-netrebenko": Object.fromEntries([
    "003-jayajayagurudeveraratiujjvala-5", "011-thakuravaisnavagana-4", "013-thakuravaisnavapadaavanirasusampada-6",
    "015-kirupepaibaseva-7", "017-amarajivana-1", "025-namonamahtulasimaharani-2", "034-nitaigunamaniamara-3",
    "048-yadigauranahata-8", "076-radhabhajaneyadi-10", "082-sriharivasare-9", "083-suddhabhakatacharanarenu-11",
    "092-bhagyadhisatvadiyo-sriguruprasasti-13", "094-naumisrigurupadabjam-sripranatidasakam-12",
    "100-srisrisiksastakam1-6", "101-srisrisiksastakam2-1", "102-srisrisiksastakam3-7", "103-srisrisiksastakam4-4",
    "104-srisrisiksastakam5-3", "105-srisrisiksastakam6-5", "106-srisrisiksastakam7-2", "107-srisrisiksastakam8-8",
  ].map((track) => [track, "acharya-maharaja"])),
};

/** The singer's id for a SoundCloud track URL (see SOUNDCLOUD_SINGER_LIST), or null. */
function soundCloudSingerId(url: string): string | null {
  try {
    const [, account, track] = new URL(url).pathname.split("/");
    if (!account) return null;
    return ACCOUNT_TRACK_SINGERS[account]?.[track ?? ""] ?? account;
  } catch {
    return null;
  }
}

export function soundCloudSingerName(url: string): string | null {
  const id = soundCloudSingerId(url);
  return SOUNDCLOUD_SINGER_LIST.find((singer) => singer.account === id)?.name ?? null;
}

/** Known track length in seconds (from soundcloudDurations.ts), or null. */
export function soundCloudTrackSecondsFor(url: string): number | null {
  try {
    return soundCloudTrackSeconds[new URL(url).pathname.replace(/\/+$/, "")] ?? null;
  } catch {
    return null;
  }
}

export function formatTrackLength(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function hasRecordingBySinger(song: Pick<Song, "audioLink" | "audioLinks">, account: string): boolean {
  return getSoundCloudRecordingUrls(song).some((url) => soundCloudSingerId(url) === account);
}

export function getSoundCloudRecordingUrl(song: Pick<Song, "audioLink" | "audioLinks">): string | null {
  return getSoundCloudRecordingUrls(song)[0] ?? null;
}

export function getSoundCloudRecordingCount(song: Pick<Song, "audioLink" | "audioLinks">): number {
  return getSoundCloudRecordingUrls(song).length;
}

export function hasSoundCloudRecording(song: Pick<Song, "audioLink" | "audioLinks">): boolean {
  return getSoundCloudRecordingCount(song) > 0;
}

/**
 * Removes display-only cues such as "(kiba)" while preserving the source text
 * used by search, copying, indexing, and teleprompter reading.
 */
export function hideSecondarySongOrnaments(value: string): string {
  let cleaned = value;
  let previousValue = "";

  while (cleaned !== previousValue) {
    previousValue = cleaned;
    cleaned = cleaned.replace(/\([^()]*\)/g, " ");
  }

  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Hides parenthetical cues that can begin on one stored song line and end on
 * the next. The original SongLine objects remain intact for search and copy.
 */
export function hideSecondarySongOrnamentsInLines(lines: SongLine[]): SongLine[] {
  let parenthesisDepth = 0;

  return lines.flatMap((line) => {
    let visibleText = "";

    for (const character of line.transliteration) {
      if (character === "(") {
        parenthesisDepth += 1;
        continue;
      }

      if (character === ")" && parenthesisDepth > 0) {
        parenthesisDepth -= 1;
        continue;
      }

      if (parenthesisDepth === 0) visibleText += character;
    }

    const transliteration = hideSecondarySongOrnaments(visibleText);
    return transliteration ? [{ ...line, transliteration }] : [];
  });
}

/**
 * The same text as hideSecondarySongOrnamentsInLines (lines joined by "\n"),
 * plus, for each character, its position in the original joined text, so
 * links anchored to the original verse can be placed on the shortened one.
 */
export function hideSecondarySongOrnamentsWithOffsets(context: string): { text: string; offsets: number[] } {
  let parenthesisDepth = 0;
  let originalOffset = 0;
  const visibleLines: Array<Array<{ character: string; offset: number }>> = [];
  for (const line of context.split("\n")) {
    const tokens: Array<{ character: string; offset: number }> = [];
    for (const character of line) {
      const offset = originalOffset;
      originalOffset += character.length;
      if (character === "(") { parenthesisDepth += 1; continue; }
      if (character === ")" && parenthesisDepth > 0) { parenthesisDepth -= 1; continue; }
      if (parenthesisDepth === 0) tokens.push({ character, offset });
    }
    originalOffset += 1; // the "\n"
    // Mirror hideSecondarySongOrnaments: collapse runs of whitespace, drop space before punctuation, trim.
    const collapsed: typeof tokens = [];
    for (const token of tokens) {
      const isSpace = /\s/.test(token.character);
      const previous = collapsed[collapsed.length - 1];
      if (isSpace && previous && /\s/.test(previous.character)) continue;
      if (/[,.;:!?]/.test(token.character)) while (collapsed.length && /\s/.test(collapsed[collapsed.length - 1].character)) collapsed.pop();
      collapsed.push(isSpace ? { character: " ", offset: token.offset } : token);
    }
    while (collapsed.length && /\s/.test(collapsed[0].character)) collapsed.shift();
    while (collapsed.length && /\s/.test(collapsed[collapsed.length - 1].character)) collapsed.pop();
    if (collapsed.length) visibleLines.push(collapsed);
  }
  const offsets: number[] = [];
  let text = "";
  visibleLines.forEach((line, index) => {
    if (index) { text += "\n"; offsets.push(-1); }
    for (const token of line) { text += token.character; offsets.push(token.offset); }
  });
  return { text, offsets };
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Treat spaces and common dash variants as the same phrase separator so
    // "gaura ārati", "gaura-ārati", and "gaura–ārati" search identically.
    .replace(/[\s\u002D\u2010-\u2015\u2212]/g, "")
    .trim()
    .toLowerCase();
}

const SEPARATORS = /[\s\u002D\u2010-\u2015\u2212]/;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Two- and one-letter spellings that stand for the same sound in Bengali and Sanskrit
 * transliteration, folded to one form on both sides so "krishna" finds "kṛṣṇa",
 * "shri" finds "śrī", "caitanya" finds "chaitanya" and "nabadwip" finds "Navadvīp".
 */
const SPELLING_PAIRS: Record<string, string> = { sh: "s", ri: "r", ch: "c", aa: "a", ee: "i", oo: "u" };
// Bengali writes b where Sanskrit has v (Nabadwīp / Navadvīp, Brindāban / Vṛndāvan).
const SPELLING_SINGLES: Record<string, string> = { w: "b", v: "b" };

/**
 * Search form of a text: no accents, separators or case, with spelling variants folded, plus where each folded
 * letter starts and ends in the source, and which folded letters had a space or dash before them.
 */
function foldForSearch(value: string): { folded: string; indexes: number[]; ends: number[]; gapBefore: boolean[] } {
  const letters: string[] = [];
  const offsets: number[] = [];
  const letterEnds: number[] = [];
  const letterGaps: boolean[] = [];
  let originalOffset = 0;
  let pendingGap = false;
  for (const character of value) {
    const plain = character.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
    for (const letter of plain) {
      if (SEPARATORS.test(letter)) {
        pendingGap = true;
        continue;
      }
      letters.push(letter);
      offsets.push(originalOffset);
      letterEnds.push(originalOffset + character.length);
      letterGaps.push(pendingGap);
      pendingGap = false;
    }
    originalOffset += character.length;
  }

  let folded = "";
  const indexes: number[] = [];
  const ends: number[] = [];
  const gapBefore: boolean[] = [];
  for (let index = 0; index < letters.length; index += 1) {
    // A pair may span a gap ("gaura ārati" folds like the query "gauraarati"); the gap is then inside one letter.
    const pair = SPELLING_PAIRS[letters[index] + (letters[index + 1] ?? "")];
    if (pair) {
      folded += pair;
      indexes.push(offsets[index]);
      ends.push(letterEnds[index + 1]);
      gapBefore.push(letterGaps[index]);
      index += 1;
      continue;
    }
    folded += SPELLING_SINGLES[letters[index]] ?? letters[index];
    indexes.push(offsets[index]);
    ends.push(letterEnds[index]);
    gapBefore.push(letterGaps[index]);
  }
  return { folded, indexes, ends, gapBefore };
}

const WORD_CHARACTER = new RegExp("[\\p{L}\\p{N}]", "u");

/**
 * Where the query matches the folded text, as [start, end) in folded letters. Spaces and dashes are
 * ignored, so "gauraarati" finds "gaura ārati", but a match that runs over a word gap the query does
 * not have must start at the beginning of a word: "pig" does not find "tatrā·pi g·ovardhanaḥ".
 */
function findFoldedMatches(text: ReturnType<typeof foldForSearch>, query: string): Array<[number, number]> {
  const pattern = searchPattern(query);
  if (!pattern) return [];
  const { folded, gapBefore } = text;
  const wordStart = (index: number) => index === 0 || gapBefore[index] || !WORD_CHARACTER.test(folded[index - 1]);
  const found: Array<[number, number]> = [];
  pattern.lastIndex = 0;
  for (let match = pattern.exec(folded); match; match = pattern.exec(folded)) {
    const start = match.index;
    const end = start + match[0].length;
    if (!match[0].length) {
      pattern.lastIndex = start + 1;
      continue;
    }
    // Where each query word begins inside the match: gaps there were asked for.
    const queryGaps = new Set<number>();
    let cursor = start;
    for (let group = 1; group < match.length; group += 1) {
      if (group > 1) queryGaps.add(cursor);
      cursor += match[group]?.length ?? 0;
    }
    let crossesUnaskedGap = false;
    for (let index = start + 1; index < end; index += 1) {
      if (gapBefore[index] && !queryGaps.has(index)) crossesUnaskedGap = true;
    }
    if (crossesUnaskedGap && !wordStart(start)) {
      pattern.lastIndex = start + 1;
      continue;
    }
    found.push([start, end]);
  }
  return found;
}

const escapeForPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CONSONANT = /[b-df-hj-np-tv-z]$/;

/**
 * The query as a pattern over folded text. Bengali often drops a word's final "a"
 * (Madan / Madana, Gopāl / Gopāla), so each query word may end with or without it.
 */
function searchPattern(query: string): RegExp | null {
  const words = query.split(new RegExp(SEPARATORS.source + "+")).map((word) => foldForSearch(word).folded).filter(Boolean);
  if (!words.length) return null;
  const source = words.map((word) => {
    if (word.length > 2 && word.endsWith("a") && CONSONANT.test(word.slice(0, -1))) return `(${escapeForPattern(word.slice(0, -1))}a?)`;
    if (word.length > 1 && CONSONANT.test(word)) return `(${escapeForPattern(word)}a?)`;
    return `(${escapeForPattern(word)})`;
  }).join("");
  return new RegExp(source, "g");
}

/** True when the text contains the query, allowing for spelling variants. */
export function textMatchesQuery(value: string, query: string): boolean {
  return findFoldedMatches(foldForSearch(value), query).length > 0;
}

export type TextMatchRange = { start: number; end: number };

export function getOriginalMatchRanges(value: string, query: string): TextMatchRange[] {
  const text = foldForSearch(value);
  // End at the last matched letter, so a following space or dash is not highlighted.
  return findFoldedMatches(text, query).map(([start, end]) => ({ start: text.indexes[start], end: text.ends[end - 1] }));
}

export function getHighlightParts(value: string, query: string): HighlightPart[] {
  const ranges = getOriginalMatchRanges(value, query);
  if (!ranges.length) return [{ text: value, isMatch: false }];

  const parts: HighlightPart[] = [];
  let cursor = 0;

  ranges.forEach((range, matchIndex) => {
    if (range.start > cursor) parts.push({ text: value.slice(cursor, range.start), isMatch: false });
    parts.push({ text: value.slice(range.start, range.end), isMatch: true, matchIndex });
    cursor = range.end;
  });

  if (cursor < value.length) parts.push({ text: value.slice(cursor), isMatch: false });
  return parts;
}

function getOriginalMatchRange(value: string, query: string): TextMatchRange | null {
  return getOriginalMatchRanges(value, query)[0] ?? null;
}

function buildContextExcerpt(value: string, query: string, radius = 44): string | null {
  const range = getOriginalMatchRange(value, query);
  if (!range) return null;

  const provisionalStart = Math.max(0, range.start - radius);
  const provisionalEnd = Math.min(value.length, range.end + radius);
  const startBreak = value.lastIndexOf(" ", provisionalStart);
  const endBreak = value.indexOf(" ", provisionalEnd);
  const start = startBreak === -1 ? 0 : startBreak + 1;
  const end = endBreak === -1 ? value.length : endBreak;
  const excerpt = value.slice(start, end).trim();

  return `${start > 0 ? "…" : ""}${excerpt}${end < value.length ? "…" : ""}`;
}

export function getSongSearchExcerpt(song: Song, query: string, secondary?: SecondaryTranslationLookup): SongSearchExcerpt | null {
  if (!normalizeSearchText(query)) return null;

  const candidates: Array<{ text: string; source: SongSearchExcerpt["source"] }> = [
    ...song.verses.flatMap((verse) => verse.lines.map((line) => ({ text: line.transliteration, source: "line" as const }))),
    ...song.verses.map((verse) => ({ text: verse.translation, source: "translation" as const })),
    ...(secondary ? song.verses.map((verse) => ({ text: secondary(song, verse) ?? "", source: "secondaryTranslation" as const })) : []),
    ...song.verses.flatMap((verse) => verseFootnoteTexts(song, verse).primary.map((text) => ({ text, source: "footnote" as const }))),
    ...song.verses.flatMap((verse) => verseFootnoteTexts(song, verse, secondary).secondary.map((text) => ({ text, source: "secondaryFootnote" as const }))),
    ...(song.comment ? [{ text: song.comment, source: "comment" as const }] : []),
  ];

  for (const candidate of candidates) {
    const text = buildContextExcerpt(candidate.text, query);
    if (text) return { text, source: candidate.source };
  }

  return null;
}

export function getSongSearchMatches(song: Song, query: string, secondary?: SecondaryTranslationLookup): SongSearchMatch[] {
  if (!normalizeSearchText(query)) return [];

  const matches: SongSearchMatch[] = [];
  const addMatches = (value: string, fieldId: string, kind: SongSearchMatchKind, verseId?: string) => {
    getOriginalMatchRanges(value, query).forEach((_range, matchIndex) => {
      matches.push({ id: `${fieldId}:${matchIndex}`, fieldId, matchIndex, kind, verseId });
    });
  };

  addMatches(song.title, "title", "title");
  if (song.poet) addMatches(song.poet, "author", "author");
  if (song.comment) addMatches(song.comment, "comment", "comment");
  song.verses.forEach((verse) => {
    verse.lines.forEach((line) => addMatches(line.transliteration, `line:${line.id}`, "line", verse.id));
    if (verse.translation) addMatches(verse.translation, `translation:${verse.id}`, "translation", verse.id);
    const secondaryText = secondary?.(song, verse);
    if (secondaryText) addMatches(secondaryText, `secondary:${verse.id}`, "secondaryTranslation", verse.id);
    const footnotes = verseFootnoteTexts(song, verse, secondary);
    footnotes.primary.forEach((text, index) => addMatches(text, footnoteFieldId(verse.id, index), "footnote", verse.id));
    footnotes.secondary.forEach((text, index) => addMatches(text, footnoteFieldId(verse.id, index, true), "footnote", verse.id));
  });

  return matches;
}

/** Search field of a verse's footnote, by its place in the verse's list. */
export function footnoteFieldId(verseId: string, index: number, isSecondary = false) {
  return `${isSecondary ? "secondary-footnote" : "footnote"}:${verseId}:${index}`;
}

export function songSearchText(song: Song, secondary?: SecondaryTranslationLookup): string {
  return [
    song.title,
    song.poet ?? "",
    song.comment ?? "",
    ...song.verses.flatMap((verse) => [
      verse.translation,
      secondary?.(song, verse) ?? "",
      ...verseFootnoteTexts(song, verse, secondary).primary,
      ...verseFootnoteTexts(song, verse, secondary).secondary,
      ...verse.lines.map((line) => line.transliteration),
    ]),
  ]
    .join(" ");
}

export function getSongAuthors(songs: Song[]): string[] {
  return Array.from(new Set(songs.map((song) => song.poet?.trim()).filter(Boolean) as string[])).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function getSongCategories(songs: Song[]): string[] {
  const namedOrder = new Map<string, number>(categoryOrder.map((name, index) => [name, index]));
  return Array.from(new Set(songs.map((song) => song.category))).sort((left, right) => {
    const leftIndex = namedOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = namedOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex;
  });
}

export function filterSongs(songs: Song[], filters: SongSearchFilters, secondary?: SecondaryTranslationLookup): Song[] {
  const hasQuery = Boolean(normalizeSearchText(filters.query));

  return songs.filter((song) => {
    const matchesQuery = !hasQuery || textMatchesQuery(songSearchText(song, secondary), filters.query);
    const matchesAuthor =
      filters.author === ALL_AUTHORS_FILTER ||
      (filters.author === UNLISTED_AUTHOR_FILTER ? !song.poet?.trim() : song.poet?.trim() === filters.author);
    const matchesCategory = filters.category === ALL_CATEGORIES_FILTER || song.category === filters.category;
    const matchesRecording = filters.recording === ALL_RECORDINGS_FILTER
      || (filters.recording === WITH_RECORDINGS_FILTER ? hasSoundCloudRecording(song) : hasRecordingBySinger(song, filters.recording.slice("singer:".length)));

    const matchesLanguage = filters.language === ALL_LANGUAGES_FILTER || getSongLanguage(song.id) === filters.language;

    return matchesQuery && matchesAuthor && matchesCategory && matchesRecording && matchesLanguage;
  });
}

export function hasActiveSongFilters(filters: SongSearchFilters): boolean {
  return Boolean(normalizeSearchText(filters.query)) || filters.author !== ALL_AUTHORS_FILTER || filters.category !== ALL_CATEGORIES_FILTER || filters.recording !== ALL_RECORDINGS_FILTER || filters.language !== ALL_LANGUAGES_FILTER;
}

export function groupSongsByCategory(songs: Song[]): SongCategory[] {
  const groups = new Map<string, Song[]>();
  songs.forEach((song) => {
    const group = groups.get(song.category) ?? [];
    group.push(song);
    groups.set(song.category, group);
  });

  const namedOrder = new Map<string, number>(categoryOrder.map((name, index) => [name, index]));
  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      const leftIndex = namedOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = namedOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex;
    })
    .map(([name, groupedSongs]) => ({
      id: createSlug(name),
      name,
      songs: groupedSongs,
    }));
}

export function groupSongsByFirstLine(songs: Song[]): SongInitialIndexGroup[] {
  const groups = new Map<string, Song[]>();
  const sortedSongs = [...songs].sort((left, right) => songFirstLine(left).localeCompare(songFirstLine(right), undefined, { sensitivity: "base" }));

  sortedSongs.forEach((song) => {
    const normalizedFirstLine = songFirstLine(song)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
    const letter = normalizedFirstLine.match(/[A-Z]/)?.[0] ?? "#";
    const group = groups.get(letter) ?? [];
    group.push(song);
    groups.set(letter, group);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => left === "#" ? 1 : right === "#" ? -1 : left.localeCompare(right))
    .map(([letter, groupedSongs]) => ({ letter, songs: groupedSongs }));
}

export function createSlug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song"
  );
}

export type SongRecording = { url: string; song: Song; singer: string | null; seconds: number | null };

/** Every SoundCloud recording in the book, in book order, with its song. */
export function getSongRecordings(songs: Song[]): SongRecording[] {
  return songs.flatMap((song) => getSoundCloudRecordingUrls(song).map((url) => ({
    url,
    song,
    singer: soundCloudSingerName(url),
    seconds: soundCloudTrackSecondsFor(url),
  })));
}
