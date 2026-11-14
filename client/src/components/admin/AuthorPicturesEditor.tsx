/** The admin's picture tools on an author's page: main portrait, circle, slideshow pictures and their captions. */

import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent } from "react";
import { ArrowLeft, ArrowRight, Circle, Crop, ImagePlus, Info, Star, Trash2, X } from "lucide-react";
import { FrameEditor } from "@/components/FrameEditor";
import { useTranslation } from "@/i18n/LanguageContext";
import { storageUrl, type Author } from "@/lib/authors";
import { addPictures, movePicture, removePicture, setCircle, setMainPortrait, setPictureInfo, type PictureInfo } from "@/lib/admin/drafts";
import { fetchPictures, pictureUrlsIn } from "@/lib/admin/images";
import { defaultFace, faceStyle, fullFrame, useAuthorFace, type Face } from "@/lib/portraitCrops";

const IS_TOUCH = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** Picture files in a paste or drop, read at once (the browser empties the clipboard data after the event). */
function fileItems(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (files.length) return files;
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

type Editing =
  | { kind: "main"; src: string }
  | { kind: "circle" }
  | { kind: "info"; src: string; info: PictureInfo };

export function AuthorPicturesEditor({ author }: { author: Author }) {
  const { copy } = useTranslation();
  const t = copy.admin;
  const face = useAuthorFace(author);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pasteBox = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const gallery = author.gallery ?? [];
  const slideCount = (author.portrait ? 1 : 0) + gallery.length;

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = (blobs: Blob[]) => run(async () => {
    const added = await addPictures(author, blobs);
    setMessage(t.added.replace("{count}", String(added)));
  });

  // A picture pasted anywhere on the page (⌘V) goes to the slideshow; the paste box handles its own.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (pasteBox.current?.contains(event.target as Node)) return;
      const files = fileItems(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      void add(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  /** Pictures from a paste or a drop: files first, else <img> and picture addresses in the HTML or text. */
  const takePictures = (data: DataTransfer, landed?: () => string[]) => {
    const html = data.getData("text/html");
    const text = `${data.getData("text/uri-list")}\n${data.getData("text/plain")}`;
    window.setTimeout(() => {
      const box = pasteBox.current;
      const urls = [...(landed?.() ?? []), ...pictureUrlsIn(html, text)];
      if (box) box.innerHTML = "";
      void run(async () => {
        const blobs = await fetchPictures(Array.from(new Set(urls)));
        if (!blobs.length) throw new Error(t.noPicturePasted);
        await add(blobs);
      });
    }, 60);
  };

  const onBoxPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const files = fileItems(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      void add(files);
      return;
    }
    // No file: let the paste land in the box, then look for a picture in what arrived.
    takePictures(event.clipboardData, () => Array.from(pasteBox.current?.querySelectorAll("img") ?? [], (image) => image.src));
  };

  const onBoxDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = fileItems(event.dataTransfer);
    if (files.length) void add(files);
    else takePictures(event.dataTransfer);
  };

  const mainSrc = author.portraitLarge ?? author.portrait;

  return (
    <section className="admin-pictures" aria-label={t.picturesTitle}>
      <header>
        <span className="eyebrow">{t.picturesTitle}</span>
        <div className="admin-pictures-add">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void add(files); }} />
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={15} aria-hidden="true" />{t.addPhotos}</button>
        </div>
      </header>

      <div
        ref={pasteBox}
        className={`admin-paste-box${dragging ? " is-dragging" : ""}`}
        contentEditable={!busy}
        suppressContentEditableWarning
        role="textbox"
        aria-label={t.pasteBox}
        data-placeholder={IS_TOUCH ? t.pasteHintTouch : t.pasteHint}
        inputMode="none"
        onPaste={onBoxPaste}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onBoxDrop}
        onInput={(event) => { if (!event.currentTarget.querySelector("img")) event.currentTarget.textContent = ""; }}
      />

      <ul className="admin-pictures-list">
        {author.portrait && mainSrc && (
          <li className="is-main">
            <span className="admin-pictures-thumb">
              <img src={storageUrl(author.portrait)} alt="" />
              <span className="admin-pictures-circle"><img src={storageUrl(author.portrait)} alt="" style={faceStyle(face ?? defaultFace())} /></span>
            </span>
            <strong>{t.main}</strong>
            <div className="admin-pictures-actions">
              <button type="button" disabled={busy} onClick={() => setEditing({ kind: "circle" })} title={t.circle}><Circle size={15} aria-hidden="true" /><span>{t.circle}</span></button>
              <button type="button" disabled={busy} onClick={() => setEditing({ kind: "main", src: "portrait" })} title={t.reframe}><Crop size={15} aria-hidden="true" /><span>{t.reframe}</span></button>
              <button type="button" disabled={busy} onClick={() => setEditing({ kind: "info", src: "portrait", info: { ...author.portraitInfo } })} title={t.details}><Info size={15} aria-hidden="true" /><span>{t.details}</span></button>
            </div>
          </li>
        )}
        {gallery.map((image, index) => (
          <li key={image.src}>
            <span className="admin-pictures-thumb"><img src={storageUrl(image.src)} alt="" /></span>
            <small>{image.caption || t.noCaption}</small>
            <div className="admin-pictures-actions">
              <button type="button" disabled={busy} onClick={() => setEditing({ kind: "main", src: image.src })} title={t.makeMain}><Star size={15} aria-hidden="true" /><span>{t.makeMain}</span></button>
              <button type="button" disabled={busy} onClick={() => setEditing({ kind: "info", src: image.src, info: { caption: image.caption, credit: image.credit, source: image.source } })} title={t.details}><Info size={15} aria-hidden="true" /><span>{t.details}</span></button>
              <button type="button" disabled={busy || index === 0} onClick={() => movePicture(author, image.src, -1)} aria-label={t.moveEarlier} title={t.moveEarlier}><ArrowLeft size={15} aria-hidden="true" /></button>
              <button type="button" disabled={busy || index === gallery.length - 1} onClick={() => movePicture(author, image.src, 1)} aria-label={t.moveLater} title={t.moveLater}><ArrowRight size={15} aria-hidden="true" /></button>
              <button type="button" className="is-danger" disabled={busy} onClick={() => { if (window.confirm(t.removeConfirm)) removePicture(author, image.src); }} aria-label={t.remove} title={t.remove}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ul>
      {!author.portrait && gallery.length === 0 && <p className="admin-pictures-note">{t.noPictures}</p>}
      {slideCount > 10 && <p className="admin-pictures-note">{t.tooMany}</p>}
      {busy && <p className="admin-pictures-note" role="status">{t.working}</p>}
      {message && <p className="admin-pictures-note" role="status">{message}</p>}

      {editing?.kind === "info" && (
        <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.details}>
        <form className="crop-editor-panel admin-pictures-info" onSubmit={(event) => { event.preventDefault(); setPictureInfo(author, editing.src, editing.info); setEditing(null); }}>
          <header>
            <strong>{t.details}</strong>
            <button type="button" className="crop-editor-icon" onClick={() => setEditing(null)} aria-label={copy.portraitCrops.cancel}><X size={18} /></button>
          </header>
          <img className="admin-pictures-info-thumb" src={storageUrl(editing.src === "portrait" ? author.portrait! : editing.src)} alt="" />
          <label>{t.caption}<input value={editing.info.caption ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, caption: event.target.value } })} /></label>
          <label>{t.credit}<input value={editing.info.credit ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, credit: event.target.value } })} /></label>
          <label>{t.source}<input type="url" inputMode="url" value={editing.info.source ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, source: event.target.value } })} /></label>
          <div className="crop-editor-actions">
            <button type="button" onClick={() => setEditing(null)}>{copy.portraitCrops.cancel}</button>
            <button type="submit" className="is-primary">{copy.portraitCrops.save}</button>
          </div>
        </form>
        </div>
      )}

      {editing?.kind === "circle" && author.portrait && (
        <FrameEditor
          title={t.circleFor.replace("{name}", author.name)}
          src={storageUrl(author.portrait)}
          initial={() => face ?? defaultFace()}
          original={() => (author.face as Face | undefined) ?? defaultFace()}
          onSave={(next) => { setCircle(author, next); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.kind === "main" && (
        <FrameEditor
          title={t.mainFor.replace("{name}", author.name)}
          src={storageUrl(editing.src === "portrait" ? mainSrc! : editing.src)}
          aspect={4 / 3}
          round={false}
          initial={(height) => fullFrame(height, 4 / 3)}
          original={(height) => fullFrame(height, 4 / 3)}
          onSave={(frame) => { const src = editing.src; setEditing(null); void run(() => setMainPortrait(author, src, frame)); }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
