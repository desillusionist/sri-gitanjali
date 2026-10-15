import glossaryData from "@/data/word-for-word-glossary.json";

export type WordForWordEntry = {
  id: string;
  sectionId: string;
  entryOrder: number;
  collection: string;
  songOrPrayer: string;
  verseLabel: string | null;
  sourceTerm: string | null;
  meaning: string | null;
  parseStatus: string;
  rawSegment: string;
};

type GlossaryData = {
  entries: WordForWordEntry[];
  termIndex: Record<string, string[]>;
};

export type WordForWordSegment = {
  text: string;
  entries: WordForWordEntry[];
};

const glossary = glossaryData as GlossaryData;
const entriesById = new Map(glossary.entries.map((entry) => [entry.id, entry]));
const sourceTermByNormalizedTerm = new Map<string, string>();
Object.keys(glossary.termIndex).forEach((term) => sourceTermByNormalizedTerm.set(normalizeLookup(term), term));
const terms = Array.from(new Set(
  Object.keys(glossary.termIndex)
    .map((term) => normalizeLookup(term))
    .filter(Boolean),
)).sort((left, right) => right.length - left.length);

function normalizeLookup(value: string): string {
  return value.normalize("NFKC").replace(/[\u00a0\u2019\u2018]/g, (character) => character === "\u00a0" ? " " : "'").toLocaleLowerCase();
}

function normalizeContext(value: string): string {
  return normalizeLookup(value).replace(/[^A-Za-z0-9\u00c0-\u024f]+/g, "");
}

function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9\u00c0-\u024f-]/.test(value));
}

function matchesAt(value: string, term: string, index: number): boolean {
  const lowerValue = normalizeLookup(value);
  if (!lowerValue.startsWith(term, index)) return false;
  const before = lowerValue[index - 1];
  const after = lowerValue[index + term.length];
  return !isWordCharacter(before) && !isWordCharacter(after);
}

function verseNumberFromLabel(label: string | null): number | null {
  const numericMatch = label?.match(/(?:verse|text)\s*(\d+)/i);
  if (numericMatch) return Number(numericMatch[1]);
  const wordMatch = label?.match(/(?:verse|text)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i);
  const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  return wordMatch ? numberWords[wordMatch[1].toLocaleLowerCase()] ?? null : null;
}

function isContextualMatch(entry: WordForWordEntry, songTitle: string): boolean {
  const context = normalizeContext(songTitle);
  if (!context) return false;
  const sources = [entry.songOrPrayer, entry.collection].map(normalizeContext).filter(Boolean);
  return sources.some((source) => source === context || source.includes(context) || context.includes(source));
}

function resolveEntries(sourceTerm: string, songTitle?: string, verseNumber?: number): WordForWordEntry[] {
  const ids = glossary.termIndex[sourceTerm] ?? glossary.termIndex[sourceTermByNormalizedTerm.get(normalizeLookup(sourceTerm)) ?? ""] ?? [];
  const candidates = ids
    .map((id) => entriesById.get(id))
    .filter((entry): entry is WordForWordEntry => Boolean(entry?.meaning?.trim()));
  if (!candidates.length) return [];

  const songMatches = songTitle ? candidates.filter((entry) => isContextualMatch(entry, songTitle)) : [];
  const contextual = songMatches.length ? songMatches : candidates;
  if (verseNumber === undefined) return dedupeMeanings(contextual);

  const verseMatches = contextual.filter((entry) => verseNumberFromLabel(entry.verseLabel) === verseNumber);
  return dedupeMeanings(verseMatches.length ? verseMatches : contextual);
}

function dedupeMeanings(entries: WordForWordEntry[]): WordForWordEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.meaning?.trim().toLocaleLowerCase() ?? "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getWordForWordSegments(value: string, options: { songTitle?: string; verseNumber?: number } = {}): WordForWordSegment[] {
  if (!value.trim()) return [{ text: value, entries: [] }];

  const normalizedValue = normalizeLookup(value);
  const segments: WordForWordSegment[] = [];
  let plainStart = 0;
  let index = 0;

  while (index < value.length) {
    let matchedTerm: string | null = null;
    let matchedEntries: WordForWordEntry[] = [];

    for (const term of terms) {
      if (!matchesAt(value, term, index)) continue;
      const sourceTerm = sourceTermByNormalizedTerm.get(term);
      if (!sourceTerm) continue;
      const entries = resolveEntries(sourceTerm, options.songTitle, options.verseNumber);
      if (entries.length) {
        matchedTerm = term;
        matchedEntries = entries;
        break;
      }
    }

    if (!matchedTerm) {
      index += Array.from(normalizedValue.slice(index))[0]?.length ?? 1;
      continue;
    }

    const matchedEnd = index + matchedTerm.length;
    if (index > plainStart) segments.push({ text: value.slice(plainStart, index), entries: [] });
    segments.push({ text: value.slice(index, matchedEnd), entries: matchedEntries });
    plainStart = matchedEnd;
    index = matchedEnd;
  }

  if (plainStart < value.length) segments.push({ text: value.slice(plainStart), entries: [] });
  return segments.length ? segments : [{ text: value, entries: [] }];
}

export function getGlossaryStats() {
  return { entries: glossary.entries.length, terms: Object.keys(glossary.termIndex).length };
}
