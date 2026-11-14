import { describe, expect, it } from "vitest";
import { applyHolyNameEdits, GENERATED_HOLY_NAMES } from "@/lib/holyNames";
import { applyLocalEdits } from "@/lib/holyNamesI18n";
import { clampFace, fullFrame } from "@/lib/portraitCrops";
import { applyAuthorPictures, applyNoteEdits, usedFiles } from "./publish";

describe("admin publishing", () => {
  const file = {
    _note: "kept",
    authors: [
      { id: "a", name: "A", portrait: "a.webp", portraitLarge: "a-large.webp", face: [50, 40, 30], summary: "s" },
      { id: "b", name: "B", summary: "t" },
    ],
  };

  it("changes only the picture fields, keeping the other fields and their order", () => {
    const next = applyAuthorPictures(file, { a: { portrait: "a2.webp", portraitLarge: "a2-large.webp", gallery: [{ src: "a-large.webp", caption: "Old" }] } });
    expect(Object.keys(next.authors[0])).toEqual(["id", "name", "portrait", "portraitLarge", "summary", "gallery"]);
    expect(next.authors[0].face).toBeUndefined();
    expect(next.authors[1]).toBe(file.authors[1]);
    expect(next._note).toBe("kept");
    expect(Array.from(usedFiles(next)).sort()).toEqual(["a-large.webp", "a2-large.webp", "a2.webp"]);
  });

  it("lays note changes over the edits file", () => {
    const next = applyNoteEdits({ entries: { x: { about: "old" } }, i18n: { ru: { x: { about: "старое" } } } }, { notes: { y: { kind: "book", name: "Y", about: "new" } }, localNotes: { ru: { y: { about: "новое" } } } });
    expect(next.entries).toEqual({ x: { about: "old" }, y: { kind: "book", name: "Y", about: "new" } });
    expect(next.i18n.ru).toEqual({ x: { about: "старое" }, y: { about: "новое" } });
  });

  it("applies note edits: changed text, hidden notes, new notes", () => {
    const entries = applyHolyNameEdits(GENERATED_HOLY_NAMES, {
      vedas: { about: "Changed." },
      saranagati: { hidden: true },
      "krishna/govinda": { about: "Changed name note." },
      "new-place": { kind: "place", name: "New Place", about: "A place.", maps: "New Place, India" },
    });
    expect(entries.find((entry) => entry.id === "vedas")?.about).toBe("Changed.");
    expect(entries.some((entry) => entry.id === "saranagati")).toBe(false);
    expect(entries.find((entry) => entry.id === "krishna")?.variants?.find((variant) => variant.key === "govinda")?.about).toBe("Changed name note.");
    expect(entries.find((entry) => entry.id === "new-place")).toMatchObject({ kind: "place", aliases: ["New Place"], ru: [] });
  });

  it("applies a language's note edits", () => {
    const locale = { ui: { kinds: {} as never, page: "", map: "" }, entries: { a: { name: "А", about: "Было." }, b: { about: "Б." } } };
    const next = applyLocalEdits(locale, { a: { about: "Стало." }, b: { hidden: true } });
    expect(next.entries).toEqual({ a: { name: "А", about: "Стало." } });
  });

  it("frames a 3:4 portrait inside the picture", () => {
    expect(fullFrame(100, 4 / 3)).toEqual([50, 50, 75]);
    expect(clampFace([10, 10, 90], 100, 4 / 3)).toEqual([37.5, 50, 75]);
  });
});
