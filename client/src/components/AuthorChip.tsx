/** The author under a song title: a small portrait and name that opens a short bio card. */

import { AuthorPortrait } from "@/components/AuthorPortrait";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorHref, type Author } from "@/lib/authors";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

type AuthorChipProps = {
  author: Author;
  /** The name as written in the song (may carry search highlights). */
  label: ReactNode;
  libraryHref: string;
};

export function AuthorChip({ author, label, libraryHref }: AuthorChipProps) {
  const { copy } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="author-chip" aria-label={copy.author.aboutAuthor.replace("{author}", author.name)}>
          <AuthorPortrait author={author} />
          <span className="author-chip-name">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="author-card">
        <span className="info-card-eyebrow">{copy.author.eyebrow}</span>
        <div className="author-card-head">
          <AuthorPortrait author={author} />
          <div>
            <p className="author-card-name">{author.name}</p>
            <p className="author-card-dates">{author.dates} · {author.role}</p>
          </div>
        </div>
        <p className="author-card-summary">{author.summary}</p>
        <div className="author-card-actions">
          <Link href={authorHref(author)} className="author-card-more">
            {copy.author.moreAbout} <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link href={libraryHref} className="author-card-library">{copy.author.showInLibrary}</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
