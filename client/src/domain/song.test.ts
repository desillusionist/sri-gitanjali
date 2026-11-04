import { describe, expect, it } from "vitest";
import { ALL_AUTHORS_FILTER, ALL_CATEGORIES_FILTER, ALL_RECORDINGS_FILTER, WITH_RECORDINGS_FILTER, filterSongs, getOriginalMatchRanges, normalizeSearchText, parseRecordingFilter, singerRecordingFilter, type Song } from "./song";

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
