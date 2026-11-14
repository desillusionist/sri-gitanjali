import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHORS, authorCircleUrl, circleStem, type Author } from "@/lib/authors";

describe("circle pictures", () => {
  it("are named after the portrait and face box", () => {
    expect(circleStem("author-a.webp", [50, 31, 59.5])).toBe("circles/author-a@50_31_59.5");
    expect(circleStem("author-a-mwg.jpg")).toBe("circles/author-a-mwg@50_55_100");
  });

  it("are shown only while they match the portrait and face box", () => {
    const author = { id: "a", portrait: "author-a.webp", face: [50, 31, 59.5], circle: "circles/author-a@50_31_59.5.jpg" } as Author;
    expect(authorCircleUrl(author, author.face)).toMatch(/circles\/author-a@50_31_59\.5\.jpg$/);
    expect(authorCircleUrl(author, [50, 32, 59.5])).toBeUndefined();
    expect(authorCircleUrl({ ...author, portrait: "author-a2.webp" }, author.face)).toBeUndefined();
  });

  // An out-of-date circle only means the whole portrait is shown instead (scripts/build-circles.mjs
  // cuts it again), so that is no failure; a circle file that is missing is.
  it("named in authors.json are in local-storage", () => {
    const missing = AUTHORS.filter((author) => author.circle && !fs.existsSync(path.resolve("local-storage", author.circle)));
    expect(missing.map((author) => author.id)).toEqual([]);
  });
});
