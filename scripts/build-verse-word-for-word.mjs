// Distributes the SYNONYMS of the reference songbook HTML onto the exact words of
// each app verse. The glossary (word-for-word-glossary.json) already holds one
// section per SYNONYMS block, in document order; this script finds which app
// verse each block belongs to and where each synonym sits in that verse.
//
// Usage: node scripts/build-verse-word-for-word.mjs <reference.html> [report.md]
import { readFile, writeFile } from "node:fs/promises";

const [htmlPath, reportPath = "word-for-word-verse-alignment-report.md"] = process.argv.slice(2);
if (!htmlPath) throw new Error("Pass the path to SongBook-wordForWord-Vedabase-updated.html");

const SONGS_FILE = "local-storage/songs_577f33d4.json";
const GLOSSARY_FILE = "client/src/data/word-for-word-glossary.json";
const OUTPUT_FILE = "client/src/data/word-for-word-verses.json";
const OVERRIDES_FILE = "scripts/word-for-word-verse-overrides.json";

// A reference block is assigned to an app verse when this share of its letter
// trigrams occurs in that verse (after spelling folding).
const MIN_BLOCK_CONTAINMENT = 0.55;
// Weaker trigram matches are still tried when the letter alignment is strong.
const MIN_CANDIDATE_CONTAINMENT = 0.4;
// …and the block's letters must then line up with the verse this well.
const MIN_BLOCK_IDENTITY = 0.75;
// Line-by-line fallback for stanzas the two editions share only in part.
const MIN_SHARED_LINE_LETTERS = 20;
const MIN_SHARED_LINE_IDENTITY = 0.85;
// Synonyms whose words stand in a different order in the app's edition.
const MIN_REORDERED_LETTERS = 4;
const MIN_REORDERED_AGREEMENT = 0.8;
// A synonym is placed only when its letters agree with the verse this well.
const MIN_TERM_AGREEMENT = 0.6;

const html = await readFile(htmlPath, "utf8");
const songs = JSON.parse(await readFile(SONGS_FILE, "utf8"));
const glossary = JSON.parse(await readFile(GLOSSARY_FILE, "utf8"));

// ---------------------------------------------------------------- reference

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseReferenceBlocks() {
  const paragraphs = [...html.matchAll(/<p class="(p\d+)">([\s\S]*?)<\/p>/g)].map(([, cls, body]) => ({ cls, text: decodeHtml(body) }));
  const blocks = [];
  let title = null;
  let label = null;
  let lines = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const { cls, text } = paragraphs[index];
    if (cls === "p19") { title = text; label = null; lines = []; continue; }
    // Verse lines are p20; two stanzas use p9 for one line. Translation (p23)
    // ends a block, so commentary paragraphs never reach the next one.
    if (cls === "p20" || cls === "p9") { if (text) lines.push(text.replace(/^\*\s*/, "")); continue; }
    if (cls === "p23") { lines = []; continue; }
    if (cls !== "p21") continue;
    if (text === "TRANSLATION") { lines = []; continue; }
    if (text !== "SYNONYMS") { label = text; lines = []; continue; }
    blocks.push({ sectionId: `syn-${String(blocks.length + 1).padStart(4, "0")}`, title, label, lines });
    lines = [];
  }
  return blocks;
}

// ------------------------------------------------------------ spelling fold
// Both texts are folded to a coarse alphabet that erases the differences of
// Bengali/Sanskrit transliteration traditions (ch/c, b/v/w, y/j, o/a, all
// diacritics, candrabindu, apostrophes, hyphens). The fold is only used to
// align two versions of the same verse, so collisions are harmless.

function foldCharacter(character) {
  const base = character.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (!/^[a-z]$/.test(base)) return "";
  return { w: "v", b: "v", y: "j", o: "a" }[base] ?? base;
}

/** Returns the folded string and, for every folded letter, its offset in `value`. */
function fold(value) {
  let folded = "";
  const offsets = [];
  for (let offset = 0; offset < value.length; offset += 1) {
    const letter = foldCharacter(value[offset]);
    if (!letter) continue;
    // ch → c, chh → ch: drop an aspirate h that follows c.
    if (letter === "h" && folded.endsWith("c") && !folded.endsWith("ch")) continue;
    folded += letter;
    offsets.push(offset);
  }
  return { folded, offsets };
}

