import glossaryData from "@/data/word-for-word-glossary.json";
import derivedAliasesData from "@/data/word-for-word-derived-aliases.json";
import referenceSectionMappingsData from "@/data/reference-section-mappings.json";
import referenceSurfaceAliasesData from "@/data/reference-surface-aliases.json";

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
type DerivedAliasData = { entries: Array<{ surface: string; sourceTerms: string[] }> };
const derivedAliases = derivedAliasesData as DerivedAliasData;
type ReferenceSectionMappingsData = { mappings: Array<{ songTitle: string; sectionId: string }> };
const referenceSectionMappings = referenceSectionMappingsData as ReferenceSectionMappingsData;
type ReferenceSurfaceAliasesData = { entries: Array<{ sectionId: string; surface: string; sourceTerms: string[] }> };
const referenceSurfaceAliases = referenceSurfaceAliasesData as ReferenceSurfaceAliasesData;
const referenceSectionBySongTitle = new Map(
  referenceSectionMappings.mappings.map((mapping) => [normalizeContext(mapping.songTitle), mapping.sectionId]),
);
const entriesById = new Map(glossary.entries.map((entry) => [entry.id, entry]));
const sourceTermsByNormalizedTerm = new Map<string, string[]>();
const sandhiStartAliases = new Set<string>();
const sandhiEndAliases = new Set<string>();
Object.keys(glossary.termIndex).forEach((term) => {
  normalizeTermVariants(term).forEach(({ normalizedTerm, allowSandhiStart, allowSandhiEnd }) => {
    if (!normalizedTerm) return;
    sourceTermsByNormalizedTerm.set(normalizedTerm, [...(sourceTermsByNormalizedTerm.get(normalizedTerm) ?? []), term]);
    if (allowSandhiStart) sandhiStartAliases.add(normalizedTerm);
    if (allowSandhiEnd) sandhiEndAliases.add(normalizedTerm);
  });
});
const grammaticalSurfaceAliases: Record<string, string[]> = {
  "mādyan": ["mādyat"], "manaso": ["manasaḥ"], "kampā": ["kampa"],
  "śrī-vigrahā": ["śrī-vigraha"], "rādhana": ["ārādhana"], "tan": ["tat"],
  "bhaktāṁś": ["bhaktān"], "niyuñjato": ["niyuñjataḥ"], "chatur": ["chatuḥ"],
  "svādv": ["svādu"], "svādana": ["āsvādana"], "kṛtva": ["kṛtvā"], "kṛtvaiva": ["kṛtvā", "eva"], "sadaiva": ["sada", "eva"], "mādhavayor": ["mādhavayoḥ"],
  "apara": ["apāra"], "prati-kṣaṇā": ["prati-kṣaṇa"], "nikuñja-yūno": ["nikuñja-yūnaḥ"],
  "siddhyair": ["siddhyai"], "ālibhir": ["ālibhiḥ"], "yuktir": ["yuktiḥ"], "tatrāti-dākṣyād": ["tatra", "ati-dākṣyāt"],
  "ati-dākṣyād": ["ati-dākṣyāt"], "sākṣād": ["sākṣāt"], "dharitvena": ["hari-tvena"], "śāstrair": ["śāstraiḥ"],
  "uktas": ["uktaḥ"], "bhāvyata": ["bhāvyate"], "prabhor": ["prabhoḥ"],
  "priya": ["priyaḥ"], "prasādād": ["prasādāt"], "prasādo": ["prasādaḥ"],
  "kuto ’pi": ["kutaḥ api"], "dhyayaṁ": ["dhyāyan"], "stuvaṁs": ["stuvan"],
  "yaśas": ["yaśaḥ"], "tri-sandhyaṁ": ["tri-sandhyam"],
  "gaurāchā̐da bole": ["gaurachānda bole"], "kota nidrā jāo": ["kota nidrā yāo"],
  "māyā-piśāchīra": ["māyā-pīśāchīra"], "prabhura-charaṇe": ["prabhu-charaṇe"],
  "tāthai tāthai": ["‘tāthaī tāthaī'"], "mukunda mādhava jādava hari": ["mukunda mādhava yādava hari"], "sonāra aṅga": ["soṇāra aṅga"],
  "bolore": ["bolo re"], "śorīra sāje": ["śarīra-sāje"], "durllabha": ["durlabha"],
  "emona": ["emana"], "ki kara": ["ki koro"], "tobe keno": ["tabe keno"],
  "nāmāśroya kori'": ["nāmāśraya kori'"] , "kichu nāhiko āro": ["kichu nāhiko āra"],
  "chaudda-bhuvana-mājhe": ["caudda-bhuvana-mājhe"], "jagate āsi'": ["jagate asi'"],
};

