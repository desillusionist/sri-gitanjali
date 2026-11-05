import type { CSSProperties } from "react";
import { authorInitials, authorPortraitUrl, type Author } from "@/lib/authors";

/** A round (or tall) portrait, or the author's initials when there is no picture yet. */
export function AuthorPortrait({ author, variant = "round" }: { author: Author; variant?: "round" | "tall" }) {
  const url = authorPortraitUrl(author);
  return (
    <span className={`author-portrait author-portrait-${variant} ${url ? "" : "is-monogram"}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" style={variant === "round" && author.focus ? ({ "--focus": author.focus } as CSSProperties) : undefined} />
      ) : (
        <span>{authorInitials(author)}</span>
      )}
    </span>
  );
}
