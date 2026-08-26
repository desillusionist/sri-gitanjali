import { readFile } from "node:fs/promises";

const SOURCE_CSV = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/songs_flattened.csv";
const PACKAGE_FILE = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/ru.json";

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
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
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

function expectedVerses(csv) {
  const rows = parseCsvRows(csv).slice(1).filter((row) => row.length >= 10 && valueAt(row, 0));
  const songOrder = [];
  const rowsByTitle = new Map();
  for (const row of rows) {
    const title = valueAt(row, 0);
    if (!rowsByTitle.has(title)) {
      songOrder.push(title);
      rowsByTitle.set(title, []);
    }
    rowsByTitle.get(title).push(row);
  }

  return songOrder.flatMap((title, songIndex) => {
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
        return englishText ? [{ key: `${songId}::verse-${verseNumber}`, englishText }] : [];
      });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [sourceCsv, packageText] = await Promise.all([readFile(SOURCE_CSV, "utf8"), readFile(PACKAGE_FILE, "utf8")]);
const expected = expectedVerses(sourceCsv);
const payload = JSON.parse(packageText);
const expectedKeys = new Set(expected.map((item) => item.key));
const translations = payload.translations ?? {};
const packageKeys = Object.keys(translations);
const missing = expected.filter((item) => !Object.hasOwn(translations, item.key));
const unexpected = packageKeys.filter((key) => !expectedKeys.has(key));
const empty = packageKeys.filter((key) => typeof translations[key] !== "string" || !translations[key].trim());
const withoutCyrillic = packageKeys.filter((key) => typeof translations[key] === "string" && !/[А-Яа-яЁё]/.test(translations[key]));
const extendedLatin = packageKeys.filter((key) => typeof translations[key] === "string" && /[ĀāĪīŪūṚṛṜṝḶḷṄṅÑñṬṭḌḍṆṇŚśṢṣṂṃḤḥ]/.test(translations[key]));
const combiningDiacritics = packageKeys.filter((key) => typeof translations[key] === "string" && /[\u0300-\u036f]/.test(translations[key]));
const asciiLatin = packageKeys.filter((key) => typeof translations[key] === "string" && /[A-Za-z]/.test(translations[key]));
const nonCyrillicLetters = packageKeys.filter((key) => typeof translations[key] === "string" && [...translations[key]].some((character) => /\p{L}/u.test(character) && !/\p{Script=Cyrillic}/u.test(character)));

assert(payload.schemaVersion === 1, "schemaVersion must be 1.");
assert(payload.language === "ru", "language must be ru.");
assert(payload.sourceLanguage === "en", "sourceLanguage must be en.");
assert(expected.length === 1121, `Expected 1121 source verses, found ${expected.length}.`);
assert(packageKeys.length === expected.length, `Expected ${expected.length} package keys, found ${packageKeys.length}.`);
assert(missing.length === 0, `Missing ${missing.length} expected keys.`);
assert(unexpected.length === 0, `Found ${unexpected.length} unexpected keys.`);
assert(empty.length === 0, `Found ${empty.length} empty translations.`);
assert(withoutCyrillic.length === 0, `Found ${withoutCyrillic.length} translations without Cyrillic characters.`);

const samples = expected
  .filter((item) => /Śrī|Kṛṣṇa|Chaitanya|Caitanya|Mahāprabhu/.test(item.englishText))
  .slice(0, 6)
  .map((item) => ({ key: item.key, english: item.englishText, russian: translations[item.key] }));

console.log(JSON.stringify({
  valid: true,
  verseCount: expected.length,
  translationCount: packageKeys.length,
  extendedLatinTranslationCount: extendedLatin.length,
  combiningDiacriticTranslationCount: combiningDiacritics.length,
  asciiLatinTranslationCount: asciiLatin.length,
  nonCyrillicLetterTranslationCount: nonCyrillicLetters.length,
  samples,
}, null, 2));
