import { describe, expect, it } from "vitest";
import { findAuthorById } from "./authors";
import { getHolyNameSegments, HOLY_NAMES } from "./holyNames";

const named = (value: string) => getHolyNameSegments(value).filter((segment) => segment.entry).map((segment) => [segment.text, segment.entry!.id]);

describe("holy names", () => {
  it("links to existing author pages and maps only places on Earth", () => {
    for (const entry of HOLY_NAMES) {
      if (entry.authorId) expect(findAuthorById(entry.authorId), entry.id).toBeDefined();
      if (entry.maps) expect(entry.kind, entry.id).toBe("place");
      if (entry.kind === "realm") expect(entry.maps, entry.id).toBeUndefined();
    }
  });

  it("prefers the longest name and keeps the text intact", () => {
    const value = "Śrīla Rūpa Goswāmī served Śrī Chaitanya Mahāprabhu in Vṛndāvan’s forests.";
    expect(getHolyNameSegments(value).map((segment) => segment.text).join("")).toBe(value);
    expect(named(value)).toEqual([["Śrīla Rūpa Goswāmī", "rupa"], ["Śrī Chaitanya Mahāprabhu", "gauranga"], ["Vṛndāvan", "vrndavan"]]);
  });

  it("ignores accents and does not match inside longer words", () => {
    expect(named("Krsna and Krishna-prema; Haribol")).toEqual([["Krsna", "krishna"], ["Krishna", "krishna"]]);
    expect(named("Śrī Chaitanya Sāraswat Maṭh at Koladwīp")).toEqual([["Śrī Chaitanya Sāraswat Maṭh", "scsmath"], ["Koladwīp", "koladwip"]]);
  });

  it("finds Russian names in any case ending", () => {
    expect(named("Слава Шри Кришне и Радхарани во Вриндаване")).toEqual([["Кришне", "krishna"], ["Радхарани", "radha"], ["Вриндаване", "vrndavan"]]);
  });
});
