import { describe, expect, it } from "vitest";
import { pictureUrlsIn } from "./images";

describe("pasted pictures", () => {
  it("finds picture addresses in pasted HTML and text", () => {
    expect(pictureUrlsIn('<p>x</p><img alt="" src="https://example.org/a.jpg?w=1&amp;h=2"><IMG SRC=\'data:image/png;base64,AAA\'>')).toEqual([
      "https://example.org/a.jpg?w=1&h=2",
      "data:image/png;base64,AAA",
    ]);
    expect(pictureUrlsIn("", "see https://example.org/b.webp and https://example.org/page")).toEqual(["https://example.org/b.webp"]);
  });
});
