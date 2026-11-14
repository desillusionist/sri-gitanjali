/** The admin's editor for a name, place or book note: its text, spellings and its notes in the other languages. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { HOLY_NAMES, type HolyNameEdit, type HolyNameKind, type HolyNameLocalEdit } from "@/lib/holyNames";
import { HOLY_NAME_LOCALES, loadHolyNameLocale } from "@/lib/holyNamesI18n";
import { getDrafts, setLocalNoteEdit, setNoteEdit } from "@/lib/admin/drafts";

const KINDS: HolyNameKind[] = ["person", "divine", "place", "realm", "other", "book"];

// Which note is open: its key ("id" or "id/variant"), "" for a new note, or null.
let openKey: string | null = null;
const listeners = new Set<() => void>();
export function openNoteEditor(key: string) {
  openKey = key;
  listeners.forEach((listener) => listener());
}
function closeNoteEditor() {
  openKey = null;
  listeners.forEach((listener) => listener());
}
const useOpenKey = () => useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => openKey, () => null);

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const MARKS = new RegExp("\\p{M}", "gu");
const slug = (value: string) => value.normalize("NFD").replace(MARKS, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Form = { kind: HolyNameKind; name: string; about: string; aliases: string; ru: string; maps: string; hidden: boolean };
type LocalForm = { name: string; about: string; aliases: string; hidden: boolean; changed: boolean };

function initialForm(key: string): Form {
  const draft = getDrafts().notes[key];
  const [id, variantKey] = key.split("/");
  const entry = HOLY_NAMES.find((candidate) => candidate.id === id);
  const variant = variantKey ? entry?.variants?.find((candidate) => candidate.key === variantKey) : undefined;
  const base = variant ?? entry;
  return {
    kind: draft?.kind ?? entry?.kind ?? "person",
    name: draft?.name ?? base?.name ?? "",
    about: draft?.about ?? base?.about ?? "",
    aliases: (draft?.aliases ?? base?.aliases ?? []).join("\n"),
    ru: (draft?.ru ?? base?.ru ?? []).join("\n"),
    maps: draft?.maps ?? entry?.maps ?? "",
    hidden: draft?.hidden ?? false,
  };
}

export function NoteEditor() {
  const key = useOpenKey();
  return key === null ? null : <NoteEditorDialog key={key || "new"} noteKey={key} />;
}

function NoteEditorDialog({ noteKey }: { noteKey: string }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const isNew = noteKey === "";
  const isVariant = noteKey.includes("/");
  const [form, setForm] = useState<Form>(() => initialForm(noteKey));
  const [language, setLanguage] = useState(HOLY_NAME_LOCALES[0] ?? "");
  const [local, setLocal] = useState<Record<string, LocalForm>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!language || local[language] || isNew) return;
    void loadHolyNameLocale(language).then((locale) => {
      const draft = getDrafts().localNotes[language]?.[noteKey];
      const note = locale?.entries[noteKey];
      setLocal((current) => ({ ...current, [language]: { name: draft?.name ?? note?.name ?? "", about: draft?.about ?? note?.about ?? "", aliases: (draft?.aliases ?? note?.aliases ?? []).join("\n"), hidden: draft?.hidden ?? false, changed: false } }));
    });
  }, [language, local, noteKey, isNew]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeNoteEditor(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const save = () => {
    if (!form.hidden && (!form.name.trim() || !form.about.trim())) { setError(t.noteNeedsText); return; }
    let key = noteKey;
    if (isNew) {
      key = slug(form.name);
      if (!key || HOLY_NAMES.some((entry) => entry.id === key) || getDrafts().notes[key]) { setError(t.noteExists); return; }
    }
    const edit: HolyNameEdit = form.hidden ? { hidden: true } : {
      ...(isVariant ? {} : { kind: form.kind }),
      name: form.name.trim(),
      about: form.about.trim(),
      aliases: lines(form.aliases).length ? lines(form.aliases) : [form.name.trim()],
      ru: lines(form.ru),
      ...(!isVariant && form.kind === "place" && form.maps.trim() ? { maps: form.maps.trim() } : {}),
    };
    setNoteEdit(key, edit);
    for (const [code, value] of Object.entries(local)) {
      if (!value.changed) continue;
      const localEdit: HolyNameLocalEdit = value.hidden ? { hidden: true } : {
        ...(value.name.trim() ? { name: value.name.trim() } : {}),
        about: value.about.trim(),
        ...(lines(value.aliases).length ? { aliases: lines(value.aliases) } : {}),
      };
      if (!value.hidden && !value.about.trim()) continue;
      setLocalNoteEdit(code, key, localEdit);
    }
    closeNoteEditor();
  };

  const field = (name: keyof Form) => ({ value: form[name] as string, onChange: (event: { target: { value: string } }) => setForm({ ...form, [name]: event.target.value }) });
  const current = local[language];
  const setCurrent = (patch: Partial<LocalForm>) => setLocal({ ...local, [language]: { ...current!, ...patch, changed: true } });

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={isNew ? t.newNote : t.editNote}>
      <form className="crop-editor-panel admin-note-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <header>
          <strong>{isNew ? t.newNote : `${t.editNote}: ${form.name}`}</strong>
          <button type="button" className="crop-editor-icon" onClick={closeNoteEditor} aria-label={copy.portraitCrops.cancel}><X size={18} /></button>
        </header>
        {!isVariant && (
          <label>{t.kind}
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as HolyNameKind })}>
              {KINDS.map((kind) => <option key={kind} value={kind}>{copy.song.holyNameKinds[kind]}</option>)}
            </select>
          </label>
        )}
        <label>{t.noteName}<input {...field("name")} /></label>
        <label>{t.noteText}<textarea rows={4} {...field("about")} /></label>
        <label>{t.spellings}<textarea rows={3} {...field("aliases")} /><small>{t.spellingsHint}</small></label>
        <label>{t.russianForms}<textarea rows={2} {...field("ru")} /><small>{t.russianHint}</small></label>
        {!isVariant && form.kind === "place" && <label>{t.mapSearch}<input {...field("maps")} /></label>}
        {!isNew && <label className="admin-check"><input type="checkbox" checked={form.hidden} onChange={(event) => setForm({ ...form, hidden: event.target.checked })} />{t.hideNote}</label>}

        {!isNew && !form.hidden && HOLY_NAME_LOCALES.length > 0 && (
          <fieldset className="admin-note-local">
            <legend>{t.inLanguage}
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {HOLY_NAME_LOCALES.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </legend>
            {current ? (
              <>
                <label>{t.noteName}<input value={current.name} onChange={(event) => setCurrent({ name: event.target.value })} /></label>
                <label>{t.noteText}<textarea rows={3} value={current.about} onChange={(event) => setCurrent({ about: event.target.value })} /></label>
                <label>{t.spellings}<textarea rows={2} value={current.aliases} onChange={(event) => setCurrent({ aliases: event.target.value })} /><small>{t.localSpellingsHint}</small></label>
              </>
            ) : <p className="admin-pictures-note">{t.working}</p>}
          </fieldset>
        )}

        <p className="admin-pictures-note">{t.notesAfterPublish}</p>
        {error && <p className="admin-pictures-note is-error" role="alert">{error}</p>}
        <div className="crop-editor-actions">
          <button type="button" onClick={closeNoteEditor}>{copy.portraitCrops.cancel}</button>
          <button type="submit" className="is-primary">{copy.portraitCrops.save}</button>
        </div>
      </form>
    </div>
  );
}