Object.entries(grammaticalSurfaceAliases).forEach(([surface, sourceTerms]) => {
  const normalizedSurface = normalizeTerm(surface);
  if (!normalizedSurface) return;
  sourceTerms.forEach((sourceTerm) => {
    if (!glossary.termIndex[sourceTerm]) return;
    sourceTermsByNormalizedTerm.set(normalizedSurface, [
      ...(sourceTermsByNormalizedTerm.get(normalizedSurface) ?? []), sourceTerm,
    ]);
  });
  sandhiStartAliases.add(normalizedSurface);
  sandhiEndAliases.add(normalizedSurface);
});

derivedAliases.entries.forEach(({ surface, sourceTerms }) => {
  const normalizedSurface = normalizeTerm(surface);
  if (!normalizedSurface) return;
  const availableSourceTerms = sourceTerms.filter((sourceTerm) => Boolean(glossary.termIndex[sourceTerm]));
  if (!availableSourceTerms.length) return;
  sourceTermsByNormalizedTerm.set(normalizedSurface, [
    ...(sourceTermsByNormalizedTerm.get(normalizedSurface) ?? []), ...availableSourceTerms,
  ]);
  sandhiStartAliases.add(normalizedSurface);
  sandhiEndAliases.add(normalizedSurface);
});

referenceSurfaceAliases.entries.forEach(({ surface, sourceTerms }) => {
  const normalizedSurface = normalizeTerm(surface);
  const availableSourceTerms = sourceTerms.filter((sourceTerm) => Boolean(glossary.termIndex[sourceTerm]));
  if (!normalizedSurface || !availableSourceTerms.length) return;
  sourceTermsByNormalizedTerm.set(normalizedSurface, [
    ...(sourceTermsByNormalizedTerm.get(normalizedSurface) ?? []), ...availableSourceTerms,
  ]);
  sandhiStartAliases.add(normalizedSurface);
  sandhiEndAliases.add(normalizedSurface);
});

const termsWithAliases = Array.from(sourceTermsByNormalizedTerm.keys()).sort((left, right) => right.length - left.length);

function normalizeLookup(value: string): string {
  return value.normalize("NFKC").replace(/[\u00a0\u2019\u2018]/g, (character) => character === "\u00a0" ? " " : "'").replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeTerm(value: string): string {
  return normalizeLookup(value).replace(/[\u002D\u2010-\u2015\u2212]/g, "");
}

function normalizeTermVariants(value: string): Array<{ normalizedTerm: string; allowSandhiStart?: boolean; allowSandhiEnd?: boolean }> {
  const compact = normalizeTerm(value);
  // Sanskrit compounds may fuse two vowels: guṇa-arṇavasya becomes
  // guṇārṇavasya, while dāvā-anala becomes dāvānala. Keep aliases narrow
  // and mark only the side of the term whose boundary was fused.
  const variants: Array<{ normalizedTerm: string; allowSandhiStart?: boolean; allowSandhiEnd?: boolean }> = [
    { normalizedTerm: compact },
    { normalizedTerm: compact.replace(/([aeiouāīūṛṝḷēō])\1/g, "$1") },
    { normalizedTerm: compact.replace(/(?:aa|aā|āa)/g, "ā") },
    { normalizedTerm: compact.replace(/(?:ii|iī|īi)/g, "ī") },
    { normalizedTerm: compact.replace(/(?:uu|uū|ūu)/g, "ū") },
  ];
  if (compact.endsWith("a")) variants.push({ normalizedTerm: `${compact.slice(0, -1)}ā`, allowSandhiEnd: true });
  if (compact.startsWith("a")) variants.push({ normalizedTerm: compact.slice(1), allowSandhiStart: true });
  return Array.from(new Map(variants.filter((variant) => variant.normalizedTerm).map((variant) => [variant.normalizedTerm, variant])).values());
}

function normalizeContext(value: string): string {
  return normalizeLookup(value).replace(/[^A-Za-z0-9\u00c0-\u024f]+/g, "");
}

function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9\u00c0-\u024f]/.test(value));
}

