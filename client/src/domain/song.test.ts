import { describe, expect, it } from "vitest";
import { ALL_AUTHORS_FILTER, ALL_CATEGORIES_FILTER, ALL_RECORDINGS_FILTER, WITH_RECORDINGS_FILTER, ALL_LANGUAGES_FILTER, defaultSongSearchFilters, filterSongs, footnoteFieldId, getOriginalMatchRanges, getSongRecordings, getSongSearchExcerpt, getSongSearchMatches, normalizeSearchText, parseRecordingFilter, singerRecordingFilter, verseFootnoteTexts, type Song } from "./song";

describe("search phrase normalization", () => {
  it("treats spaces, hyphens, and n-dashes as equivalent separators", () => {
    expect(normalizeSearchText("gaura ārati")).toBe("gauraarati");
    expect(normalizeSearchText("gaura-ārati")).toBe("gauraarati");
    expect(normalizeSearchText("gaura–ārati")).toBe("gauraarati");
  });

  it("keeps the original range wide enough to highlight the source separator", () => {
    expect(getOriginalMatchRanges("gaura–ārati", "gaura ārati")).toEqual([{ start: 0, end: 11 }]);
    expect(getOriginalMatchRanges("gaura ārati", "gaura-ārati")).toEqual([{ start: 0, end: 11 }]);
  });
});

describe("recording filter by singer", () => {
  const song = (id: string, audioLinks: string[]) => ({ id, title: id, verses: [], audioLinks }) as unknown as Song;
  const songs = [
    song("both", ["https://soundcloud.com/huron/a", "https://soundcloud.com/bhakti-lalita-devi/b"]),
    song("lalita", ["https://soundcloud.com/bhakti-lalita-devi/c"]),
    song("none", []),
  ];
  const filters = { query: "", author: ALL_AUTHORS_FILTER, category: ALL_CATEGORIES_FILTER };

  it("keeps only songs that singer recorded", () => {
    expect(filterSongs(songs, { ...filters, recording: singerRecordingFilter("bhakti-lalita-devi") }).map((item) => item.id)).toEqual(["both", "lalita"]);
    expect(filterSongs(songs, { ...filters, recording: singerRecordingFilter("huron") }).map((item) => item.id)).toEqual(["both"]);
    expect(filterSongs(songs, { ...filters, recording: WITH_RECORDINGS_FILTER }).map((item) => item.id)).toEqual(["both", "lalita"]);
  });

  it("reads the filter from the address bar, ignoring unknown singers", () => {
    expect(parseRecordingFilter("singer:huron")).toBe("singer:huron");
    expect(parseRecordingFilter("singer:someone-else")).toBe(ALL_RECORDINGS_FILTER);
    expect(parseRecordingFilter(null)).toBe(ALL_RECORDINGS_FILTER);
  });
});

describe("search in the second translation", () => {
  const song = {
    id: "s1", title: "Vibhāvarī śeṣa", poet: "", category: "Morning",
    verses: [{ id: "verse-1", lines: [{ id: "l1", transliteration: "vibhāvarī śeṣa, āloka-praveśa" }], translation: "The night has come to an end." }],
  } as unknown as Song;
  const spanish = new Map([["s1::verse-1", "La noche terminó y la alborada despunta."]]);
  const lookup = (item: Song, verse: { id: string }) => spanish.get(`${item.id}::${verse.id}`);
  const filters = { query: "alborada", author: ALL_AUTHORS_FILTER, category: ALL_CATEGORIES_FILTER, recording: ALL_RECORDINGS_FILTER, language: ALL_LANGUAGES_FILTER } as const;

  it("finds songs by their second translation only when one is given", () => {
    expect(filterSongs([song], filters)).toHaveLength(0);
    expect(filterSongs([song], filters, lookup)).toHaveLength(1);
    expect(filterSongs([song], { ...filters, query: "TERMINO" }, lookup)).toHaveLength(1);
  });

  it("counts and quotes matches in the second translation", () => {
    expect(getSongSearchMatches(song, "alborada", lookup).map((match) => match.fieldId)).toEqual(["secondary:verse-1"]);
    expect(getSongSearchExcerpt(song, "alborada", lookup)?.source).toBe("secondaryTranslation");
    expect(getSongSearchExcerpt(song, "alborada")).toBeNull();
  });
});

describe("recordings list", () => {
  it("lists each recording with its song, in book order", () => {
    const songs = [
      { id: "a", title: "A", verses: [], audioLinks: ["https://soundcloud.com/huron/a", "https://soundcloud.com/bhakti-lalita-devi/a2"] },
      { id: "b", title: "B", verses: [] },
    ] as unknown as Song[];
    expect(getSongRecordings(songs).map((recording) => [recording.song.id, recording.singer])).toEqual([["a", "Manasa Krishna"], ["a", "Bhakti Lalita Devi"]]);
  });

  it("finds a word with or without its final a, across spaces and hyphens", () => {
    expect(getOriginalMatchRanges("Gopīnāth, Madana-mohana!", "Madan mohana")).toEqual([{ start: 10, end: 23 }]);
    expect(getOriginalMatchRanges("Madan-mohan", "madana mohana")).toEqual([{ start: 0, end: 11 }]);
    expect(getOriginalMatchRanges("O Gopāla", "gopal")).toEqual([{ start: 2, end: 8 }]);
  });

  it("folds transliteration spellings on both sides", () => {
    expect(getOriginalMatchRanges("jaya kṛṣṇa", "krishna")).toEqual([{ start: 5, end: 10 }]);
    expect(getOriginalMatchRanges("śrī gaurāṅga", "shri gauranga")).toEqual([{ start: 0, end: 12 }]);
    expect(getOriginalMatchRanges("Śrī Chaitanya", "caitanya")).toEqual([{ start: 4, end: 13 }]);
    expect(getOriginalMatchRanges("Navadvīp", "nabadwip")).toEqual([{ start: 0, end: 8 }]);
    expect(getOriginalMatchRanges("Śrī Vṛndāvan", "brindaban")).toEqual([{ start: 4, end: 12 }]);
    expect(getOriginalMatchRanges("in Vṛndāvan—there", "vrindavan")).toEqual([{ start: 3, end: 11 }]);
    expect(getOriginalMatchRanges("Koladvīp", "koladwip")).toEqual([{ start: 0, end: 8 }]);
    expect(getOriginalMatchRanges("Krishna", "krsna")).toEqual([{ start: 0, end: 7 }]);
  });
});

describe("footnotes in search", () => {
  it("finds a song by the text of its footnote", async () => {
    const songs = (await import("../../../local-storage/songs_577f33d4.json")).default as unknown as Song[];
    const song = songs.find((item) => item.id === "sri-vaisnava-mahima-giti-055")!;
    const verse = song.verses.find((item) => item.id === "verse-2")!;
    expect(verseFootnoteTexts(song, verse).primary.length).toBe(1);
    const query = "overendeavouring";
    expect(filterSongs(songs, { ...defaultSongSearchFilters, query }).map((item) => item.id)).toContain(song.id);
    expect(getSongSearchMatches(song, query).some((match) => match.kind === "footnote" && match.fieldId === footnoteFieldId("verse-2", 0))).toBe(true);
    expect(getSongSearchExcerpt(song, query)?.source).toBe("footnote");
  });
});