function trigrams(value) {
  const grams = new Set();
  for (let index = 0; index + 3 <= value.length; index += 1) grams.add(value.slice(index, index + 3));
  return grams;
}

function containment(needle, haystack) {
  if (!needle.size) return 0;
  let shared = 0;
  needle.forEach((gram) => { if (haystack.has(gram)) shared += 1; });
  return shared / needle.size;
}

// ---------------------------------------------------------------- alignment

/**
 * Semi-global alignment: all of `reference` against any substring of `target`.
 * Returns, for every reference letter, the target letter it aligns with (or -1).
 */
function alignInto(reference, target) {
  const rows = reference.length + 1;
  const columns = target.length + 1;
  const cost = new Uint16Array(rows * columns);
  for (let i = 1; i < rows; i += 1) cost[i * columns] = i;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const diagonal = cost[(i - 1) * columns + j - 1] + (reference[i - 1] === target[j - 1] ? 0 : 1);
      const up = cost[(i - 1) * columns + j] + 1;
      const left = cost[i * columns + j - 1] + 1;
      cost[i * columns + j] = Math.min(diagonal, up, left);
    }
  }
  let j = 0;
  for (let column = 1; column < columns; column += 1) if (cost[(rows - 1) * columns + column] < cost[(rows - 1) * columns + j]) j = column;
  const mapping = new Array(reference.length).fill(-1);
  let i = rows - 1;
  while (i > 0 && j > 0) {
    const here = cost[i * columns + j];
    if (here === cost[(i - 1) * columns + j - 1] + (reference[i - 1] === target[j - 1] ? 0 : 1)) {
      if (reference[i - 1] === target[j - 1]) mapping[i - 1] = j - 1;
      else mapping[i - 1] = -(j - 1) - 2; // substituted: remember position, mark as non-identical
      i -= 1; j -= 1;
    } else if (here === cost[(i - 1) * columns + j] + 1) i -= 1;
    else j -= 1;
  }
  return mapping;
}

/**
 * Best approximate occurrence of `needle` inside `haystack[from..]`, Sellers'
 * algorithm. Among equally good occurrences the one nearest `preferFrom` wins,
 * and one starting well before it (inside the previous word) loses.
 */
function findApproximate(needle, haystack, from, preferFrom = from) {
  const width = haystack.length - from;
  let previous = new Array(width + 1).fill(0);
  let previousStarts = Array.from({ length: width + 1 }, (_, column) => column);
  for (let i = 1; i <= needle.length; i += 1) {
    const current = new Array(width + 1);
    const currentStarts = new Array(width + 1);
    current[0] = i; currentStarts[0] = 0;
    for (let j = 1; j <= width; j += 1) {
      const diagonal = previous[j - 1] + (needle[i - 1] === haystack[from + j - 1] ? 0 : 1);
      const up = previous[j] + 1;
      const left = current[j - 1] + 1;
      if (diagonal <= up && diagonal <= left) { current[j] = diagonal; currentStarts[j] = previousStarts[j - 1]; }
      else if (up <= left) { current[j] = up; currentStarts[j] = previousStarts[j]; }
      else { current[j] = left; currentStarts[j] = currentStarts[j - 1]; }
    }
    previous = current; previousStarts = currentStarts;
  }
  let best = null;
  for (let j = 1; j <= width; j += 1) {
    const start = previousStarts[j];
    // Prefer the nearest occurrence among equally good ones.
    // One letter of overlap is a fused vowel; more means re-reading the previous word.
    const position = from + start;
    const score = previous[j] + (position < preferFrom - 1 ? 0.05 + (preferFrom - position) * 0.0002 : Math.abs(position - preferFrom) * 0.0001);
    if (!best || score < best.score) best = { score, distance: previous[j], start: position, end: from + j };
  }
  return best;
}

