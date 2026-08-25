import { createHash } from "node:crypto";
import { cacheSecondaryTranslation, getCachedSecondaryTranslations, type TranslationCacheKey } from "./db";
import { invokeLLM } from "./_core/llm";

export const secondaryTranslationLanguageCodes = ["ru", "uk", "es", "it", "zh", "th", "pt", "hi", "bn"] as const;
export type SecondaryTranslationLanguage = (typeof secondaryTranslationLanguageCodes)[number];

const languageNames: Record<SecondaryTranslationLanguage, string> = {
  ru: "Russian",
  uk: "Ukrainian",
  es: "Spanish",
  it: "Italian",
  zh: "Simplified Chinese",
  th: "Thai",
  pt: "Portuguese",
  hi: "Hindi",
  bn: "Bengali",
};

export type VerseTranslationRequest = { verseId: string; englishText: string };
export type VerseTranslationResult = { verseId: string; translation: string };

export function sourceHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function normalizeGeneratedTranslations(
  requested: VerseTranslationRequest[],
  received: Array<{ verseId: string; translation: string }>,
) {
  const requestedIds = new Set(requested.map((item) => item.verseId));
  const normalized = new Map<string, string>();
  for (const item of received) {
    const translation = item.translation?.trim();
    if (requestedIds.has(item.verseId) && translation) normalized.set(item.verseId, translation);
  }
  if (normalized.size !== requested.length) throw new Error("The translation response did not include every requested verse.");
  return requested.map((item) => ({ verseId: item.verseId, translation: normalized.get(item.verseId) ?? "" }));
}

function splitIntoBatches(items: VerseTranslationRequest[], maximumCharacters = 10_000) {
  const batches: VerseTranslationRequest[][] = [];
  let batch: VerseTranslationRequest[] = [];
  let characterCount = 0;
  for (const item of items) {
    const size = item.verseId.length + item.englishText.length + 16;
    if (batch.length && characterCount + size > maximumCharacters) {
      batches.push(batch);
      batch = [];
      characterCount = 0;
    }
    batch.push(item);
    characterCount += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function translateBatch(language: SecondaryTranslationLanguage, verses: VerseTranslationRequest[]) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxTokens: 8_000,
    messages: [
      {
        role: "system",
        content: "You are a precise literary translator for a devotional songbook. Translate only each English explanation into the requested language. Preserve Sanskrit, Bengali, and proper names exactly, including diacritics. Do not add headings, commentary, transliteration, or markdown.",
      },
      {
        role: "user",
        content: `Translate these verse explanations from English into ${languageNames[language]}. ${JSON.stringify({ translations: verses })}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verse_translation_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                properties: { verseId: { type: "string" }, translation: { type: "string" } },
                required: ["verseId", "translation"],
                additionalProperties: false,
              },
            },
          },
          required: ["translations"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("The translation service returned no content.");
  const parsed = JSON.parse(content) as { translations?: Array<{ verseId: string; translation: string }> };
  return normalizeGeneratedTranslations(verses, parsed.translations ?? []);
}

export async function translateAndCacheVerses(language: SecondaryTranslationLanguage, verses: VerseTranslationRequest[]) {
  const cacheKeys: TranslationCacheKey[] = verses.map((verse) => ({ verseKey: verse.verseId, sourceHash: sourceHash(verse.englishText), language }));
  const cached = await getCachedSecondaryTranslations(cacheKeys);
  const byCacheKey = new Map(cached.map((item: { verseKey: string; sourceHash: string; translatedText: string }) => [`${item.verseKey}:${item.sourceHash}`, item.translatedText]));
  const uncached = verses.filter((verse) => !byCacheKey.has(`${verse.verseId}:${sourceHash(verse.englishText)}`));

  for (const batch of splitIntoBatches(uncached)) {
    const generated = await translateBatch(language, batch);
    await Promise.all(generated.map((item) => {
      const source = batch.find((candidate) => candidate.verseId === item.verseId);
      if (!source) return Promise.resolve();
      const hash = sourceHash(source.englishText);
      byCacheKey.set(`${item.verseId}:${hash}`, item.translation);
      return cacheSecondaryTranslation({ verseKey: item.verseId, sourceHash: hash, language, translatedText: item.translation });
    }));
  }

  return verses.map((verse) => ({
    verseId: verse.verseId,
    translation: byCacheKey.get(`${verse.verseId}:${sourceHash(verse.englishText)}`) ?? "",
  }));
}
