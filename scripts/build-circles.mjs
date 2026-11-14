#!/usr/bin/env node
/**
 * Cuts the small round-portrait pictures (local-storage/circles/…) out of each author's portrait,
 * as framed by its face box, and writes their names into authors.json. Only missing or out-of-date
 * circles are made; circle files nothing uses any more are deleted.
 *
 * The admin tools make these themselves when publishing; run this after editing portraits or face
 * boxes by hand:  node scripts/build-circles.mjs   (needs ffmpeg and ffprobe)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const AUTHORS = path.join(ROOT, "client/src/data/authors.json");
const STORAGE = path.join(ROOT, "local-storage");
// Kept in step with client/src/lib/authors.ts.
const DEFAULT_FACE = [50, 55, 100];
const SIZE = 240;

const round1 = (value) => Math.round(value * 10) / 10;
const circleStem = (portrait, face) => `circles/${portrait.replace(/\.\w+$/, "")}@${face.map((value) => String(round1(value))).join("_")}`;

const file = JSON.parse(fs.readFileSync(AUTHORS, "utf8"));
fs.mkdirSync(path.join(STORAGE, "circles"), { recursive: true });
let made = 0;

for (const author of file.authors) {
  if (!author.portrait) {
    delete author.circle;
    continue;
  }
  const face = author.face ?? DEFAULT_FACE;
  const name = `${circleStem(author.portrait, face)}.webp`;
  if (author.circle === name && fs.existsSync(path.join(STORAGE, name))) continue;
  const source = path.join(STORAGE, author.portraitLarge ?? author.portrait);
  const [width, height] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", source], { encoding: "utf8" }).trim().split(",").map(Number);
  const unit = width / 100;
  const side = Math.min(face[2] * unit, width, height);
  const x = Math.min(Math.max(0, face[0] * unit - side / 2), width - side);
  const y = Math.min(Math.max(0, face[1] * unit - side / 2), height - side);
  const s = Math.floor(side);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source, "-vf", `crop=${s}:${s}:${Math.floor(x)}:${Math.floor(y)},scale=${SIZE}:${SIZE}:flags=lanczos`, "-c:v", "libwebp", "-quality", "82", "-frames:v", "1", path.join(STORAGE, name)]);
  author.circle = name;
  made += 1;
}

const used = new Set(file.authors.map((author) => author.circle).filter(Boolean));
let removed = 0;
for (const entry of fs.readdirSync(path.join(STORAGE, "circles"))) {
  if (!used.has(`circles/${entry}`)) {
    fs.rmSync(path.join(STORAGE, "circles", entry));
    removed += 1;
  }
}

// The circle sits just after the face box (or the portrait).
file.authors = file.authors.map((author) => {
  if (!author.circle) return author;
  const { circle, ...rest } = author;
  const after = "face" in rest ? "face" : "portraitLarge" in rest ? "portraitLarge" : "portrait";
  return Object.fromEntries(Object.entries(rest).flatMap((entry) => (entry[0] === after ? [entry, ["circle", circle]] : [entry])));
});
fs.writeFileSync(AUTHORS, `${JSON.stringify(file, null, 2)}\n`);
console.log(`Circles: ${made} made, ${removed} removed, ${used.size} in use.`);
