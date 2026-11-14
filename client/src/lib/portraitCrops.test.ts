import { describe, expect, it } from "vitest";
import { clampFace, defaultFace, dragFace, faceStyle, formatFaceChanges, sameFace, zoomFace } from "./portraitCrops";

describe("portrait circles", () => {
  it("starts from the crop a portrait shows without a face box", () => {
    expect(defaultFace()).toEqual([50, 55, 100]);
    expect(faceStyle([50, 55, 100])).toEqual({ width: "100%", left: "0%", top: "-5%" });
  });

  it("moves the picture with the finger and zooms around the centre", () => {
    // Dragging right by a quarter of a 200-px circle that shows 40% of the width moves the centre 10% left.
    expect(dragFace([50, 50, 40], 50, 0, 200)).toEqual([40, 50, 40]);
    expect(dragFace([50, 50, 40], 0, -50, 200)).toEqual([50, 60, 40]);
    expect(zoomFace([50, 50, 40], 2)).toEqual([50, 50, 20]);
  });

  it("keeps the circle inside the picture", () => {
    expect(clampFace([2, 140, 30])).toEqual([15, 118.3, 30]);
    expect(clampFace([50, 50, 150])).toEqual([50, 50, 100]);
    expect(clampFace([50, 50, 1])).toEqual([50, 50, 8]);
  });

  it("writes one line per changed portrait", () => {
    expect(sameFace([50, 36.5, 46], [50, 36.5, 46])).toBe(true);
    expect(formatFaceChanges({ "sridhar-maharaj": [48, 36.5, 46] }, [{ id: "sridhar-maharaj", name: "Śrīla Śrīdhar Mahārāja" }]))
      .toBe("Portrait circles\nsridhar-maharaj: [48, 36.5, 46]  — Śrīla Śrīdhar Mahārāja");
  });
});
