import type { CSSProperties } from "react";
import { authorInitials, authorPortraitUrl, type Author } from "@/lib/authors";

/** Scales and shifts the picture so the face box fills the circle, centred. */
function roundCropStyle(face: Author["face"]): CSSProperties | undefined {
  if (!face) return undefined;
  const [x, y, diameter] = face;
  return { width: `${(100 * 100) / diameter}%`, left: `${50 - (x / diameter) * 100}%`, top: `${50 - (y / diameter) * 100}%` };
}

/** A round (or tall) portrait, or the author's initials when there is no picture yet. */
export function AuthorPortrait({ author, variant = "round" }: { author: Author; variant?: "round" | "tall" }) {
  const url = authorPortraitUrl(author);
  return (
    <span className={`author-portrait author-portrait-${variant} ${url ? "" : "is-monogram"}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" style={variant === "round" ? roundCropStyle(author.face) : undefined} />
      ) : (
        <span>{authorInitials(author)}</span>
      )}
    </span>
  );
}
