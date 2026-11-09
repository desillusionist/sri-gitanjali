/** Song text and links for sharing, built from what the reader currently has on screen. */

export type SongShareVerse = {
  originalVerseNumber: number | string;
  lines: { transliteration: string; isIndented?: boolean }[];
  /** Present only when the verse's translation is open on screen. */
  translation?: string;
  /** Present only when a second translation is on and loaded for this verse. */
  secondaryTranslation?: string;
};

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
      if (verse.translation) parts.push("", verse.translation);
      if (verse.secondaryTranslation) parts.push("", secondaryLabel ? `${secondaryLabel}: ${verse.secondaryTranslation}` : verse.secondaryTranslation);
      blocks.push(parts.join("\n"));
    }
    blocks.push(url);
  } else {
    blocks.push([`# ${title}`, poet ? `*${poet}*` : ""].filter(Boolean).join("\n\n"));
    for (const verse of verses) {
      // Two trailing spaces keep each sung line on its own line in Markdown.
      const lines = verse.lines.map((line) => `${line.isIndented ? "&emsp;" : ""}${line.transliteration}`).join("  \n");
      const parts = [`### ${capitalize(verseLabel)} ${verse.originalVerseNumber}`, lines];
      if (verse.translation) parts.push(`> ${verse.translation}`);
      if (verse.secondaryTranslation) parts.push(`> ${secondaryLabel ? `**${secondaryLabel}:** ` : ""}${verse.secondaryTranslation}`);
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
