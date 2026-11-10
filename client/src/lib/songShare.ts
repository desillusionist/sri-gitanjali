/** Song text and links for sharing, built from what the reader currently has on screen. */
import { placeFootnotes, type Footnote } from "@/lib/footnotes";

export type SongShareVerse = {
  originalVerseNumber: number | string;
  lines: { transliteration: string; isIndented?: boolean }[];
  /** Present only when the verse's translation is open on screen. */
  translation?: string;
  /** Present only when a second translation is on and loaded for this verse. */
  secondaryTranslation?: string;
  /** Footnotes to each translation, shared with it. */
  footnotes?: Footnote[];
  secondaryFootnotes?: Footnote[];
};

/**
 * A translation with its footnotes: a * (then **, ***) where each sits in the text, and the notes
 * below it in the same order. In Markdown the asterisks are escaped.
 */
export function withFootnotes(value: string, notes: Footnote[] = [], format: "plain" | "markdown" = "plain"): { text: string; notes: string[] } {
  const placed = placeFootnotes(value, notes);
  const star = (count: number) => (format === "markdown" ? "\\*" : "*").repeat(count);
  let text = "";
  let cursor = 0;
  placed.forEach((note, order) => {
    text += value.slice(cursor, note.at) + star(order + 1);
    cursor = note.at;
  });
  text += value.slice(cursor);
  return { text, notes: placed.map((note, order) => `${star(order + 1)} ${note.text}`) };
}

export type SongShareContent = {
  title: string;
  poet?: string;
  verses: SongShareVerse[];
  /** Short code shown before the second translation, e.g. "RU". */
  secondaryLabel?: string;
  verseLabel: string;
  url: string;
};

export function buildSongShareText(content: SongShareContent, format: "plain" | "markdown"): string {
  const { title, poet, verses, secondaryLabel, verseLabel, url } = content;
  const blocks: string[] = [];

  if (format === "plain") {
    blocks.push([title, poet].filter(Boolean).join("\n"));
    for (const verse of verses) {
      const parts = [`(${verse.originalVerseNumber})`, ...verse.lines.map((line) => line.transliteration)];
      if (verse.translation) {
        const { text, notes } = withFootnotes(verse.translation, verse.footnotes);
        parts.push("", text, ...notes);
      }
      if (verse.secondaryTranslation) {
        const { text, notes } = withFootnotes(verse.secondaryTranslation, verse.secondaryFootnotes);
        parts.push("", secondaryLabel ? `${secondaryLabel}: ${text}` : text, ...notes);
      }
      blocks.push(parts.join("\n"));
    }
    blocks.push(url);
  } else {
    blocks.push([`# ${title}`, poet ? `*${poet}*` : ""].filter(Boolean).join("\n\n"));
    for (const verse of verses) {
      // Two trailing spaces keep each sung line on its own line in Markdown.
      const lines = verse.lines.map((line) => `${line.isIndented ? "&emsp;" : ""}${line.transliteration}`).join("  \n");
      const parts = [`### ${capitalize(verseLabel)} ${verse.originalVerseNumber}`, lines];
      if (verse.translation) {
        const { text, notes } = withFootnotes(verse.translation, verse.footnotes, "markdown");
        parts.push(`> ${text}`, ...notes.map((note) => `<small>${note}</small>`));
      }
      if (verse.secondaryTranslation) {
        const { text, notes } = withFootnotes(verse.secondaryTranslation, verse.secondaryFootnotes, "markdown");
        parts.push(`> ${secondaryLabel ? `**${secondaryLabel}:** ` : ""}${text}`, ...notes.map((note) => `<small>${note}</small>`));
      }
      blocks.push(parts.join("\n\n"));
    }
    blocks.push(`[${title}](${url})`);
  }

  return blocks.join("\n\n");
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** What a shared link opens with: which translations are open, the second language and hidden ornaments. */
export type SongShareView = {
  /** "all", "none", or the verse ids whose translations are open. */
  translations: "all" | "none" | string[];
  secondaryLanguage: string | null;
  areOrnamentsHidden: boolean;
};

export function songShareParams(view: SongShareView, verseIds: string[]): URLSearchParams {
  const params = new URLSearchParams();
  if (view.translations === "all") params.set("tr", "all");
  else if (view.translations === "none") params.set("tr", "0");
  else if (Array.isArray(view.translations)) {
    const positions = view.translations.map((id) => verseIds.indexOf(id) + 1).filter((position) => position > 0);
    params.set("tr", positions.length ? positions.join(",") : "0");
  }
  if (view.secondaryLanguage) params.set("lang", view.secondaryLanguage);
  if (view.areOrnamentsHidden) params.set("plain", "1");
  return params;
}

/** Reads a shared view from a URL's query; fields the link does not set are left out. */
export function parseSongShareParams(search: string, verseIds: string[]): Partial<SongShareView> {
  const params = new URLSearchParams(search);
  const view: Partial<SongShareView> = {};
  const tr = params.get("tr");
  if (tr === "all") view.translations = "all";
  else if (tr === "0") view.translations = "none";
  else if (tr) {
    const ids = tr.split(",").map((position) => verseIds[Number(position) - 1]).filter(Boolean);
    view.translations = ids.length === verseIds.length ? "all" : ids;
  }
  const lang = params.get("lang");
  if (lang) view.secondaryLanguage = lang;
  if (params.get("plain") === "1") view.areOrnamentsHidden = true;
  return view;
}