function getNormalizedTextWithIndexes(value: string): { normalized: string; indexes: number[] } {
  let normalized = "";
  const indexes: number[] = [];

  for (let originalOffset = 0; originalOffset < value.length;) {
    const character = value[originalOffset];
    const originalLength = character === "\uD800" || character === "\uDBFF" ? 2 : 1;
    if (!/[\u002D\u2010-\u2015\u2212]/.test(character)) {
      const normalizedPart = normalizeLookup(value.slice(originalOffset, originalOffset + originalLength));
      for (const normalizedCharacter of normalizedPart) {
        normalized += normalizedCharacter;
        indexes.push(originalOffset);
      }
    }
    originalOffset += originalLength;
  }

  return { normalized, indexes };
}

function getOriginalEnd(value: string, indexes: number[], normalizedStart: number, normalizedLength: number): number {
  const lastOriginalOffset = indexes[normalizedStart + normalizedLength - 1];
  const lastCharacter = value[lastOriginalOffset];
  return lastOriginalOffset + (lastCharacter && lastCharacter.codePointAt(0)! > 0xffff ? 2 : 1);
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

function resolveEntries(sourceTerms: string[], songTitle?: string, verseNumber?: number): WordForWordEntry[] {
  const candidates = sourceTerms
    .flatMap((sourceTerm) => glossary.termIndex[sourceTerm] ?? [])
    .map((id) => entriesById.get(id))
    .filter((entry): entry is WordForWordEntry => Boolean(entry?.meaning?.trim()));
  if (!candidates.length) return [];

  const mappedSectionId = songTitle ? referenceSectionBySongTitle.get(normalizeContext(songTitle)) : undefined;
  const sectionMatches = mappedSectionId ? candidates.filter((entry) => entry.sectionId === mappedSectionId) : [];
  const songMatches = songTitle ? candidates.filter((entry) => isContextualMatch(entry, songTitle)) : [];
  const contextual = sectionMatches.length ? sectionMatches : (songMatches.length ? songMatches : candidates);
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

  const { normalized: normalizedValue, indexes } = getNormalizedTextWithIndexes(value);
  const segments: WordForWordSegment[] = [];
  let plainStart = 0;
  let index = 0;

  while (index < normalizedValue.length) {
    let matchedTerm: string | null = null;
    let matchedEntries: WordForWordEntry[] = [];

    for (const term of termsWithAliases) {
      if (!normalizedValue.startsWith(term, index)) continue;
      const originalStart = indexes[index];
      const originalEnd = getOriginalEnd(value, indexes, index, term.length);
      if (!sandhiStartAliases.has(term) && isWordCharacter(value[originalStart - 1])) continue;
      if (!sandhiEndAliases.has(term) && isWordCharacter(value[originalEnd])) continue;
      const sourceTerms = sourceTermsByNormalizedTerm.get(term) ?? [];
      const entries = resolveEntries(sourceTerms, options.songTitle, options.verseNumber);
      if (entries.length) {
        matchedTerm = term;
        matchedEntries = entries;
        break;
      }
    }

    if (!matchedTerm) {
      index += 1;
      continue;
    }

    const originalStart = indexes[index];
    const originalEnd = getOriginalEnd(value, indexes, index, matchedTerm.length);
    if (originalStart > plainStart) segments.push({ text: value.slice(plainStart, originalStart), entries: [] });
    segments.push({ text: value.slice(originalStart, originalEnd), entries: matchedEntries });
    plainStart = originalEnd;
    index += matchedTerm.length;
  }

  if (plainStart < value.length) segments.push({ text: value.slice(plainStart), entries: [] });
  return segments.length ? segments : [{ text: value, entries: [] }];
}

export function getGlossaryStats() {
  return { entries: glossary.entries.length, terms: Object.keys(glossary.termIndex).length };
}
