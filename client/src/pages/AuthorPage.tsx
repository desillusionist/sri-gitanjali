/** An author's page: portrait, bio, place in the line, and their songs in this book. */

import { AppShell } from "@/components/AppShell";
import { AuthorPortrait } from "@/components/AuthorPortrait";
import { PortraitViewer } from "@/components/PortraitViewer";
import { SongListItem } from "@/components/SongListItem";
import { useSongLibrary } from "@/contexts/SongLibraryContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { findAuthorById, type Author } from "@/lib/authors";
import { LibraryBig } from "lucide-react";
import { useMemo } from "react";
import { Link, useRoute } from "wouter";

function AuthorContent({ author }: { author: Author }) {
  const { songs, status } = useSongLibrary();
  const { copy } = useTranslation();
  const names = useMemo(() => new Set(author.names.map((name) => name.normalize("NFC").trim())), [author]);
  const authorSongs = useMemo(() => songs.filter((song) => song.poet && names.has(song.poet.normalize("NFC").trim())), [names, songs]);
  const honourSongs = useMemo(() => (author.songIds ?? []).map((id) => songs.find((song) => song.id === id)).filter((song): song is NonNullable<typeof song> => Boolean(song)), [author, songs]);
  const isPoet = author.names.length > 0;
  const libraryHref = `/?author=${encodeURIComponent(author.names[0])}#search`;
  const countLabel = authorSongs.length === 1 ? copy.author.songCountOne : copy.author.songCount.replace("{count}", String(authorSongs.length));

  return (
    <article className="author-page">
      <header className="author-header">
        {author.portrait ? <PortraitViewer author={author} /> : <AuthorPortrait author={author} variant="tall" />}
        <div className="author-header-copy">
          <Link href="/vaisnavas" className="eyebrow author-eyebrow-link">{isPoet ? copy.author.eyebrow : copy.author.vaisnavaEyebrow} · {copy.author.allVaisnavas}</Link>
          <h1>{author.name}</h1>
          <p className="author-role">{author.role}</p>
          <p className="author-facts">{author.dates} · {author.place}</p>
          <p className="author-summary">{author.summary}</p>
        </div>
      </header>

      <section className="author-bio">
        {author.bio.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)}
        {author.sources.length > 0 && (
          <p className="author-sources">
            {copy.author.sources}:{" "}
            {author.sources.map((url, index) => (
              <span key={url}>{index > 0 && ", "}<a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace(/^www\./, "")}</a></span>
            ))}
          </p>
        )}
      </section>

      {isPoet && <section className="author-songs" aria-labelledby="author-songs-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{countLabel}</span>
            <h2 id="author-songs-heading">{copy.author.songsTitle}</h2>
          </div>
          <Link href={libraryHref} className="text-action">{copy.author.showInLibrary}</Link>
        </div>
        {status === "ready" ? (
          <div className="favorites-song-list">
            {authorSongs.map((song) => <SongListItem song={song} key={song.id} />)}
          </div>
        ) : (
          <div className="paper-spinner" aria-hidden="true" />
        )}
      </section>}

      {honourSongs.length > 0 && (
        <section className="author-songs" aria-labelledby="author-honour-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{honourSongs.length === 1 ? copy.author.songCountOne : copy.author.songCount.replace("{count}", String(honourSongs.length))}</span>
              <h2 id="author-honour-heading">{copy.author.honourTitle}</h2>
            </div>
          </div>
          <div className="favorites-song-list">
            {honourSongs.map((song) => <SongListItem song={song} key={song.id} />)}
          </div>
        </section>
      )}
    </article>
  );
}

export default function AuthorPage() {
  const [, params] = useRoute("/author/:id");
  const { copy } = useTranslation();
  const author = params ? findAuthorById(params.id) : undefined;
  return (
    <AppShell>
      {author ? <AuthorContent author={author} /> : (
        <section className="favorites-empty author-page">
          <LibraryBig size={23} aria-hidden="true" />
          <h2>{copy.author.notFoundTitle}</h2>
          <p>{copy.author.notFoundDetail}</p>
          <Link href="/" className="text-action">{copy.author.backToLibrary}</Link>
        </section>
      )}
    </AppShell>
  );
}
