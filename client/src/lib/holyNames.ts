/** Personalities and holy places named in the translations, found so they can be underlined with a short note. */
import data from "@/data/holy-names.json";

export type HolyNameKind = "person" | "divine" | "place" | "realm" | "other";

export type HolyName = {
  id: string;
  kind: HolyNameKind;
  name: string;
  about: string;
  aliases: string[];
  ru: string[];
  authorId?: string;
  /** Google Maps search for places on Earth. */
  maps?: string;
  /** Other names of the same personality or place, each with its own note. */
  variants?: HolyNameVariant[];
};

export type HolyNameVariant = { key: string; name: string; about: string; aliases: string[]; ru: string[] };

export type HolyNameSegment = { text: string; entry?: HolyName; variant?: HolyNameVariant };

type HolyNameMatch = { entry: HolyName; variant?: HolyNameVariant };

/** Every spelling (Latin aliases, Russian stems) with the entry and, for another name, its variant. */
function allNames(field: "aliases" | "ru") {
  return HOLY_NAMES.flatMap((entry) => [
    ...entry[field].map((name) => ({ name, match: { entry } as HolyNameMatch })),
    ...(entry.variants ?? []).flatMap((variant) => variant[field].map((name) => ({ name, match: { entry, variant } as HolyNameMatch }))),
  ]);
}

export const HOLY_NAMES = (data as { entries: HolyName[] }).entries;

export function holyNameMapsUrl(entry: HolyName): string | undefined {
  return entry.maps ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.maps)}` : undefined;
}

const COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

/** Strips accents and unifies apostrophes, keeping one folded character per source character. */
function foldChar(char: string): string {
  if (char === "’" || char === "‘") return "'";
  return char.normalize("NFD").replace(COMBINING_MARKS, "") || char;
}

function fold(value: string): { folded: string; sourceIndex: number[] } {
  let folded = "";
  const sourceIndex: number[] = [];
  let index = 0;
  for (const char of value) {
    const piece = foldChar(char);
    for (let k = 0; k < piece.length; k += 1) sourceIndex.push(index);
    folded += piece;
    index += char.length;
  }
  sourceIndex.push(index);
  return { folded, sourceIndex };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A language's own spellings, from its notes file: each entry's name (or its aliases instead), and words that only look like names. */
export type LocalHolyNames = {
  code: string;
  entries: Record<string, { name?: string; aliases?: string[] }>;
  ignore?: string[];
};

/** Languages written without spaces between words: their names may sit right next to other words. */
const UNSPACED_LANGUAGES = new Set(["zh", "th"]);

type Named = { name: string; match: HolyNameMatch | null };
type Matcher = { regex: RegExp; stems: { pattern: RegExp; match: HolyNameMatch | null }[] };

function localNames(local: LocalHolyNames): Named[] {
  const byKey = new Map<string, HolyNameMatch>();
  for (const entry of HOLY_NAMES) {
    byKey.set(entry.id, { entry });
    for (const variant of entry.variants ?? []) byKey.set(`${entry.id}/${variant.key}`, { entry, variant });
  }
  const names: Named[] = [];
  for (const [key, note] of Object.entries(local.entries)) {
    const match = byKey.get(key);
    if (!match) continue;
    for (const name of note.aliases ?? (note.name ? [note.name] : [])) names.push({ name, match });
  }
  for (const name of local.ignore ?? []) names.push({ name, match: null });
  return names;
}

/**
 * One regular expression for all spellings, longest first. A word ending in * lets up to four
 * letters of a case ending follow. Latin-script text is matched without accents ("Vrndavan"
 * finds "Vṛndāvan"); in Cyrillic the first letter after a hyphen may be either case
 * ("Мадана-мохан" and "Мадана-Мохан").
 */
function buildMatcher(names: Named[], { cyrillic, unspaced }: { cyrillic: boolean; unspaced: boolean }): Matcher {
  const anyCaseAfterHyphen = (name: string) => name.replace(new RegExp("-([а-яёіїєґ])", "g"), (_match, letter: string) => `-[${letter}${letter.toUpperCase()}]`);
  const wordSource = (word: string) => {
    const isStem = word.endsWith("*");
    const base = isStem ? word.slice(0, -1) : word;
    const escaped = escapeRegExp(cyrillic ? base : fold(base).folded);
    return (cyrillic ? anyCaseAfterHyphen(escaped) : escaped) + (isStem ? "\\p{L}{0,4}" : "");
  };
  const stems = names
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ name, match }) => ({ source: name.split(" ").map(wordSource).join("\\s+"), match }));
  const body = `(?:${stems.map((stem) => stem.source).join("|")})`;
  return {
    regex: new RegExp(unspaced ? body : `(?<![\\p{L}\\p{M}\\p{N}])${body}(?![\\p{L}\\p{M}\\p{N}])`, "gu"),
    stems: stems.map(({ source, match }) => ({ pattern: new RegExp(`^(?:${source})$`, "u"), match })),
  };
}

const matchers = new Map<string, Matcher>();

function getMatcher(cyrillic: boolean, local?: LocalHolyNames | null): Matcher {
  const key = `${cyrillic ? "cyrillic" : "latin"}:${local?.code ?? ""}`;
  let matcher = matchers.get(key);
  if (!matcher) {
    matcher = buildMatcher([...allNames(cyrillic ? "ru" : "aliases"), ...(local ? localNames(local) : [])], { cyrillic, unspaced: UNSPACED_LANGUAGES.has(local?.code ?? "") });
    matchers.set(key, matcher);
  }
  return matcher;
}

/**
 * Splits text into plain runs and runs that name a personality or holy place. With a language's
 * own spellings, a translation in that language finds its names as it writes them.
 */
export function getHolyNameSegments(value: string, local?: LocalHolyNames | null): HolyNameSegment[] {
  const segments: HolyNameSegment[] = [];
  let cursor = 0;
  const cyrillic = /[а-яёіїєґ]/i.test(value);
  const { regex, stems } = getMatcher(cyrillic, local);
  const { folded, sourceIndex } = cyrillic ? { folded: value, sourceIndex: null } : fold(value);
  for (const match of Array.from(folded.matchAll(regex))) {
    const found = stems.find((stem) => stem.pattern.test(match[0]))?.match;
    if (!found) continue;
    const start = sourceIndex ? sourceIndex[match.index!] : match.index!;
    const end = sourceIndex ? sourceIndex[match.index! + match[0].length] : match.index! + match[0].length;
    if (start > cursor) segments.push({ text: value.slice(cursor, start) });
    segments.push({ text: value.slice(start, end), entry: found.entry, variant: found.variant });
    cursor = end;
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor) });
  return segments;
}
