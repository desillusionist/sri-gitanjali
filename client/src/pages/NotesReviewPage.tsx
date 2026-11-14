/**
 * The notes in one language beside the English, for a native speaker to read through and correct.
 * /notes lists the languages; /notes/<code> shows one, grouped by kind.
 */

import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { AppShell } from "@/components/AppShell";
import { useTranslation } from "@/i18n/LanguageContext";
import { HOLY_NAMES, type HolyNameKind } from "@/lib/holyNames";
import { HOLY_NAME_LOCALES, holyNameNoteKey, useHolyNameLocale } from "@/lib/holyNamesI18n";
import { usePageMeta } from "@/lib/pageMeta";
import { secondaryTranslationLanguages } from "@/lib/secondaryTranslations";

const KIND_ORDER: HolyNameKind[] = ["divine", "person", "other", "place", "realm", "book", "term"];

const languageInfo = (code: string) => secondaryTranslationLanguages.find((language) => language.code === code);

function LanguageList() {
  const { copy } = useTranslation();
  const t = copy.notesReview;
  usePageMeta(t.title);
  return (
    <div className="favorites-page notes-review">
      <header className="favorites-header">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.lede}</p>
      </header>
      <ul className="notes-review-languages">
        {HOLY_NAME_LOCALES.map((code) => (
          <li key={code}><Link href={`/notes/${code}`}><span lang={languageInfo(code)?.lang}>{languageInfo(code)?.name ?? code}</span><small>{languageInfo(code)?.label}</small></Link></li>
        ))}
      </ul>
    </div>
  );
}

function LanguageNotes({ code }: { code: string }) {
  const { copy } = useTranslation();
  const t = copy.notesReview;
  const info = languageInfo(code);
  const locale = useHolyNameLocale(code);
  usePageMeta(`${t.title} · ${info?.label ?? code}`);
  const rows = useMemo(() => HOLY_NAMES.flatMap((entry) => [
    { key: holyNameNoteKey(entry.id), kind: entry.kind, name: entry.name, about: entry.about },
    ...(entry.variants ?? []).map((variant) => ({ key: holyNameNoteKey(entry.id, variant.key), kind: entry.kind, name: variant.name, about: variant.about })),
  ]), []);
  const missing = locale ? rows.filter((row) => !locale.entries[row.key]).length : 0;

  return (
    <div className="favorites-page notes-review">
      <header className="favorites-header">
        <span className="eyebrow"><Link href="/notes">{t.eyebrow}</Link></span>
        <h1 lang={info?.lang}>{info?.name ?? code}</h1>
        <p>{t.ledeLanguage.replace("{language}", info?.label ?? code)}</p>
        {locale && <p className="notes-review-count">{t.count.replace("{count}", String(rows.length))}{missing ? ` · ${t.missing.replace("{count}", String(missing))}` : ""}</p>}
      </header>
      {!locale ? <div className="paper-spinner" aria-hidden="true" /> : KIND_ORDER.map((kind) => {
        const ofKind = rows.filter((row) => row.kind === kind);
        if (!ofKind.length) return null;
        return (
          <section key={kind} className="notes-review-kind">
            <h2>{copy.song.holyNameKinds[kind]} <span lang={info?.lang}>· {locale.ui.kinds[kind]}</span></h2>
            <ol>
              {ofKind.map((row) => {
                const local = locale.entries[row.key];
                return (
                  <li key={row.key} id={row.key}>
                    <div lang="en">
                      <strong>{row.name}</strong>
                      <p>{row.about}</p>
                    </div>
                    <div lang={info?.lang} className={local ? "" : "is-missing"}>
                      {local ? (
                        <>
                          <strong>{local.name ?? row.name}</strong>
                          <p>{local.about}</p>
                          {local.aliases?.length ? <small>{t.foundAs} {local.aliases.join(", ")}</small> : null}
                        </>
                      ) : <p lang="en">{t.notTranslated}</p>}
                    </div>
                    <span className="notes-review-key">{row.key}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default function NotesReviewPage() {
  const [, params] = useRoute("/notes/:lang");
  return <AppShell>{params?.lang ? <LanguageNotes code={params.lang} /> : <LanguageList />}</AppShell>;
}
