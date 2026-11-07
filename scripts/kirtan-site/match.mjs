// Matches kirtan.site songs/verses to ours and writes secondary-translation packages.
// Usage (from a scratch folder holding kirtan/<book>/ from fetch.mjs):
//   node match.mjs <repo>/local-storage/songs_577f33d4.json <repo>/local-storage
// Songs are matched by verse text (Cyrillic is romanised roughly for Ukrainian); a song page that
// bundles several praṇāms is placed verse by verse. Ukrainian pages marked "translation: auto" are skipped.
import fs from "node:fs";
const [songsPath, outDir] = process.argv.slice(2);
const ours = JSON.parse(fs.readFileSync(songsPath, "utf8"));

const CYR = [["дж","j"],["чх","c"],["ч","c"],["ш","s"],["щ","sc"],["ж","j"],["ґ","g"],["г","h"],["х","h"],["а","a"],["б","b"],["в","v"],["д","d"],["е","e"],["є","e"],["з","z"],["и","i"],["і","i"],["ї","i"],["й","y"],["к","k"],["л","l"],["м","m"],["н","n"],["о","o"],["п","p"],["р","r"],["с","s"],["т","t"],["у","u"],["ӯ","u"],["ф","f"],["ц","c"],["ю","yu"],["я","ya"],["ь",""],["ʼ",""]];
function skel(text) {
  let t = text.normalize("NFC").toLowerCase();
  for (const [c, l] of CYR) t = t.replaceAll(c, l);
  t = t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  return t.replace(/ch/g, "c").replace(/sh/g, "s").replace(/[hy]/g, "").replace(/w/g, "v").replace(/b/g, "v").replace(/aa/g, "a");
}
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const m = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  let hit = 0;
  for (let i = 0; i < b.length - 1; i++) { const g = b.slice(i, i + 2); const n = m.get(g); if (n) { hit++; m.set(g, n - 1); } }
  return (2 * hit) / (a.length + b.length - 2);
}
// Share of the shorter text's bigrams found in the longer (one side may hold two verses of the other).
function contain(a, b) {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length < 40 || l.length > s.length * 2.5) return 0;
  const m = new Map();
  for (let i = 0; i < l.length - 1; i++) { const g = l.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  let hit = 0;
  for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); const n = m.get(g); if (n) { hit++; m.set(g, n - 1); } }
  return hit / (s.length - 1);
}
const sim = (a, b) => Math.max(dice(a, b), contain(a, b) > 0.9 ? 0.8 : 0);
const asText = (v) => Array.isArray(v) ? v.join("\n") : typeof v === "string" && v !== "$undefined" ? v : "";
// House spelling: "Mahārāja" with the final a.
const clean = (t) => t.replace(/Mahārāj(?![a-zāīū])/g, "Mahārāja").replace(/\*\*?([^*\n]+)\*\*?/g, "$1").replace(/\*/g, "").replace(/^\s*(-{3,}|\\+)\s*$/gm, "").replace(/^\\+\s*/gm, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

const ourVerses = ours.map((s) => ({ song: s, verses: s.verses.map((v) => ({ id: v.id, sk: skel(v.lines.map((l) => l.transliteration || "").join(" ")) })) }));

const report = {};
for (const book of ["es", "pt", "ua", "lv"]) {
  const code = book === "ua" ? "uk" : book;
  const translations = {}, rows = [], skipped = [];
  for (const f of fs.readdirSync(`kirtan/${book}`).sort()) {
    const slug = f.replace(/\.json$/, "");
    const k = JSON.parse(fs.readFileSync(`kirtan/${book}/${f}`, "utf8"));
    if (book === "ua" && k.meta.translation === "auto") { skipped.push(`${slug} (auto draft)`); continue; }
    const kv = k.verses.map((v) => ({ sk: skel(asText(v.text)), tr: clean(asText(v.translation)), n: v.number })).filter((v) => v.sk.length > 4);
    if (!kv.some((v) => v.tr)) { skipped.push(`${slug} (no translation)`); continue; }
    // Song score: share of their verses that find a close verse in our song.
    let best = null;
    for (const o of ourVerses) {
      let hits = 0;
      for (const v of kv) if (o.verses.some((ov) => sim(v.sk, ov.sk) > 0.72)) hits++;
      const score = hits / kv.length;
      if (!best || score > best.score) best = { o, score };
    }
    if (!best || best.score < 0.5) {
      // Compilation pages (several praṇāms our book keeps as separate songs): place verse by verse, strictly.
      const placedKeys = [];
      for (const v of kv) {
        if (!v.tr) continue;
        let cand = null;
        for (const o of ourVerses) for (const ov of o.verses) { const d = dice(v.sk, ov.sk); if (d > 0.85 && (!cand || d > cand.d)) cand = { key: `${o.song.id}::${ov.id}`, d }; }
        if (cand && !translations[cand.key]) { translations[cand.key] = v.tr; placedKeys.push(cand.key); }
      }
      if (placedKeys.length) rows.push(`${slug} -> per-verse: ${placedKeys.join(", ")}`);
      else skipped.push(`${slug} (no song match, best ${best?.score.toFixed(2)} ${best?.o.song.id})`);
      continue;
    }
    // Give each of their verses to our closest verse; join when two of theirs make one of ours.
    const assigned = new Map();
    for (const v of kv) {
      if (!v.tr) continue;
      let cand = null;
      for (const ov of best.o.verses) { const d = sim(v.sk, ov.sk); if (d > 0.72 && (!cand || d > cand.d)) cand = { ov, d }; }
      if (cand) { if (!assigned.has(cand.ov.id)) assigned.set(cand.ov.id, []); assigned.get(cand.ov.id).push(v.tr); }
    }
    let placed = 0;
    for (const ov of best.o.verses) {
      const key = `${best.o.song.id}::${ov.id}`;
      if (translations[key] || !assigned.has(ov.id)) continue;
      translations[key] = assigned.get(ov.id).join("\n\n");
      placed++;
    }
    rows.push(`${best.o.song.id} <- ${slug} score ${best.score.toFixed(2)} verses ${placed}/${best.o.verses.length}`);
  }
  // Our own drafts (es, pt) fill the songs and verses kirtan.site lacks; listed in draftKeys until proof-read.
  const draftKeys = [];
  const supplementUrl = new URL(`./${code}-supplement.json`, import.meta.url);
  if (fs.existsSync(supplementUrl)) {
    const supplement = JSON.parse(fs.readFileSync(supplementUrl, "utf8")).translations;
    for (const [key, text] of Object.entries(supplement)) if (!translations[key]) { translations[key] = text; draftKeys.push(key); }
  }
  report[code] = { songs: new Set(Object.keys(translations).map((k) => k.split("::")[0])).size, verses: Object.keys(translations).length, rows, skipped };
  fs.writeFileSync(`${outDir}/secondary-translations-${code}.json`, JSON.stringify({ schemaVersion: 1, language: code, sourceLanguage: "en", status: "published", source: `https://kirtan.site/${book}/`, generatedAt: new Date().toISOString().slice(0, 10), ...(draftKeys.length ? { draftKeys } : {}), translations }, null, 1) + "\n");
}
fs.writeFileSync("kirtan/report.json", JSON.stringify(report, null, 1));
for (const [c, r] of Object.entries(report)) console.log(c, "songs", r.songs, "verses", r.verses, "skipped", r.skipped.length);
