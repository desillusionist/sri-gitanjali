// Downloads song JSON from kirtan.site for the given books into kirtan/<book>/<slug>.json
// Usage: node fetch.mjs es pt ua lv  (run in a scratch folder; already-fetched songs are kept)
import fs from "node:fs";
const books = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "user-agent": "sri-gitanjali-songbook-sync" };

function extractSong(html) {
  // Join the React Server Component chunks and unescape them into plain text.
  let payload = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,(".*?")\]\)<\/script>/gs)) {
    try { payload += JSON.parse(m[1]); } catch {}
  }
  const start = payload.indexOf('"song":{"meta"');
  if (start < 0) return null;
  let i = payload.indexOf("{", start), depth = 0, inStr = false;
  for (let j = i; j < payload.length; j++) {
    const c = payload[j];
    if (inStr) { if (c === "\\") j++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(payload.slice(i, j + 1));
  }
  return null;
}

for (const book of books) {
  fs.mkdirSync(`kirtan/${book}`, { recursive: true });
  const index = await (await fetch(`https://kirtan.site/${book}/a-z/`, { headers: UA })).text();
  const slugs = [...new Set([...index.matchAll(new RegExp(`href="/${book}/([a-z0-9-]+)/"`, "g"))].map((m) => m[1]))]
    .filter((s) => !["a-z", "contents", "authors"].includes(s));
  let ok = 0;
  for (const slug of slugs) {
    const file = `kirtan/${book}/${slug}.json`;
    if (fs.existsSync(file)) { ok++; continue; }
    const res = await fetch(`https://kirtan.site/${book}/${slug}/`, { headers: UA });
    const song = res.ok ? extractSong(await res.text()) : null;
    if (song) { fs.writeFileSync(file, JSON.stringify(song)); ok++; } else console.log(`miss ${book}/${slug} ${res.status}`);
    await sleep(150);
  }
  console.log(`${book}: ${ok}/${slugs.length}`);
}
