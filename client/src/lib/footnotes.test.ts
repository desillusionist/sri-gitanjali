import { describe, expect, it } from "vitest";
import { getFootnotes, placeFootnotes } from "./footnotes";

describe("footnotes", () => {
  it("sit after their anchor, or at the end", () => {
    expect(placeFootnotes("святого общения. Я преклоняюсь", [{ after: "общения", text: "x" }])).toEqual([{ at: 15, text: "x" }]);
    expect(placeFootnotes("Verse text.", [{ text: "y" }])).toEqual([{ at: 11, text: "y" }]);
  });

  it("are found for the verse they belong to and their anchors exist", async () => {
    const songs = (await import("../../../local-storage/songs_577f33d4.json")).default as { id: string; verses: { id: string; translation: string }[] }[];
    const ru = (await import("../../../local-storage/ru_user_updates_cd7dcc2b.json")).default.translations as Record<string, string>;
    const data = (await import("@/data/footnotes.json")).default as unknown as Record<string, Record<string, { after?: string; text: string }[]> | string>;
    for (const [language, byVerse] of Object.entries(data)) {
      if (typeof byVerse !== "object") continue;
      for (const [key, notes] of Object.entries(byVerse)) {
        const [songId, verseId] = key.split("::");
        const text = language === "en" ? songs.find((song) => song.id === songId)?.verses.find((verse) => verse.id === verseId)?.translation : ru[key];
        expect(text, key).toBeTruthy();
        for (const note of notes) if (note.after) expect(text!.includes(note.after), `${key}: ${note.after}`).toBe(true);
        expect(getFootnotes(language, songId, verseId)).toHaveLength(notes.length);
      }
    }
    expect(songs.some((song) => song.verses.some((verse) => verse.translation?.includes("Footnote:")))).toBe(false);
  });
});
