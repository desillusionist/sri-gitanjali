import { describe, expect, it } from "vitest";
import { describeAuthorChange } from "./drafts";

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
