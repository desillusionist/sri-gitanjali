import { readFile } from "node:fs/promises";

const packageFile = "/home/ubuntu/webdev-static-assets/kirtan-translation-work/ru.json";
const payload = JSON.parse(await readFile(packageFile, "utf8"));
const entries = Object.entries(payload.translations ?? {});
const suspect = entries
  .filter(([, value]) => typeof value === "string" && (/[A-Za-zĀāĪīŪūṚṛṜṝḶḷṄṅÑñṬṭḌḍṆṇŚśṢṣṂṃḤḥ]/.test(value) || /[\u0300-\u036f]/.test(value)))
  .map(([key, value]) => ({ key, value }));
const asciiEntries = suspect.filter(({ value }) => /[A-Za-z]/.test(value));
const foreignLetterEntries = entries
  .filter(([, value]) => typeof value === "string" && [...value].some((character) => /\p{L}/u.test(character) && !/\p{Script=Cyrillic}/u.test(character)))
  .map(([key, value]) => ({ key, value }));
const foreignCharacters = new Map();
for (const { value } of foreignLetterEntries) {
  for (const character of value) {
    if (/\p{L}/u.test(character) && !/\p{Script=Cyrillic}/u.test(character)) {
      foreignCharacters.set(character, (foreignCharacters.get(character) ?? 0) + 1);
    }
  }
}

const latinTokenCounts = new Map();
for (const { value } of suspect) {
  const stripped = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const token of stripped.match(/[A-Za-z]+/g) ?? []) {
    latinTokenCounts.set(token, (latinTokenCounts.get(token) ?? 0) + 1);
  }
}

console.log(JSON.stringify({
  suspectCount: suspect.length,
  asciiEntryCount: asciiEntries.length,
  foreignLetterEntryCount: foreignLetterEntries.length,
  latinTokens: [...latinTokenCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  foreignCharacters: [...foreignCharacters.entries()].sort((left, right) => left[0].localeCompare(right[0])),
  foreignLetterEntries,
  asciiEntries,
  sample: suspect.slice(0, 30),
}, null, 2));
