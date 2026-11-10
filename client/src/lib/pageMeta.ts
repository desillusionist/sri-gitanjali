/**
 * A title and description per page. Browsers' Reader, Summarize, Translate and share sheets,
 * as well as history and bookmarks, read these instead of the app's generic name.
 */
import { useEffect } from "react";

export const SITE_NAME = "Kīrtan Guide";
const DEFAULT_DESCRIPTION = "Kīrtan Guide — a portable song library for practice and leading kīrtan.";

function setMetaDescription(content: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function pageTitle(title?: string | null) {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/** Sets the document title (and description) while the page is shown. */
export function usePageMeta(title?: string | null, description?: string | null) {
  useEffect(() => {
    document.title = pageTitle(title);
    setMetaDescription(description?.trim() || DEFAULT_DESCRIPTION);
  }, [title, description]);
}
