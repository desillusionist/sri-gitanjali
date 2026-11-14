import { describe, expect, it } from "vitest";
import { HOLY_NAMES } from "./holyNames";
import { HOLY_NAME_LOCALES, holyNameNoteKey, loadHolyNameLocale } from "./holyNamesI18n";
import { secondaryTranslationLanguages } from "./secondaryTranslations";

describe("translated name and place notes", () => {
  it("exist for every second-translation language", () => {
    expect([...HOLY_NAME_LOCALES].sort()).toEqual(secondaryTranslationLanguages.map((language) => language.code).sort());
  });

  it.each(secondaryTranslationLanguages.map((language) => language.code))("%s covers every entry and label", async (code) => {
    const locale = await loadHolyNameLocale(code);
    expect(locale).not.toBeNull();
    for (const kind of ["person", "divine", "place", "realm", "other", "book", "term"] as const) expect(locale!.ui.kinds[kind]).toBeTruthy();
    expect(locale!.ui.page && locale!.ui.map).toBeTruthy();
    for (const entry of HOLY_NAMES) {
      expect(locale!.entries[entry.id]?.about, entry.id).toBeTruthy();
      for (const variant of entry.variants ?? []) expect(locale!.entries[holyNameNoteKey(entry.id, variant.key)]?.about, `${entry.id}/${variant.key}`).toBeTruthy();
    }
  });
});
