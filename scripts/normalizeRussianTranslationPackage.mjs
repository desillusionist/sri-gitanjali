import { readFile, writeFile } from "node:fs/promises";

const packageFile = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/ru.json";
const backupFile = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/ru.pre-normalization.json";

const iastBaseCharacters = new Map(Object.entries({
  Ā: "A", ā: "a", Ī: "I", ī: "i", Ū: "U", ū: "u", Ṛ: "R", ṛ: "r", Ṝ: "R", ṝ: "r",
  Ḷ: "L", ḷ: "l", Ṅ: "N", ṅ: "n", Ñ: "N", ñ: "n", Ṭ: "T", ṭ: "t", Ḍ: "D", ḍ: "d",
  Ṇ: "N", ṇ: "n", Ś: "S", ś: "s", Ṣ: "S", ṣ: "s", Ṃ: "M", ṃ: "m", Ṁ: "M", ṁ: "m", Ḥ: "H", ḥ: "h",
  Ā: "A", Ē: "E", ē: "e", Ā: "A", á: "a", é: "e", í: "i", ó: "o", ú: "u",
}));

const exactReplacements = [
  [/Lordships/g, "Светлости"],
  [/cooling/gi, "охлаждающая"],
  [/preceptы/gi, "предписания"],
  [/parikrама/gi, "парикраме"],
  [/Chaitanya/gi, "Чайтанья"],
  [/Caitanya/gi, "Чайтанья"],
  [/Mahaprabhu/gi, "Махапрабху"],
  [/Krishna/gi, "Кришна"],
  [/Govinda/gi, "Говинда"],
  [/Raghunath/gi, "Рагхунатх"],
  [/Raghunatha/gi, "Рагхунатха"],
  [/Madhava/gi, "Мадхава"],
  [/Baladeva/gi, "Баладева"],
  [/Srila/gi, "Шрила"],
  [/Sri/gi, "Шри"],
  [/b[eé]tel/gi, "бетел"],
];

const foreignScriptReplacements = [
  [/Гоসবম/g, "Госвами"],
  [/ভজন-পজণ/g, "бхаджана-пуджана"],
  [/वयकततव/g, "вьяктитва"],
  [/난다/g, "нанда"],
  [/ഠ/g, "тх"],
  [/ઠ/g, "тх"],
  [/ण/g, "н"],
];

const latinLetterMap = new Map(Object.entries({
  a: "а", b: "б", c: "с", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "дж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з",
}));

function transliterateLatinSegment(segment) {
  const firstIsUppercase = segment[0] === segment[0].toUpperCase();
  let output = segment.toLowerCase()
    .replace(/ch/g, "ч")
    .replace(/sh/g, "ш")
    .replace(/kh/g, "кх")
    .replace(/gh/g, "гх")
    .replace(/jh/g, "джх")
    .replace(/th/g, "тх")
    .replace(/dh/g, "дх")
    .replace(/bh/g, "бх")
    .replace(/ph/g, "пх")
    .replace(/ng/g, "нг");

  output = [...output].map((character) => latinLetterMap.get(character) ?? character).join("");
  return firstIsUppercase && output ? `${output[0].toUpperCase()}${output.slice(1)}` : output;
}

function normalizeTranslation(value) {
  let normalized = value;
  for (const [source, target] of iastBaseCharacters) normalized = normalized.split(source).join(target);
  normalized = normalized
    .replace(/\p{M}/gu, "")
    .replace(/[Ґґ]/g, (character) => (character === "Ґ" ? "Г" : "г"))
    .replace(/[ІЇ]/g, "И")
    .replace(/[ієї]/g, "и")
    .replace(/[Є]/g, "Е")
    .replace(/[є]/g, "е");
  normalized = normalized.replace(/[\p{Script=Devanagari}]+-[\p{Script=Devanagari}]+/gu, "бхаджана-пуджана");
  for (const [pattern, replacement] of foreignScriptReplacements) normalized = normalized.replace(pattern, replacement);
  for (const [pattern, replacement] of exactReplacements) normalized = normalized.replace(pattern, replacement);
  normalized = normalized.replace(/[A-Za-z]+/g, transliterateLatinSegment);
  return normalized
    .replace(/Сри/g, "Шри")
    .replace(/сри/g, "шри")
    .replace(/Ваиснава/g, "Вайшнава")
    .replace(/ваиснава/g, "вайшнава")
    .replace(/Чаитанйа/g, "Чайтанья")
    .replace(/чаитанйа/g, "чайтанья");
}

function hasArtifact(value) {
  return /[A-Za-zĀāĪīŪūṚṛṜṝḶḷṄṅÑñṬṭḌḍṆṇŚśṢṣṂṃḤḥ]|\p{M}/u.test(value);
}

const originalText = await readFile(packageFile, "utf8");
const payload = JSON.parse(originalText);
const translations = payload.translations ?? {};
const before = Object.values(translations).filter((value) => hasArtifact(value)).length;

for (const [key, value] of Object.entries(translations)) {
  if (typeof value !== "string") throw new Error(`Translation ${key} is not a string.`);
  translations[key] = normalizeTranslation(value);
}

const after = Object.values(translations).filter((value) => hasArtifact(value)).length;
if (after) throw new Error(`Normalisation left ${after} translations with non-Cyrillic artifacts.`);

try {
  await readFile(backupFile, "utf8");
} catch {
  await writeFile(backupFile, originalText, "utf8");
}
await writeFile(packageFile, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ normalized: true, translationCount: Object.keys(translations).length, artifactsBefore: before, artifactsAfter: after }, null, 2));
