/** The list of changes waiting to be published, each with its own Undo. */

import { CloudUpload, Undo2, X } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { findAuthorById } from "@/lib/authors";
import { HOLY_NAMES } from "@/lib/holyNames";
import { describeAuthorChange, publishedPictures, undoAuthor, undoLocalNote, undoNote, useDrafts } from "@/lib/admin/drafts";
import { useFaceOverrides } from "@/lib/portraitCrops";

type Row = { key: string; title: string; detail: string; href?: string; undo: () => void };

function noteName(key: string, edited?: string) {
  if (edited) return edited;
  const [id, variantKey] = key.split("/");
  const entry = HOLY_NAMES.find((candidate) => candidate.id === id);
  return (variantKey ? entry?.variants?.find((variant) => variant.key === variantKey)?.name : entry?.name) ?? key;
}

export function ChangesReview({ busy, status, onPublish, onClose }: { busy: boolean; status: { text: string; error?: boolean } | null; onPublish: () => void; onClose: () => void }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const drafts = useDrafts();
  const overrides = useFaceOverrides();
  const rows: Row[] = [];

  if (drafts.dirty) {
    const authorIds = Array.from(new Set([...Object.keys(drafts.authors), ...Object.keys(overrides)]));
    for (const id of authorIds) {
      const author = findAuthorById(id);
      const pictures = drafts.authors[id];
      const change = pictures ? describeAuthorChange(publishedPictures(id), pictures) : null;
      const parts = [
        change?.text && t.changeText,
        change?.main && t.changeMain,
        (change?.circle || overrides[id]) && t.changeCircle,
        change?.added && t.changeAdded.replace("{count}", String(change.added)),
        change?.removed && t.changeRemoved.replace("{count}", String(change.removed)),
        change?.captions && t.changeCaptions,
        change?.order && t.changeOrder,
      ].filter(Boolean) as string[];
      rows.push({ key: `a:${id}`, title: author?.name ?? id, detail: parts.join(" · ") || t.changePictures, href: `/author/${id}`, undo: () => undoAuthor(id) });
    }
    for (const [key, edit] of Object.entries(drafts.notes)) {
      const isNew = !HOLY_NAMES.some((entry) => entry.id === key.split("/")[0]);
      rows.push({ key: `n:${key}`, title: noteName(key, edit.name), detail: edit.hidden ? t.noteHidden : isNew ? t.noteNew : t.noteChanged, undo: () => undoNote(key) });
    }
    for (const [language, edits] of Object.entries(drafts.localNotes)) {
      for (const [key, edit] of Object.entries(edits)) {
        rows.push({ key: `l:${language}:${key}`, title: `${edit.name || noteName(key)} · ${language.toUpperCase()}`, detail: edit.hidden ? t.noteHidden : t.noteChanged, undo: () => undoLocalNote(language, key) });
      }
    }
  } else {
    for (const id of Object.keys(overrides)) {
      rows.push({ key: `a:${id}`, title: findAuthorById(id)?.name ?? id, detail: t.changeCircle, href: `/author/${id}`, undo: () => undoAuthor(id) });
    }
  }

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.reviewTitle} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="crop-editor-panel admin-review">
        <header>
          <strong>{t.reviewTitle}</strong>
          <button type="button" className="crop-editor-icon" onClick={onClose} aria-label={t.close}><X size={18} /></button>
        </header>
        {rows.length ? (
          <ul className="admin-review-list">
            {rows.map((row) => (
              <li key={row.key}>
                <span>
                  {row.href ? <Link href={row.href} onClick={onClose}>{row.title}</Link> : <strong>{row.title}</strong>}
                  <small>{row.detail}</small>
                </span>
                <button type="button" disabled={busy} onClick={row.undo} title={t.undo}><Undo2 size={14} aria-hidden="true" />{t.undo}</button>
              </li>
            ))}
          </ul>
        ) : <p className="admin-pictures-note">{t.noPending}</p>}
        {status && (busy || status.error) && <p className={`admin-pictures-note${status.error ? " is-error" : ""}`} role="status">{status.text}</p>}
        <div className="crop-editor-actions">
          <button type="button" onClick={onClose}>{t.close}</button>
          {rows.length > 0 && <button type="button" className="is-primary" disabled={busy} onClick={onPublish}><CloudUpload size={15} aria-hidden="true" />{t.publish}</button>}
        </div>
      </div>
    </div>
  );
}
