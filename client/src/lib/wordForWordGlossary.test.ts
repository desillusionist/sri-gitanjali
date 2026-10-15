import { describe, expect, it } from "vitest";
import { getGlossaryStats, getWordForWordSegments } from "@/lib/wordForWordGlossary";

describe("word-for-word glossary", () => {
  it("matches exact words and longest hyphenated phrases", () => {
    const segments = getWordForWordSegments("jñāna-añjana śalākayā", { songTitle: "Śrī Guru Praṇāma" });
    expect(segments.map((segment) => segment.text).join("")).toBe("jñāna-añjana śalākayā");
    expect(segments.filter((segment) => segment.entries.length).map((segment) => segment.text)).toEqual(["jñāna-añjana", "śalākayā"]);
    expect(segments[0].entries[0]?.meaning).toContain("ointment");
  });

  it("matches verse compounds when glossary hyphens split different word boundaries", () => {
    const segments = getWordForWordSegments("saṁsāra-dāvānala-līḍha-loka-");
    const matchedTerms = segments.filter((segment) => segment.entries.length).map((segment) => segment.text);
    expect(matchedTerms).toEqual(["saṁsāra", "dāvānala", "līḍha", "loka"]);
    expect(segments.map((segment) => segment.text).join("")).toBe("saṁsāra-dāvānala-līḍha-loka-");
    expect(segments.find((segment) => segment.text === "dāvānala")?.entries[0]?.meaning).toContain("forest fire");
  });

  it("matches sandhi-fused words against separate glossary entries", () => {
    const segments = getWordForWordSegments("guṇārṇavasya charaṇāravindam");
    const matchedTerms = segments.filter((segment) => segment.entries.length).map((segment) => segment.text);
    expect(matchedTerms).toEqual(["guṇā", "rṇavasya", "charaṇāravindam"]);
    expect(segments.find((segment) => segment.text === "guṇā")?.entries[0]?.meaning).toContain("qualities");
    expect(segments.find((segment) => segment.text === "rṇavasya")?.entries[0]?.meaning).toContain("ocean");
    expect(segments.find((segment) => segment.text === "charaṇāravindam")?.entries[0]?.meaning).toContain("lotus feet");
  });

  it("prefers the current song context for repeated terms", () => {
    const guru = getWordForWordSegments("yena", { songTitle: "Śrī Guru Praṇāma" });
    const rupa = getWordForWordSegments("yena", { songTitle: "Śrī Rūpa Praṇāma" });
    expect(guru[0].entries.length).toBeGreaterThan(0);
    expect(rupa[0].entries.length).toBeGreaterThan(0);
    expect(guru[0].entries.every((entry) => entry.songOrPrayer === "Śrī Guru Praṇāma")).toBe(true);
    expect(rupa[0].entries.every((entry) => entry.songOrPrayer === "Śrī Rūpa Praṇāma")).toBe(true);
  });

  it("ignores source-only entries and preserves punctuation around matches", () => {
    const sourceOnly = getWordForWordSegments("gopināth,", { songTitle: "Gopīnātha (from Kalyāṇa-kalpataru)" });
    const punctuated = getWordForWordSegments("namaḥ,", { songTitle: "Śrī Guru Praṇāma" });
    expect(sourceOnly).toEqual([{ text: "gopināth,", entries: [] }]);
    expect(punctuated.map((segment) => segment.text).join("")).toBe("namaḥ,");
    expect(punctuated[0].entries[0]?.meaning).toBe("obeisances");
  });

  it("loads the complete static dataset once", () => {
    expect(getGlossaryStats()).toEqual({ entries: 2820, terms: 2325 });
  });
});
