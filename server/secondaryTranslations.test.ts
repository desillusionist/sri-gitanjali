import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeGeneratedTranslations, sourceHash } from "./secondaryTranslations";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  getCachedSecondaryTranslations: vi.fn(),
  cacheSecondaryTranslation: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));
vi.mock("./db", () => ({
  getCachedSecondaryTranslations: mocks.getCachedSecondaryTranslations,
  cacheSecondaryTranslation: mocks.cacheSecondaryTranslation,
}));

describe("secondary translation helpers", () => {
  beforeEach(() => {
    mocks.invokeLLM.mockReset();
    mocks.getCachedSecondaryTranslations.mockReset();
    mocks.cacheSecondaryTranslation.mockReset();
  });

  it("keeps generated translations matched to their requested verses", () => {
    const requested = [
      { verseId: "first-song-001::verse-1", englishText: "First explanation" },
      { verseId: "first-song-001::verse-2", englishText: "Second explanation" },
    ];
    const normalized = normalizeGeneratedTranslations(requested, [
      { verseId: "first-song-001::verse-2", translation: "Deuxième explication" },
      { verseId: "first-song-001::verse-1", translation: "Première explication" },
    ]);

    expect(normalized).toEqual([
      { verseId: "first-song-001::verse-1", translation: "Première explication" },
      { verseId: "first-song-001::verse-2", translation: "Deuxième explication" },
    ]);
  });

  it("uses a stable hash for the same English source text", () => {
    expect(sourceHash("English source")).toBe(sourceHash("English source"));
    expect(sourceHash("English source")).not.toBe(sourceHash("Changed source"));
  });

  it("translates an uncached verse through the public tRPC procedure and caches it", async () => {
    mocks.getCachedSecondaryTranslations.mockResolvedValue([]);
    mocks.cacheSecondaryTranslation.mockResolvedValue(undefined);
    mocks.invokeLLM.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            translations: [{ verseId: "sample-song-001::verse-1", translation: "Сердце помнит святое имя." }],
          }),
        },
      }],
    });
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { ip: "test-translation-procedure", headers: {} },
      res: {},
    } as never);

    const result = await caller.secondaryTranslation.translateSong({
      language: "ru",
      verses: [{ verseId: "sample-song-001::verse-1", englishText: "The heart remembers the holy name." }],
    });

    expect(result.translations).toEqual([{ verseId: "sample-song-001::verse-1", translation: "Сердце помнит святое имя." }]);
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(1);
    const llmRequest = mocks.invokeLLM.mock.calls[0]?.[0];
    expect(llmRequest?.messages[0]?.content).toContain("IAST/ISO 15919");
    expect(llmRequest?.messages[0]?.content).toContain("target language's native script");
    expect(mocks.cacheSecondaryTranslation).toHaveBeenCalledWith(expect.objectContaining({
      verseKey: "sample-song-001::verse-1",
      language: "ru",
      translatedText: "Сердце помнит святое имя.",
    }));
  });
});
