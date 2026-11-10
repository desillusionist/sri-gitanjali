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

type Matcher = { regex: RegExp; lookup: Map<string, HolyNameMatch> };

function buildLatinMatcher(): Matcher {
  const lookup = new Map<string, HolyNameMatch>();
  for (const { name, match } of allNames("aliases")) {
    const key = fold(name).folded;
    if (!lookup.has(key)) lookup.set(key, match);
  }
  const keys = Array.from(lookup.keys()).sort((a, b) => b.length - a.length).map(escapeRegExp);
  return { regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.join("|")})(?![\\p{L}\\p{N}])`, "gu"), lookup };
}

type CyrillicMatcher = { regex: RegExp; stems: { pattern: RegExp; match: HolyNameMatch }[] };

function buildCyrillicMatcher(): CyrillicMatcher {
  // A trailing * lets up to four Russian case-ending letters follow the stem.
  // After a hyphen inside a name either case may follow: "Мадана-мохан" and "Мадана-Мохан".
  const anyCaseAfterHyphen = (name: string) => name.replace(new RegExp("-([а-яё])", "g"), (_match, letter: string) => `-[${letter}${letter.toUpperCase()}]`);
  const stemSource = (stem: string) => stem.split(" ").map((word) => word.endsWith("*") ? `${anyCaseAfterHyphen(escapeRegExp(word.slice(0, -1)))}[а-яё]{0,4}` : anyCaseAfterHyphen(escapeRegExp(word))).join("\\s+");
  const stems = allNames("ru")
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ name, match }) => ({ source: stemSource(name), match }));
  return {
    regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${stems.map((stem) => stem.source).join("|")})(?![\\p{L}\\p{N}])`, "gu"),
    stems: stems.map(({ source, match }) => ({ pattern: new RegExp(`^(?:${source})$`, "u"), match })),
  };
}

let latinMatcher: Matcher | null = null;
let cyrillicMatcher: CyrillicMatcher | null = null;

/** Splits text into plain runs and runs that name a personality or holy place. */
export function getHolyNameSegments(value: string): HolyNameSegment[] {
  const segments: HolyNameSegment[] = [];
  let cursor = 0;
  const push = (start: number, end: number, { entry, variant }: HolyNameMatch) => {
    if (start > cursor) segments.push({ text: value.slice(cursor, start) });
    segments.push({ text: value.slice(start, end), entry, variant });
    cursor = end;
  };

  if (/[а-яё]/i.test(value)) {
    cyrillicMatcher ??= buildCyrillicMatcher();
    for (const match of Array.from(value.matchAll(cyrillicMatcher.regex))) {
      const found = cyrillicMatcher.stems.find((stem) => stem.pattern.test(match[0]))?.match;
      if (found) push(match.index!, match.index! + match[0].length, found);
    }
  } else {
    latinMatcher ??= buildLatinMatcher();
    const { folded, sourceIndex } = fold(value);
    for (const match of Array.from(folded.matchAll(latinMatcher.regex))) {
      const found = latinMatcher.lookup.get(match[0]);
      if (found) push(sourceIndex[match.index!], sourceIndex[match.index! + match[0].length], found);
    }
  }

  if (cursor < value.length) segments.push({ text: value.slice(cursor) });
  return segments;
}
