/** The admin's editor for the texts of a Vaiṣṇava's page: name, role, dates, place, summary, biography and sources. */

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import type { Author } from "@/lib/authors";
import { setAuthorText } from "@/lib/admin/drafts";

const isUrl = (value: string) => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function AuthorTextEditor({ author, onClose }: { author: Author; onClose: () => void }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const [form, setForm] = useState({
    name: author.name,
    role: author.role,
    dates: author.dates,
    place: author.place,
    summary: author.summary,
    bio: author.bio.join("\n\n"),
    sources: author.sources.join("\n"),
  });
  const [problem, setProblem] = useState<string | null>(null);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }) });

  const save = () => {
    const sources = form.sources.split("\n").map((line) => line.trim()).filter(Boolean);
    const bad = sources.find((line) => !isUrl(line));
    if (bad) return setProblem(t.textBadSource.replace("{line}", bad));
    if (!form.name.trim()) return setProblem(t.textNeedsName);
    setAuthorText(author, {
      name: form.name.trim(),
      role: form.role.trim(),
      dates: form.dates.trim(),
      place: form.place.trim(),
      summary: form.summary.trim(),
      bio: form.bio.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean),
      sources,
    });
    onClose();
  };

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.editText}>
      <form className="crop-editor-panel admin-pictures-info admin-text-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <header>
          <strong>{t.editText}</strong>
          <button type="button" className="crop-editor-icon" onClick={onClose} aria-label={copy.portraitCrops.cancel}><X size={18} /></button>
        </header>
        <label>{t.textName}<input {...field("name")} /></label>
        <label>{t.textRole}<input {...field("role")} /></label>
        <label>{t.textDates}<input {...field("dates")} /></label>
        <label>{t.textPlace}<input {...field("place")} /></label>
        <label>{t.textSummary}<textarea rows={3} {...field("summary")} /></label>
        <label>{t.textBio}<textarea rows={10} {...field("bio")} /><small>{t.textBioHint}</small></label>
        <label>{t.textSources}<textarea rows={3} inputMode="url" {...field("sources")} /><small>{t.textSourcesHint}</small></label>
        {problem && <p className="admin-pictures-note is-error" role="alert">{problem}</p>}
        <div className="crop-editor-actions">
          <button type="button" onClick={onClose}>{copy.portraitCrops.cancel}</button>
          <button type="submit" className="is-primary">{copy.portraitCrops.save}</button>
        </div>
      </form>
    </div>
  );
}
