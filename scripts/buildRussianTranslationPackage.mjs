import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_CSV = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/songs_flattened.csv";
const OUTPUT_DIRECTORY = "/home/ubuntu/webdev-static-assets/kirtan-translation-work";
const OUTPUT_FILE = path.join(OUTPUT_DIRECTORY, "ru.json");
const PARTIAL_FILE = path.join(OUTPUT_DIRECTORY, "ru.partial.json");
const MODEL = "claude-haiku-4-5";
const MAX_BATCH_CHARACTERS = 3_600;
const CONCURRENCY = 1;

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (character === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function createSlug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "song";
}

function valueAt(row, index) {
  return row[index]?.trim() ?? "";
}

function extractVerseTranslations(csv) {
  const rows = parseCsvRows(csv).slice(1).filter((row) => row.length >= 10 && valueAt(row, 0));
  const titleOrder = [];
  const rowsByTitle = new Map();
  for (const row of rows) {
    const title = valueAt(row, 0);
    if (!rowsByTitle.has(title)) {
      titleOrder.push(title);
      rowsByTitle.set(title, []);
    }
    rowsByTitle.get(title).push(row);
  }

  return titleOrder.flatMap((title, songIndex) => {
    const songId = `${createSlug(title)}-${String(songIndex + 1).padStart(3, "0")}`;
    const verses = new Map();
    for (const row of rowsByTitle.get(title) ?? []) {
      const verseNumber = Number.parseInt(valueAt(row, 3), 10) || 1;
      if (!verses.has(verseNumber)) verses.set(verseNumber, []);
      verses.get(verseNumber).push(row);
    }
    return Array.from(verses.entries())
      .sort(([left], [right]) => left - right)
      .flatMap(([verseNumber, verseRows]) => {
        const englishText = valueAt(verseRows[0], 7).replace(/\\n/g, "\n");
        return englishText ? [{ verseId: `${songId}::verse-${verseNumber}`, englishText }] : [];
      });
  });
}

function splitIntoBatches(items) {
  const batches = [];
  let batch = [];
  let characterCount = 0;
  for (const item of items) {
    const itemSize = item.verseId.length + item.englishText.length + 32;
    if (batch.length && characterCount + itemSize > MAX_BATCH_CHARACTERS) {
      batches.push(batch);
      batch = [];
      characterCount = 0;
    }
    batch.push(item);
    characterCount += itemSize;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function promptForBatch(batch) {
  return [
    {
      role: "system",
      content: "You are a precise literary translator for a devotional songbook. Translate only each English explanation into Russian. Sanskrit and Bengali devotional names, titles, and technical terms in the source are written in IAST/ISO 15919-style Latin transliteration. Treat their phonemic IAST values as canonical. Write every such Indic term and proper name in Russian Cyrillic by phonetic transliteration from those IAST values; never leave those terms in extended Latin characters and do not semantically translate them. Preserve the distinction of ā, ī, ū, ṛ, ṝ, ḷ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ṃ, and ḥ when deriving the Cyrillic form. Translate ordinary English prose naturally and faithfully. Do not add headings, commentary, alternate spellings, parenthetical source forms, transliteration notes, or markdown.",
    },
    {
      role: "user",
      content: `Translate these verse explanations from English into Russian. Return exactly one minified JSON object with this shape: {"translations":[{"verseId":"the supplied id","translation":"Russian text"}]}. Include every supplied verseId exactly once, in any order, and no text before or after JSON. Input: ${JSON.stringify({ translations: batch })}`,
    },
  ];
}

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "russian_verse_translation_batch",
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
};

async function translateBatch(batch) {
  const endpoint = `${process.env.OPENAI_API_BASE.replace(/\/$/, "")}/chat/completions`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
          model: MODEL,
          messages: promptForBatch(batch),
          max_tokens: 6_000,
        }),
      });
      if (!response.ok) throw new Error(`LLM HTTP ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error(`LLM response did not contain text content: ${JSON.stringify(payload).slice(0, 1_200)}`);
      }
      const parsed = JSON.parse(content);
      const byId = new Map((parsed.translations ?? []).map((item) => [item.verseId, String(item.translation ?? "").trim()]));
      const translated = batch.map((item) => ({ verseId: item.verseId, translation: byId.get(item.verseId) ?? "" }));
      if (translated.some((item) => !item.translation)) throw new Error("LLM response omitted at least one verse translation.");
      return translated;
    } catch (error) {
      lastError = error;
      const summary = error instanceof Error ? error.message : String(error);
      console.warn(`Batch retry ${attempt}/5: ${summary}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown LLM translation failure.");
}

async function readPartialTranslations() {
  try {
    const payload = JSON.parse(await readFile(PARTIAL_FILE, "utf8"));
    return new Map(Object.entries(payload.translations ?? {}).filter(([, value]) => typeof value === "string" && value.trim()));
  } catch {
    return new Map();
  }
}

async function savePartial(translations) {
  const payload = {
    schemaVersion: 1,
    language: "ru",
    sourceLanguage: "en",
    translationPrompt: "secondary-translation-iso15919-v2",
    generatedAt: new Date().toISOString(),
    translations: Object.fromEntries(translations),
  };
  await writeFile(PARTIAL_FILE, `${JSON.stringify(payload)}\n`, "utf8");
}

async function main() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const source = await readFile(SOURCE_CSV, "utf8");
  const allVerses = extractVerseTranslations(source);
  const translations = await readPartialTranslations();
  const remaining = allVerses.filter((item) => !translations.has(item.verseId));
  const batches = splitIntoBatches(remaining);
  console.log(`Preparing ${allVerses.length} Russian verse translations; ${translations.size} already saved; ${batches.length} batches remain.`);

  let nextBatchIndex = 0;
  let completedBatchCount = 0;
  async function worker() {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[batchIndex];
      const sourceCharacters = batch.reduce((total, item) => total + item.englishText.length, 0);
      console.log(`Translating batch ${batchIndex + 1}/${batches.length}: ${batch.length} verses, ${sourceCharacters} source characters.`);
      const generated = await translateBatch(batch);
      for (const item of generated) translations.set(item.verseId, item.translation);
      completedBatchCount += 1;
      await savePartial(translations);
      console.log(`Saved batch ${completedBatchCount}/${batches.length}; ${translations.size}/${allVerses.length} verses ready.`);
      await delay(1_000);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()));
  const missing = allVerses.filter((item) => !translations.has(item.verseId));
  if (missing.length) throw new Error(`Package validation failed: ${missing.length} translations are missing.`);

  const sourceDigest = createHash("sha256").update(JSON.stringify(allVerses)).digest("hex");
  const packagePayload = {
    schemaVersion: 1,
    language: "ru",
    sourceLanguage: "en",
    translationPrompt: "secondary-translation-iso15919-v2",
    sourceDigest,
    generatedAt: new Date().toISOString(),
    translations: Object.fromEntries(allVerses.map((item) => [item.verseId, translations.get(item.verseId)])),
  };
  await writeFile(OUTPUT_FILE, `${JSON.stringify(packagePayload)}\n`, "utf8");
  console.log(`Russian package complete: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
