import { describe, expect, it } from "vitest";
import { getOriginalMatchRanges, normalizeSearchText } from "./song";

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
