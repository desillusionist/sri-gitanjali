/** The admin's editor for one verse's translation in a second language (Ukrainian, Russian, Spanish…). */

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { getDrafts, setTranslationEdit, undoTranslation } from "@/lib/admin/drafts";

export type TranslationTarget = {
  /** Language code, e.g. "uk". */
  language: string;
  /** The language's own name, e.g. "Українська". */
  languageName: string;
  /** BCP 47 tag for the text field. */
  lang: string;
  /** "song-id::verse-id". */
  key: string;
  /** Where the verse is, e.g. "Gurvaṣṭaka · verse 3". */
  title: string;
  /** The English translation, shown for reference. */
  english: string;
  /** The translation as shown now. */
  text: string;
  /** Whether the shown translation is still marked as a draft. */
  isDraft: boolean;
};

let open: TranslationTarget | null = null;
const listeners = new Set<() => void>();
export function openTranslationEditor(target: TranslationTarget) {
  open = target;
  listeners.forEach((listener) => listener());
}
function closeTranslationEditor() {
  open = null;
  listeners.forEach((listener) => listener());
}
const useOpen = () => useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => open, () => null);

export function TranslationEditor() {
  const target = useOpen();
  return target ? <TranslationEditorDialog key={`${target.language}:${target.key}`} target={target} /> : null;
}

function TranslationEditorDialog({ target }: { target: TranslationTarget }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const [text, setText] = useState(target.text);
  const hasDraft = getDrafts().translations[target.language]?.[target.key] !== undefined;

  const save = () => {
    if (!text.trim()) return;
    setTranslationEdit(target.language, target.key, text);
    closeTranslationEditor();
  };

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.editTranslation}>
      <form className="crop-editor-panel admin-note-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <header>
          <strong>{t.editTranslation} · {target.language.toUpperCase()}</strong>
          <button type="button" className="crop-editor-icon" onClick={closeTranslationEditor} aria-label={copy.portraitCrops.cancel}><X size={18} /></button>
        </header>
        <p className="admin-pictures-note">{target.title}</p>
        <div className="admin-translation-english" lang="en"><small>English</small><p>{target.english}</p></div>
        <label>{target.languageName}<textarea rows={8} lang={target.lang} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <p className="admin-pictures-note">{target.isDraft ? t.translationDraftHint : t.translationHint}</p>
        <div className="crop-editor-actions">
          {hasDraft && <button type="button" onClick={() => { undoTranslation(target.language, target.key); closeTranslationEditor(); }}>{t.undo}</button>}
          <button type="button" onClick={closeTranslationEditor}>{copy.portraitCrops.cancel}</button>
          <button type="submit" className="is-primary" disabled={!text.trim()}>{target.isDraft && text === target.text ? t.markReviewed : copy.portraitCrops.save}</button>
        </div>
      </form>
    </div>
  );
}
