/** Preparing pictures in the browser: resizing, cropping and compressing before they are saved. */
import type { Face } from "@/lib/portraitCrops";

export type PreparedImage = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number };

/** The longest side of a gallery picture, and the size of the main portrait and its sharp copy. */
export const GALLERY_MAX = 1400;
export const PORTRAIT_SIZE = { width: 480, height: 640 };
export const LARGE_PORTRAIT_MAX_WIDTH = 1050;

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * Reads a picture through an <img>, which every browser decodes reliably and turns upright from
 * its EXIF orientation (Safari's createImageBitmap could hand over an empty picture, saved as black).
 */
async function decode(input: Blob | string): Promise<Decoded> {
  const blob = typeof input === "string" ? await fetch(input).then((response) => {
    if (!response.ok) throw new Error("The picture could not be loaded.");
    return response.blob();
  }) : input;
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("This picture could not be read. Try another file.");
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(url);
    throw new Error("This picture could not be read. Try another file.");
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/** Throws when the browser drew nothing: better an error than a black picture. */
function assertDrawn(picture: Decoded, sx: number, sy: number, sw: number, sh: number) {
  const probe = document.createElement("canvas");
  probe.width = 16;
  probe.height = 16;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare the picture.");
  context.drawImage(picture.source, sx, sy, sw, sh, 0, 0, 16, 16);
  const { data } = context.getImageData(0, 0, 16, 16);
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return;
  throw new Error("This browser could not read the picture’s pixels. Please try again, or use another browser.");
}

/** WebP where the browser can write it (Safari cannot), else JPEG. */
async function encode(canvas: HTMLCanvasElement): Promise<PreparedImage> {
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp", 0.86);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", width: canvas.width, height: canvas.height };
  const jpeg = await toBlob("image/jpeg", 0.88);
  if (!jpeg) throw new Error("This browser could not prepare the picture.");
  return { blob: jpeg, ext: "jpg", width: canvas.width, height: canvas.height };
}

function draw(picture: Decoded, sx: number, sy: number, sw: number, sh: number, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the picture.");
  // White under transparent parts, which JPEG would otherwise turn black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(picture.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A picture for the slideshow: at most GALLERY_MAX pixels on its longest side. */
export async function prepareGalleryImage(source: Blob): Promise<PreparedImage> {
  const image = await decode(source);
  try {
    assertDrawn(image, 0, 0, image.width, image.height);
    const scale = Math.min(1, GALLERY_MAX / Math.max(image.width, image.height));
    return await encode(draw(image, 0, 0, image.width, image.height, image.width * scale, image.height * scale));
  } finally {
    image.release();
  }
}

/**
 * Cuts the 3:4 main portrait out of a picture, as framed in the editor ([centre x, centre y, width],
 * in % of the picture's width): the 480×640 portrait and a sharper copy for the enlarged view.
 */
export async function preparePortrait(source: Blob | string, [x, y, width]: Face): Promise<{ portrait: PreparedImage; large: PreparedImage }> {
  const image = await decode(source);
  try {
    const unit = image.width / 100;
    // The frame, kept inside the picture (rounding can push it a pixel past an edge).
    const sw = Math.min(width * unit, image.width, (image.height * 3) / 4);
    const sh = sw * (4 / 3);
    const sx = Math.min(Math.max(0, x * unit - sw / 2), image.width - sw);
    const sy = Math.min(Math.max(0, y * unit - sh / 2), image.height - sh);
    assertDrawn(image, sx, sy, sw, sh);
    const portrait = await encode(draw(image, sx, sy, sw, sh, PORTRAIT_SIZE.width, PORTRAIT_SIZE.height));
    const largeWidth = Math.min(sw, LARGE_PORTRAIT_MAX_WIDTH);
    const large = await encode(draw(image, sx, sy, sw, sh, largeWidth, largeWidth * (4 / 3)));
    return { portrait, large };
  } finally {
    image.release();
  }
}

/** Picture addresses in pasted HTML or text (a picture copied from a web page often comes this way). */
export function pictureUrlsIn(html: string, text = ""): string[] {
  const urls = Array.from(html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi), (match) => match[1].replace(/&amp;/g, "&"));
  for (const line of text.split(/\s+/)) if (/^(https?:|data:image\/)/.test(line) && /(\.(jpe?g|png|webp|gif|heic|avif)(\?|#|$)|^data:image\/)/i.test(line)) urls.push(line);
  return Array.from(new Set(urls));
}

/** Fetches pictures by address; ones another site does not let us read are skipped. */
export async function fetchPictures(urls: string[]): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      if (response.ok && blob.type.startsWith("image/")) blobs.push(blob);
    } catch {
      // Another site that does not allow reading its pictures.
    }
  }
  return blobs;
}

/**
 * Pictures on the clipboard, when the browser lets the page read it (desktop browsers do; iPhone
 * Safari often hands over no picture here, so the paste box catches an ordinary paste instead).
 * Returns an empty list when there is no picture to be had this way.
 */
export async function readClipboardImages(): Promise<Blob[]> {
  if (!navigator.clipboard?.read) return [];
  const items = await navigator.clipboard.read();
  const blobs: Blob[] = [];
  let html = "";
  let text = "";
  for (const item of items) {
    const imageType = item.types.find((candidate) => candidate.startsWith("image/"));
    if (imageType) { blobs.push(await item.getType(imageType)); continue; }
    if (item.types.includes("text/html")) html += await (await item.getType("text/html")).text();
    if (item.types.includes("text/uri-list")) text += `\n${await (await item.getType("text/uri-list")).text()}`;
    if (item.types.includes("text/plain")) text += `\n${await (await item.getType("text/plain")).text()}`;
  }
  if (blobs.length) return blobs;
  return fetchPictures(pictureUrlsIn(html, text));
}
