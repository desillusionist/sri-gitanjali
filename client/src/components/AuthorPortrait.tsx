import { authorCircleUrl, authorInitials, authorPortraitUrl, type Author } from "@/lib/authors";
import { faceStyle, useAuthorFace } from "@/lib/portraitCrops";
import { useLiveAuthor } from "@/lib/admin/drafts";

/** A round (or tall) portrait, or the author's initials when there is no picture yet. */
export function AuthorPortrait({ author: published, variant = "round" }: { author: Author; variant?: "round" | "tall" }) {
  const author = useLiveAuthor(published);
  const face = useAuthorFace(author);
  // The small circle picture cut ahead of time; the whole portrait, shifted in its circle, while the
  // circle or portrait has changes not cut yet (on this device or unpublished).
  const circle = variant === "round" ? authorCircleUrl(author, face) : undefined;
  const url = circle ?? authorPortraitUrl(author);
  return (
    <span className={`author-portrait author-portrait-${variant} ${url ? "" : "is-monogram"}`} aria-hidden="true">
      {url ? (
        // Round portraits load at once: a picture shifted inside its small circle can look off-screen to
        // Safari's lazy loading, which then left some circles blank until the page was shown again.
        <img src={url} alt="" loading={variant === "round" ? "eager" : "lazy"} decoding="async" style={variant === "round" && !circle && face ? faceStyle(face) : undefined} />
      ) : (
        <span>{authorInitials(author)}</span>
      )}
    </span>
  );
}
