/** Preparing pictures in the browser: resizing, cropping and compressing before they are saved. */
import type { Face } from "@/lib/portraitCrops";

export type PreparedImage = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number };

/** The longest side of a gallery picture, and the size of the main portrait and its sharp copy. */
export const GALLERY_MAX = 1400;
export const PORTRAIT_SIZE = { width: 480, height: 640 };
export const LARGE_PORTRAIT_MAX_WIDTH = 1050;

async function decode(source: Blob | string): Promise<ImageBitmap> {
  const blob = typeof source === "string" ? await fetch(source).then((response) => response.blob()) : source;
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(blob);
  }
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

function draw(image: ImageBitmap, sx: number, sy: number, sw: number, sh: number, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A picture for the slideshow: at most GALLERY_MAX pixels on its longest side. */
export async function prepareGalleryImage(source: Blob): Promise<PreparedImage> {
  const image = await decode(source);
  const scale = Math.min(1, GALLERY_MAX / Math.max(image.width, image.height));
  const prepared = await encode(draw(image, 0, 0, image.width, image.height, image.width * scale, image.height * scale));
  image.close();
  return prepared;
}

/**
 * Cuts the 3:4 main portrait out of a picture, as framed in the editor ([centre x, centre y, width],
 * in % of the picture's width): the 480×640 portrait and a sharper copy for the enlarged view.
 */
export async function preparePortrait(source: Blob | string, [x, y, width]: Face): Promise<{ portrait: PreparedImage; large: PreparedImage }> {
  const image = await decode(source);
  const unit = image.width / 100;
  const sw = width * unit;
  const sh = sw * (4 / 3);
  const sx = Math.max(0, x * unit - sw / 2);
  const sy = Math.max(0, y * unit - sh / 2);
  const portrait = await encode(draw(image, sx, sy, sw, sh, PORTRAIT_SIZE.width, PORTRAIT_SIZE.height));
  const largeWidth = Math.min(sw, LARGE_PORTRAIT_MAX_WIDTH);
  const large = await encode(draw(image, sx, sy, sw, sh, largeWidth, largeWidth * (4 / 3)));
  image.close();
  return { portrait, large };
}

/** Pictures on the clipboard (from a copy in Photos or a browser), when the browser lets us read them. */
export async function readClipboardImages(): Promise<Blob[]> {
  if (!navigator.clipboard?.read) throw new Error("This browser cannot paste pictures here; use “Add photos” instead.");
  const items = await navigator.clipboard.read();
  const blobs: Blob[] = [];
  for (const item of items) {
    const type = item.types.find((candidate) => candidate.startsWith("image/"));
    if (type) blobs.push(await item.getType(type));
  }
  if (!blobs.length) throw new Error("There is no picture on the clipboard.");
  return blobs;
}
