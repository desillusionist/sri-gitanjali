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
const TRANSLATION_PROMPT_VERSION = "secondary-translation-iso15919-v2";

class TranslationPayloadError extends Error {
  constructor() {
    super("The translation service returned an incomplete response.");
    this.name = "TranslationPayloadError";
  }
}

export function sourceHash(text: string) {
  return createHash("sha256").update(`${TRANSLATION_PROMPT_VERSION}\n${text}`).digest("hex");
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

function splitIntoBatches(items: VerseTranslationRequest[], maximumCharacters = 2_800) {
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

async function translateBatchAttempt(language: SecondaryTranslationLanguage, verses: VerseTranslationRequest[]) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxTokens: 8_000,
    messages: [
      {
        role: "system",
        content: "You are a precise literary translator for a devotional songbook. Translate only each English explanation into the requested language. Sanskrit and Bengali devotional names, titles, and technical terms in the source are written in IAST/ISO 15919-style Latin transliteration. Treat their phonemic IAST values as canonical. For Russian, Ukrainian, Simplified Chinese, Thai, Hindi, and Bengali output, write every such Indic term and proper name in the target language's native script by phonetic transliteration from those IAST values; never leave these terms in extended Latin characters, and do not semantically translate them. For Spanish, Italian, and Portuguese output, retain the canonical IAST spelling and its diacritics for those terms because the target script is Latin. Preserve the distinction of ā, ī, ū, ṛ, ṝ, ḷ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ṃ, and ḥ when deriving the target-script form. Do not add headings, commentary, alternate spellings, parenthetical source forms, transliteration notes, or markdown.",
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
  try {
    const parsed = JSON.parse(content) as { translations?: Array<{ verseId: string; translation: string }> };
    return normalizeGeneratedTranslations(verses, parsed.translations ?? []);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error) throw new TranslationPayloadError();
    throw error;
  }
}

async function translateBatch(language: SecondaryTranslationLanguage, verses: VerseTranslationRequest[]) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await translateBatchAttempt(language, verses);
    } catch (error) {
      if (!(error instanceof TranslationPayloadError) || attempt === 1) {
        if (error instanceof TranslationPayloadError) {
          throw new Error("The translation service could not form a complete response. Please try again.");
        }
        throw error;
      }
    }
  }
  throw new Error("The translation service could not form a complete response. Please try again.");
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

/**
 * The progressive reader requests one verse at a time. Keeping this wrapper
 * beside the batch implementation preserves cache and prompt semantics while
 * allowing the client to render each completed result immediately.
 */
export async function translateAndCacheVerse(language: SecondaryTranslationLanguage, verse: VerseTranslationRequest) {
  const [translation] = await translateAndCacheVerses(language, [verse]);
  if (!translation) throw new Error("The translation service returned no verse result.");
  return translation;
}
