/** Footnotes to verse translations, shown as a marker in the text that opens a short pop-up. */
import data from "@/data/footnotes.json";

export type Footnote = { after?: string; text: string };
/** A footnote's place in the text, and its index in the verse's list. */
export type PlacedFootnote = { at: number; text: string; index: number };

const footnotes = data as unknown as Record<string, Record<string, Footnote[]> | string>;

export function getFootnotes(language: string, songId: string, verseId: string): Footnote[] {
  const byVerse = footnotes[language];
  return typeof byVerse === "object" ? byVerse[`${songId}::${verseId}`] ?? [] : [];
}

/** Where each footnote sits in the text: after its anchor phrase, or at the end. */
export function placeFootnotes(value: string, notes: Footnote[]): PlacedFootnote[] {
  return notes.map((note, index) => {
    const anchor = note.after ? value.indexOf(note.after) : -1;
    return { at: anchor >= 0 ? anchor + note.after!.length : value.length, text: note.text, index };
  }).sort((left, right) => left.at - right.at);
}
