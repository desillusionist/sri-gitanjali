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

  it("uses the supplied Gurv-aṣṭaka synonyms for the correct verse context", () => {
    const songTitle = "Śrī Śrī Gurv-aṣṭaka Eight Prayers to the Guru by Śrīla Viśvanātha Chakravartī Ṭhākura";
    const verseTwo = getWordForWordSegments("aśru-taraṅga", { songTitle, verseNumber: 2 });
    const verseEight = getWordForWordSegments("tri-sandhyam", { songTitle, verseNumber: 8 });
    expect(verseTwo[0].entries[0]?.meaning).toBe("torrents of tears");
    expect(verseEight[0].entries[0]?.meaning).toContain("three times a day");
  });

  it("matches inflected and sandhi surface forms from Gurv-aṣṭaka", () => {
    const cases: Array<[string, string]> = [
      ["mādyan-manaso", "gladdened"], ["kampāśru-taraṅga-bhājo", "quivering"],
      ["śrī-vigrahārādhana-", "worship"], ["śṛṅgāra-tan-", "of the Lord"],
      ["bhaktāṁś", "his disciples"], ["niyuñjato", "who engages"], ["chatur-", "four"],
      ["svādv-", "palatable"], ["bhakta-saṅghān", "devotees"], ["kṛtvaiva", "having made"],
      ["sadaiva", "always"], ["mādhavayor apara", "unlimited"], ["prati-kṣaṇāsvādana-", "relishing"],
      ["nikuñja-yūno", "Rādhā and Kṛṣṇa"], ["-siddhyair", "perfection"], ["yā yālibhir yuktir", "arrangements"],
      ["tatrāti-dākṣyād", "very expert"], ["sākṣād-dharitvena", "quality of Hari"], ["-śāstrair", "scriptures"],
      ["uktas", "acknowledged"], ["bhāvyata", "considered"], ["prabhor", "Lord"], ["priya", "dear"],
      ["prasādād", "grace"], ["-prasādo", "mercy"], ["kuto ’pi", "anywhere"], ["dhyayaṁ stuvaṁs", "praising"],
      ["yaśas tri-sandhyaṁ", "glory"],
    ];
    for (const [surface, expected] of cases) {
      const matched = getWordForWordSegments(surface).filter((segment) => segment.entries.length);
      expect(matched.length, surface).toBeGreaterThan(0);
      expect(matched.some((segment) => segment.entries.some((entry) => entry.meaning?.toLowerCase().includes(expected.toLowerCase()))), surface).toBe(true);
    }
  });

  it("matches Aruṇodaya-kīrtan II transliteration and sandhi variants", () => {
    const songTitle = "Aruṇodaya-kīrtana II Jīv Jāgo (from Gītāvalī)";
    const cases: Array<[string, number, string]> = [
      ["gaurāchā̐da bole", 1, "Lord Gaurāṅga calls"],
      ["kota nidrā jāo", 1, "how long are you sleeping"],
      ["māyā-piśāchīra", 1, "witch Māyā"],
      ["ke āchhe", 3, "who is"],
      ["prabhura-charaṇe", 5, "lotus feet"],
    ];
    for (const [surface, verseNumber, expected] of cases) {
      const matched = getWordForWordSegments(surface, { songTitle, verseNumber }).filter((segment) => segment.entries.length);
      expect(matched.length, surface).toBeGreaterThan(0);
      expect(matched.some((segment) => segment.entries.some((entry) => entry.meaning?.toLowerCase().includes(expected.toLowerCase()))), surface).toBe(true);
    }
  });

  it("matches the current Aruṇodoya-kīrtan 1 text against the reference glossary", () => {
    const cases: Array<[string, string]> = [
      ["tāthai tāthai", "making the sound"], ["mukunda mādhava jādava hari", "Yādava"],
      ["sonāra aṅga", "golden form"], ["bolore", "oh sing"],
      ["śorīra sāje", "decorating your bodies"], ["durllabha", "rare"],
      ["ki kara", "what are you doing"], ["nāmāśroya kori'", "taking shelter"],
      ["kichu nāhiko āro", "nothing else"], ["chaudda-bhuvana-mājhe", "fourteen worlds"],
      ["jagate āsi'", "material universe"], ["avidyā-timira-tapana-rūpe", "like the sun"],
    ];
    for (const [surface, expected] of cases) {
      const matched = getWordForWordSegments(surface).filter((segment) => segment.entries.length);
      expect(matched.length, surface).toBeGreaterThan(0);
      expect(matched.some((segment) => segment.entries.some((entry) => entry.meaning?.toLowerCase().includes(expected.toLowerCase()))), surface).toBe(true);
    }
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
    expect(getGlossaryStats()).toEqual({ entries: 2824, terms: 2330 });
  });
});