// Synonym terms are given in dictionary form; verses use sandhi forms
// (namaḥ → nama/namo/namas, kṛṣṇam → kṛṣṇaṁ, …). Final visarga/m may vanish.
// The shortened variant counts the dropped letter as one difference, so that
// “aham” prefers ’haṁ over the “aha” inside saha-gaṇa.
function termVariants(term) {
  // Editorial prefixes such as “(chorus)” or “[Mother Yaśodā calls to Kṛṣṇa:]” are not verse words.
  const { folded } = fold(term.replace(/\([^)]*\)|\[[^\]]*\]/g, " "));
  const variants = [{ letters: folded, penalty: 0 }];
  if (/[hm]$/.test(folded) && folded.length > 2) variants.push({ letters: folded.slice(0, -1), penalty: 1 });
  return variants.filter((variant) => variant.letters);
}

// ------------------------------------------------------------------ helpers

const isLetter = (character) => Boolean(character) && /[\p{L}\p{M}]/u.test(character);
const isPieceBreak = (character) => !character || /[\s\-‐-―\n]/.test(character);

/** Widens a span to its piece (word or hyphen part) when it misses only a letter or two at an edge. */
function snapSpan(text, start, end) {
  let pieceStart = start;
  while (pieceStart > 0 && !isPieceBreak(text[pieceStart - 1])) pieceStart -= 1;
  let pieceEnd = end;
  while (pieceEnd < text.length && !isPieceBreak(text[pieceEnd])) pieceEnd += 1;
  const lettersBetween = (from, to) => [...text.slice(from, to)].filter((character) => /\p{L}/u.test(character)).length;
  if (lettersBetween(pieceStart, start) <= 2) start = pieceStart;
  if (lettersBetween(end, pieceEnd) <= 2) end = pieceEnd;
  // Never start on punctuation or end on trailing punctuation other than an elision mark.
  while (start < end && !isLetter(text[start])) start += 1;
  while (end > start && !isLetter(text[end - 1]) && !/['’‘]/.test(text[end - 1])) end -= 1;
  if (/['’‘]/.test(text[end - 1]) && !isLetter(text[end - 2])) end -= 1;
  return [start, end];
}

function verseContext(verse) {
  return verse.lines.map((line) => line.transliteration).join("\n");
}

// ------------------------------------------------------------- distribution

const blocks = parseReferenceBlocks();
const entriesBySection = new Map();
const entryById = new Map(glossary.entries.map((entry) => [entry.id, entry]));
for (const entry of glossary.entries) {
  if (!entriesBySection.has(entry.sectionId)) entriesBySection.set(entry.sectionId, []);
  entriesBySection.get(entry.sectionId).push(entry);
}

const appVerses = songs.flatMap((song) => song.verses.map((verse) => {
  const context = verseContext(verse);
  const { folded, offsets } = fold(context);
  return { song, verse, context, folded, offsets, grams: trigrams(folded) };
}));

for (const block of blocks) {
  block.folded = block.lines.map((line) => fold(line).folded).join("");
  block.grams = trigrams(block.folded);
  const ranked = appVerses
    .map((candidate) => ({ candidate, score: containment(block.grams, candidate.grams) }))
    .sort((left, right) => right.score - left.score);
  block.candidates = ranked.slice(0, 4);
}

// A song is usually matched by several of a section's blocks; prefer that song
// when a short, formulaic block (e.g. “nama oṁ viṣṇu-pādāya…”) ties elsewhere.
const blockVotes = new Map();
for (const block of blocks) {
  const top = block.candidates[0];
  if (top && top.score >= MIN_BLOCK_CONTAINMENT) {
    const key = `${block.title}::${top.candidate.song.id}`;
    blockVotes.set(key, (blockVotes.get(key) ?? 0) + 1);
  }
}
/** Share of the block's letters that align identically inside the candidate verse. */
function alignmentIdentity(block, candidate) {
  const mapping = alignInto(block.folded, candidate.folded);
  return { mapping, identity: mapping.filter((target) => target >= 0).length / Math.max(1, block.folded.length) };
}

for (const block of blocks) {
  const votes = (item) => blockVotes.get(`${block.title}::${item.candidate.song.id}`) ?? 0;
  const ordered = block.candidates
    .filter((item) => item.score >= MIN_CANDIDATE_CONTAINMENT)
    .sort((left, right) => (Math.abs(left.score - right.score) < 0.02 ? votes(right) - votes(left) : right.score - left.score));
  block.match = null;
  for (const item of ordered) {
    const { mapping, identity } = alignmentIdentity(block, item.candidate);
    if (identity >= MIN_BLOCK_IDENTITY && (item.score >= MIN_BLOCK_CONTAINMENT || identity >= 0.85)) {
      block.match = { ...item, mapping, identity };
      break;
    }
  }
  if (!block.match) block.match = matchSharedLines(block);
}

/**
 * Editions sometimes share only some lines of a stanza (the app's
 * Guru-paramparā extends the lineage; several praṇāmas keep only the opening
 * line). Align line by line and keep the lines found nearly verbatim in one
 * app verse; synonyms of the other lines stay unplaced.
 */
function matchSharedLines(block) {
  const lineRanges = [];
  let offset = 0;
  for (const line of block.lines) {
    const { folded } = fold(line);
    lineRanges.push({ folded, start: offset });
    offset += folded.length;
  }
  const byVerse = new Map();
  for (const { folded, start } of lineRanges) {
    if (folded.length < MIN_SHARED_LINE_LETTERS) continue;
    const grams = trigrams(folded);
    const ranked = appVerses
      .map((candidate) => ({ candidate, score: containment(grams, candidate.grams) }))
      .filter((item) => item.score >= 0.6)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
    for (const { candidate } of ranked) {
      const lineMapping = alignInto(folded, candidate.folded);
      const identity = lineMapping.filter((target) => target >= 0).length / folded.length;
      if (identity < MIN_SHARED_LINE_IDENTITY) continue;
      const key = `${candidate.song.id}::${candidate.verse.id}`;
      const entry = byVerse.get(key) ?? { candidate, lines: [] };
      entry.lines.push({ start, lineMapping, length: folded.length });
      byVerse.set(key, entry);
      break;
    }
  }
  const best = [...byVerse.values()].sort((left, right) => right.lines.length - left.lines.length)[0];
  if (!best) return null;
  const mapping = new Array(block.folded.length).fill(-1);
  let shared = 0;
  for (const { start, lineMapping, length } of best.lines) {
    lineMapping.forEach((target, index) => { mapping[start + index] = target; });
    shared += length;
  }
  return { candidate: best.candidate, score: shared / block.folded.length, mapping, identity: shared / block.folded.length, sharedLines: best.lines.length };
}

const report = { matchedBlocks: [], unmatchedBlocks: [], weakTerms: [], reordered: [], sharedVerses: [] };

// Every app letter is owned by at most one synonym. Ownership is collected for
// all blocks of a verse, then completed word by word, so a link always covers
// whole words except where sandhi fuses two synonyms into one word.
const verseStates = new Map();
function verseState(candidate) {
  const key = `${candidate.song.id}::${candidate.verse.id}`;
  if (!verseStates.has(key)) {
    verseStates.set(key, {
      candidate,
      owner: new Array(candidate.folded.length).fill(null),
      identical: new Array(candidate.folded.length).fill(false),
      sharedWith: new Map(),
      sections: [],
    });
  }
  return verseStates.get(key);
}

for (const block of blocks) {
  const entries = (entriesBySection.get(block.sectionId) ?? []).filter((entry) => entry.sourceTerm && entry.meaning);
  if (!block.match) {
    report.unmatchedBlocks.push({ block, best: block.candidates[0] });
    continue;
  }
  const { candidate, score, mapping, identity } = block.match;
  const state = verseState(candidate);
  state.sections.push(block.sectionId);
  let cursor = 0;
  let placed = 0;
  const retry = [];
  for (const entry of entries) {
    // Where does the synonym sit inside the reference verse?
    let best = null;
    for (const { letters: variant, penalty } of termVariants(entry.sourceTerm)) {
      const fullLength = variant.length + penalty;
      // Synonyms follow the verse order: look ahead first, and search the
      // whole verse only when nothing good lies ahead (e.g. reordered words).
      const forward = findApproximate(variant, block.folded, Math.max(0, cursor - 3), cursor);
      const goodAhead = forward && 1 - (forward.distance + penalty) / fullLength >= MIN_TERM_AGREEMENT;
      const pick = goodAhead ? forward : findApproximate(variant, block.folded, 0);
      if (!pick) continue;
      const agreement = 1 - (pick.distance + penalty) / fullLength;
      if (!best || agreement > best.agreement || (agreement === best.agreement && pick.start < best.start)) best = { ...pick, agreement, variant };
    }
    if (!best || best.agreement < MIN_TERM_AGREEMENT || (best.variant.length <= 3 && best.distance > 0)) {
      retry.push({ entry, reason: "not found in the reference verse" });
      continue;
    }
    // Carry it over to the app verse.
    const targets = [];
    for (let index = best.start; index < best.end; index += 1) {
      const target = mapping[index];
      if (target >= 0) targets.push({ letter: target, identical: true });
      else if (target <= -2) targets.push({ letter: -target - 2, identical: false });
    }
    const identicalCount = targets.filter((target) => target.identical).length;
    const agreement = identicalCount / Math.max(1, best.end - best.start);
    if (!identicalCount || agreement < MIN_TERM_AGREEMENT) {
      retry.push({ entry, reason: `the app verse reads differently here (${Math.round(agreement * 100)}% of letters agree)` });
      continue;
    }
    const previousOwners = new Set(targets.map(({ letter }) => state.owner[letter]).filter(Boolean));
    const free = targets.filter(({ letter }) => !state.owner[letter]);
    if (!free.length && previousOwners.size === 1) {
      // Same words as an earlier synonym (a compound glossed twice, or the same
      // stanza repeated elsewhere in the reference): share its link once.
      const [owner] = previousOwners;
      const shared = [owner, ...(state.sharedWith.get(owner) ?? [])].map((id) => entryById.get(id));
      const meaning = entry.meaning.trim().toLowerCase();
      if (!shared.some((other) => other.meaning.trim().toLowerCase().includes(meaning) || meaning.includes(other.meaning.trim().toLowerCase()))) {
        state.sharedWith.set(owner, [...(state.sharedWith.get(owner) ?? []), entry.id]);
      }
    }
    for (const { letter, identical } of free) {
      state.owner[letter] = entry.id;
      state.identical[letter] = identical;
    }
    cursor = best.end;
    placed += 1;
  }
  // Second chance for words the two editions put in a different order
  // (“narottama dāsa kohe” / “kohe narottama dāsa”): look for the synonym
  // directly in the still-unlinked letters of the app verse. Blocks that share
  // only some lines with the verse are left out: their other words belong to
  // a different stanza.
  for (const { entry, reason } of retry) {
    if (block.match.sharedLines) { report.weakTerms.push({ block, entry, reason }); continue; }
    let best = null;
    for (const { letters: variant, penalty } of termVariants(entry.sourceTerm)) {
      if (variant.length < MIN_REORDERED_LETTERS) continue;
      const pick = findApproximate(variant, candidate.folded, 0);
      const agreement = pick ? 1 - (pick.distance + penalty) / (variant.length + penalty) : 0;
      if (pick && agreement >= MIN_REORDERED_AGREEMENT && (!best || agreement > best.agreement)) best = { ...pick, agreement };
    }
    const letters = best ? Array.from({ length: best.end - best.start }, (_, index) => best.start + index) : [];
    if (!letters.length || letters.some((letter) => state.owner[letter])) {
      report.weakTerms.push({ block, entry, reason });
      continue;
    }
    for (const letter of letters) { state.owner[letter] = entry.id; state.identical[letter] = true; }
    report.reordered.push({ block, entry, candidate });
    placed += 1;
  }
  report.matchedBlocks.push({ block, candidate, score, identity, placed, total: entries.length, sharedLines: block.match.sharedLines });
}

const overrides = JSON.parse(await readFile(OVERRIDES_FILE, "utf8"));

for (const state of verseStates.values()) {
  const { candidate, owner, identical } = state;
  const { context, offsets } = candidate;
  // Pieces: words and hyphen-separated parts, as folded letter ranges.
  const pieces = [];
  let current = [];
  for (let letter = 0; letter < offsets.length; letter += 1) {
    const between = letter ? context.slice(offsets[letter - 1] + 1, offsets[letter]) : "";
    if (letter && /[\s\-‐-―]/.test(between)) { pieces.push(current); current = []; }
    current.push(letter);
  }
  if (current.length) pieces.push(current);
  for (const piece of pieces) {
    // A synonym whose letters in this word are all different readings does not
    // describe this word (e.g. ref “tumi” against app “sadā”).
    const owners = new Set(piece.map((letter) => owner[letter]).filter(Boolean));
    for (const candidateOwner of owners) {
      if (!piece.some((letter) => owner[letter] === candidateOwner && identical[letter])) {
        piece.forEach((letter) => { if (owner[letter] === candidateOwner) owner[letter] = null; });
      }
    }
    // A synonym spilling one or two letters into the next word (visarga
    // sandhi: nṛsiṁho hṛdaye) leaves them to the synonym of that word.
    const ownersHere = new Set(piece.map((letter) => owner[letter]).filter(Boolean));
    if (ownersHere.size > 1) {
      for (const candidateOwner of ownersHere) {
        const here = piece.filter((letter) => owner[letter] === candidateOwner);
        const elsewhere = owner.some((value, letter) => value === candidateOwner && !piece.includes(letter));
        if (here.length <= 2 && elsewhere) here.forEach((letter) => { owner[letter] = null; });
      }
    }
    // Unowned letters of a word belong to the neighbouring synonym in that word.
    let last = null;
    for (const letter of piece) { if (owner[letter]) last = owner[letter]; else if (last) owner[letter] = last; }
    last = null;
    for (const letter of [...piece].reverse()) { if (owner[letter]) last = owner[letter]; else if (last) owner[letter] = last; }
  }
  const mappedOffsets = new Set(offsets);
  const spans = [];
  for (let letter = 0; letter < offsets.length; letter += 1) {
    if (!owner[letter]) continue;
    let last = letter;
    while (last + 1 < offsets.length && owner[last + 1] === owner[letter]) last += 1;
    const start = offsets[letter];
    let end = offsets[last] + 1;
    // Include marks and folded-away letters (candrabindu, the h of ch) and a final elision mark.
    while (end < context.length && !mappedOffsets.has(end) && /[\p{L}\p{M}]/u.test(context[end])) end += 1;
    if (/['’]/.test(context[end] ?? "") && !/[\p{L}]/u.test(context[end + 1] ?? "")) end += 1;
    spans.push({ start, end, entryIds: [owner[letter], ...(state.sharedWith.get(owner[letter]) ?? [])] });
    letter = last;
  }
  state.spans = spans;
  if (state.sections.length > 1) report.sharedVerses.push({ songId: candidate.song.id, verseId: candidate.verse.id, sections: state.sections });
}

// Manual, reviewed links for readings the two editions word differently. An
// override names the app words (`surface`, located inside `within` when the
// words recur) and either glossary entries or an editorial `meaning`.
const editorialEntries = {};
const appliedOverrides = [];
for (const override of overrides.entries) {
  const candidate = appVerses.find((item) => item.song.id === override.songId && item.verse.id === override.verseId);
  if (!candidate) throw new Error(`Override verse not found: ${override.songId} ${override.verseId}`);
  const within = override.within ?? override.surface;
  const withinStart = candidate.context.indexOf(within);
  if (withinStart < 0 || candidate.context.indexOf(within, withinStart + 1) >= 0) throw new Error(`Override context must occur once: ${within}`);
  const start = withinStart + within.indexOf(override.surface);
  if (start < withinStart) throw new Error(`Override surface not inside its context: ${override.surface}`);
  const end = start + override.surface.length;
  const entryIds = [...(override.entryIds ?? [])];
  if (override.meaning) {
    const id = `edit-${String(Object.keys(editorialEntries).length + 1).padStart(3, "0")}`;
    editorialEntries[id] = { id, sectionId: "editorial", entryOrder: 0, collection: "Editorial", songOrPrayer: candidate.song.title, verseLabel: null, sourceTerm: override.term ?? override.surface, meaning: override.meaning, parseStatus: "editorial", rawSegment: override.note };
    entryIds.push(id);
  }
  const state = verseState(candidate);
  state.spans = (state.spans ?? []).filter((span) => span.end <= start || span.start >= end);
  if (entryIds.length) state.spans.push({ start, end, entryIds });
  state.spans.sort((left, right) => left.start - right.start);
  appliedOverrides.push({ ...override, entryIds });
}

// Refrains (gopīnāth, jaya jagadīśa hare, …) are glossed once in the reference
// but repeat in the app. A linked phrase is reused for its other occurrences in
// the same song only when it recurs in at least half of the song's verses and
// always carries the same meaning, so verse-specific glosses never spread.
const propagated = [];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const song of songs) {
  const states = song.verses.map((verse) => verseStates.get(`${song.id}::${verse.id}`)).filter((state) => state?.spans?.length);
  if (!states.length) continue;
  const phrases = new Map();
  for (const state of states) {
    for (const span of state.spans) {
      const phrase = state.candidate.context.slice(span.start, span.end).replace(/^[^\p{L}]+|[^\p{L}\p{M}'’]+$/gu, "");
      if (!phrase || phrase.includes("\n")) continue;
      const meanings = span.entryIds.map((id) => (entryById.get(id) ?? editorialEntries[id]).meaning).join(" | ");
      const known = phrases.get(phrase.toLowerCase());
      if (known && known.meanings !== meanings) known.inconsistent = true;
      else if (!known) phrases.set(phrase.toLowerCase(), { phrase, entryIds: span.entryIds, meanings });
    }
  }
  const verses = song.verses.map((verse) => appVerses.find((item) => item.song.id === song.id && item.verse.id === verse.id));
  for (const { phrase, entryIds, inconsistent } of [...phrases.values()].sort((left, right) => right.phrase.length - left.phrase.length)) {
    if (inconsistent) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(phrase)}(?![\\p{L}\\p{M}])`, "giu");
    const versesWithPhrase = verses.filter((candidate) => pattern.test(candidate.context) && !(pattern.lastIndex = 0));
    if (versesWithPhrase.length < Math.max(1, Math.ceil(song.verses.length / 2))) continue;
    for (const candidate of versesWithPhrase) {
      const state = verseState(candidate);
      state.spans ??= [];
      for (const match of candidate.context.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        if (state.spans.some((span) => span.start < end && start < span.end)) continue;
        state.spans.push({ start, end, entryIds });
        propagated.push({ songId: song.id, verseId: candidate.verse.id, surface: match[0] });
      }
      state.spans.sort((left, right) => left.start - right.start);
    }
  }
}

const glossaryIds = new Set([...glossary.entries.map((entry) => entry.id), ...Object.keys(editorialEntries)]);
const output = {};
for (const { candidate, spans = [] } of verseStates.values()) {
  if (!spans.length) continue;
  for (const span of spans) for (const id of span.entryIds) if (!glossaryIds.has(id)) throw new Error(`Unknown glossary entry ${id}`);
  (output[candidate.song.id] ??= {})[candidate.verse.id] = spans.map((span) => ({ ...span, surface: candidate.context.slice(span.start, span.end) }));
}

await writeFile(OUTPUT_FILE, `${JSON.stringify({
  schemaVersion: 1,
  description: "Verse-specific word-for-word spans: character ranges in each app verse (lines joined by \\n) linked to glossary entries from the SYNONYMS block that belongs to that verse. Generated by scripts/build-verse-word-for-word.mjs.",
  editorialEntries,
  songs: output,
})}\n`);

// ------------------------------------------------------------------- report

const songById = new Map(songs.map((song) => [song.id, song]));
const lines = [];
const totalEntries = report.matchedBlocks.reduce((sum, item) => sum + item.total, 0);
const placedEntries = report.matchedBlocks.reduce((sum, item) => sum + item.placed, 0);
lines.push("# Word-for-word verse alignment report", "");
lines.push(`Reference SYNONYMS blocks: ${blocks.length}; matched to app verses: ${report.matchedBlocks.length}; unmatched: ${report.unmatchedBlocks.length}.`);
lines.push(`Synonyms placed on exact verse words: ${placedEntries} of ${totalEntries} in matched blocks.`, "");
lines.push(
  "Spelling differences treated as the same when aligning a reference verse with the app verse: all diacritics and candrabindu (tāhā = tā̐hā),",
  "ch = c (parichaya = paricaya), b = v = w (bara = vara, viśwa = viśva), y = j (yādava = jādava), o = a (hoy/hon, koro/kara), apostrophes and",
  "hyphens (boli' = boli, jā'ra = jā̐ra), a dropped final vowel (sāth = sātha), and sandhi endings of synonym terms (namaḥ = namo/namas).",
  "Words the editions genuinely word differently are not linked automatically; they are listed below, and reviewed ones are linked under “Manual links”.",
  "",
);
lines.push("## Matched blocks", "", "| Block | Reference | App song | Verse | Trigrams | Letters | Placed |", "|---|---|---|---|---|---|---|");
for (const { block, candidate, score, identity, placed, total, sharedLines } of report.matchedBlocks) {
  lines.push(`| ${block.sectionId} | ${block.title}${block.label ? ` (${block.label})` : ""} | ${candidate.song.title} | ${candidate.verse.originalVerseNumber} | ${sharedLines ? `${sharedLines} of ${block.lines.length} lines` : `${Math.round(score * 100)}%`} | ${Math.round(identity * 100)}% | ${placed}/${total} |`);
}
lines.push("", "## Unmatched blocks", "", "| Block | Reference | First line | Best app candidate |", "|---|---|---|---|");
for (const { block, best } of report.unmatchedBlocks) {
  lines.push(`| ${block.sectionId} | ${block.title}${block.label ? ` (${block.label})` : ""} | ${block.lines[0] ?? ""} | ${best ? `${best.candidate.song.title} v${best.candidate.verse.originalVerseNumber} (${Math.round(best.score * 100)}%)` : "—"} |`);
}
lines.push("", "## Synonyms not placed", "", "| Block | Term | Meaning | Reason |", "|---|---|---|---|");
for (const { block, entry, reason } of report.weakTerms) lines.push(`| ${block.sectionId} | ${entry.sourceTerm} | ${entry.meaning} | ${reason} |`);
lines.push("", "## Placed by direct search (word order differs between editions)", "", "| Block | Term | App song | Verse |", "|---|---|---|---|");
for (const { block, entry, candidate } of report.reordered) lines.push(`| ${block.sectionId} | ${entry.sourceTerm} | ${candidate.song.title} | ${candidate.verse.originalVerseNumber} |`);
lines.push("", "## Manual links (editorial)", "", "| Song | Verse | App words | Linked to | Note |", "|---|---|---|---|---|");
for (const override of appliedOverrides) lines.push(`| ${songById.get(override.songId)?.title} | ${override.verseId.replace("verse-", "")} | ${override.surface} | ${[...override.entryIds.filter((id) => !id.startsWith("edit-")), ...(override.meaning ? [`“${override.meaning}” (editorial)`] : [])].join(", ") || "(no link)"} | ${override.note} |`);
lines.push("", "## Refrains carried to their repeats", "");
const propagatedBySong = new Map();
for (const item of propagated) propagatedBySong.set(item.songId, [...(propagatedBySong.get(item.songId) ?? []), item.surface]);
for (const [songId, surfaces] of propagatedBySong) lines.push(`- ${songById.get(songId)?.title}: ${[...new Set(surfaces)].join(", ")} (${surfaces.length} occurrences)`);
lines.push("", "## App verses fed by more than one block", "");
for (const { songId, verseId, sections } of report.sharedVerses) lines.push(`- ${songById.get(songId)?.title} ${verseId}: ${sections.join(", ")}`);
const coveredSongs = new Set(Object.keys(output));
lines.push("", "## App songs without reference synonyms", "");
for (const song of songs) if (!coveredSongs.has(song.id)) lines.push(`- ${song.title}`);
await writeFile(reportPath, `${lines.join("\n")}\n`);

console.log(`blocks ${blocks.length}, matched ${report.matchedBlocks.length}, unmatched ${report.unmatchedBlocks.length}, placed ${placedEntries}/${totalEntries}, songs covered ${coveredSongs.size}/${songs.length}`);
