import { describe, expect, it } from "vitest";
import { describeAuthorChange, draftCount, getDrafts, recordingCount, setRecordings, setTranslationEdit, translationCount, undoRecordings, undoTranslation } from "./drafts";
import { applyRecordingEdits } from "./publish";
import { getSoundCloudRecordingUrls, soundCloudSingerName, soundCloudSingers, soundCloudTrackSecondsFor } from "@/domain/song";
import { parseTime, withPart } from "@/components/admin/RecordingsEditor";

describe("describing picture changes", () => {
  const before = { portrait: "a.webp", portraitLarge: "a-large.webp", face: [50, 40, 30] as [number, number, number], gallery: [{ src: "g1.webp" }, { src: "g2.webp", caption: "Two" }] };

  it("sees added, removed and reordered pictures", () => {
    const change = describeAuthorChange(before, { ...before, gallery: [{ src: "g2.webp", caption: "Two" }, { src: "new.webp" }] });
    expect(change).toMatchObject({ main: false, circle: false, added: 1, removed: 1, captions: false, order: false });
    expect(describeAuthorChange(before, { ...before, gallery: [before.gallery[1], before.gallery[0]] }).order).toBe(true);
  });

  it("sees a new main portrait without counting its picture as removed", () => {
    const change = describeAuthorChange(before, { portrait: "b.webp", portraitLarge: "b-large.webp", gallery: [{ src: "a-large.webp" }, { src: "g2.webp", caption: "Two" }] });
    expect(change).toMatchObject({ main: true, circle: false, added: 0, removed: 0 });
  });

  it("sees a moved circle and changed captions", () => {
    const change = describeAuthorChange(before, { ...before, face: [50, 42, 30], gallery: [before.gallery[0], { src: "g2.webp", caption: "Second" }] });
    expect(change).toMatchObject({ circle: true, captions: true, added: 0, removed: 0 });
  });
});

describe("verse translation changes", () => {
  it("counts, keeps and undoes them per language and verse", () => {
    setTranslationEdit("uk", "a::verse-1", "  Нове.  ");
    setTranslationEdit("ru", "a::verse-1", "Новое.");
    expect(getDrafts().translations).toEqual({ uk: { "a::verse-1": "Нове." }, ru: { "a::verse-1": "Новое." } });
    expect(translationCount(getDrafts())).toBe(2);
    expect(draftCount(getDrafts())).toBe(2);
    expect(getDrafts().dirty).toBe(true);
    undoTranslation("uk", "a::verse-1");
    undoTranslation("ru", "a::verse-1");
    expect(getDrafts().translations).toEqual({});
    expect(getDrafts().dirty).toBe(false);
  });
});

describe("recording changes", () => {
  const track = "https://soundcloud.com/someone/medley";
  const song = { id: "a-001", audioLinks: ["https://soundcloud.com/huron/a"] };

  it("replace a song's list in the app at once, with new singers and lengths", () => {
    setRecordings({ "a-001": [`${track}#t=0:00-1:00`, "https://soundcloud.com/huron/a"] }, { "/someone/medley": { singer: "new-singer", seconds: 300 } }, { "new-singer": "New Singer" });
    expect(getSoundCloudRecordingUrls(song)).toEqual([`${track}#t=0:00-1:00`, "https://soundcloud.com/huron/a"]);
    expect(soundCloudSingerName(track)).toBe("New Singer");
    expect(soundCloudSingers().some((singer) => singer.id === "new-singer")).toBe(true);
    expect(soundCloudTrackSecondsFor(`${track}#t=4:00`)).toBe(60);
    expect(recordingCount(getDrafts())).toBe(1);
    expect(getDrafts().dirty).toBe(true);
  });

  it("are published over the file, keeping its note and other songs", () => {
    const file = { _note: "x", songs: { "b-002": ["https://soundcloud.com/huron/b"] }, tracks: { "/huron/b": { seconds: 10 } }, singers: {} };
    const next = applyRecordingEdits(file, getDrafts().recordings);
    expect(next._note).toBe("x");
    expect(Object.keys(next.songs).sort()).toEqual(["a-001", "b-002"]);
    expect(next.tracks["/someone/medley"]).toEqual({ singer: "new-singer", seconds: 300 });
    expect(next.singers["new-singer"]).toBe("New Singer");
  });

  it("can be undone per song, taking the track details along", () => {
    undoRecordings("a-001");
    expect(getSoundCloudRecordingUrls(song)).toEqual(["https://soundcloud.com/huron/a"]);
    expect(getDrafts().recordings).toEqual({ songs: {}, tracks: {}, singers: {} });
    expect(getDrafts().dirty).toBe(false);
  });

  it("write the part into the address", () => {
    expect(withPart(`${track}#t=0:10-0:20`, 66, 80)).toBe(`${track}#t=1:06-1:20`);
    expect(withPart(track, 80, null)).toBe(`${track}#t=1:20`);
    expect(withPart(`${track}#t=1:06-1:20`, 0, null)).toBe(track);
    expect(parseTime("1:02:03")).toBe(3723);
    expect(parseTime("1:6")).toBeNull();
  });

  it("read times typed on a phone's number keys", () => {
    expect(parseTime("1.20")).toBe(80);
    expect(parseTime("1,20")).toBe(80);
    expect(parseTime("120")).toBe(80);
    expect(parseTime("45")).toBe(45);
    expect(parseTime("1035")).toBe(635);
    expect(parseTime("160")).toBeNull();
    expect(parseTime("1.5")).toBeNull();
  });
});
