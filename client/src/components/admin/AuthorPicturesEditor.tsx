/** The admin's picture tools on an author's page: main portrait, circle, slideshow pictures and their captions. */

import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import { ArrowLeft, ArrowRight, Circle, ClipboardPaste, Crop, ImagePlus, Info, Star, Trash2 } from "lucide-react";
import { FrameEditor } from "@/components/FrameEditor";
import { useTranslation } from "@/i18n/LanguageContext";
import { storageUrl, type Author } from "@/lib/authors";
import { addPictures, movePicture, removePicture, setCircle, setMainPortrait, setPictureInfo, type PictureInfo } from "@/lib/admin/drafts";
import { fetchPictures, pictureUrlsIn, readClipboardImages } from "@/lib/admin/images";
import { defaultFace, faceStyle, fullFrame, useAuthorFace, type Face } from "@/lib/portraitCrops";

const IS_TOUCH = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** Picture files in a paste, read at once (the browser empties the clipboard data after the event). */
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
  const [pasting, setPasting] = useState(false);
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

  const openPasteBox = () => {
    setPasting(true);
    setMessage(null);
    requestAnimationFrame(() => pasteBox.current?.focus());
  };

  // On a phone, Paste opens the box (an ordinary long-press Paste brings the picture, as in Notes);
  // elsewhere the clipboard is read directly, falling back to the box.
  const paste = () => {
    if (IS_TOUCH) { openPasteBox(); return; }
    void run(async () => {
      const blobs = await readClipboardImages().catch(() => []);
      if (blobs.length) await add(blobs);
      else openPasteBox();
    });
  };

  const onBoxPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const files = fileItems(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      setPasting(false);
      void add(files);
      return;
    }
    // No file: let the paste land in the box, then look for a picture in what arrived.
    const html = event.clipboardData.getData("text/html");
    const text = `${event.clipboardData.getData("text/uri-list")}\n${event.clipboardData.getData("text/plain")}`;
    window.setTimeout(() => {
      const box = pasteBox.current;
      const urls = [...Array.from(box?.querySelectorAll("img") ?? [], (image) => image.src), ...pictureUrlsIn(html, text)];
      if (box) box.innerHTML = "";
      void run(async () => {
        const blobs = await fetchPictures(Array.from(new Set(urls)));
        if (!blobs.length) throw new Error(t.noPicturePasted);
        setPasting(false);
        await add(blobs);
      });
    }, 60);
  };

  const mainSrc = author.portraitLarge ?? author.portrait;

  return (
    <section className="admin-pictures" aria-label={t.picturesTitle}>
      <header>
        <span className="eyebrow">{t.picturesTitle}</span>
        <div className="admin-pictures-add">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void add(files); }} />
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={15} aria-hidden="true" />{t.addPhotos}</button>
          <button type="button" disabled={busy} onClick={paste}><ClipboardPaste size={15} aria-hidden="true" />{t.paste}</button>
        </div>
      </header>

      {pasting && (
        <div className="admin-paste">
          <div
            ref={pasteBox}
            className="admin-paste-box"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={t.pasteBox}
            inputMode="none"
            onPaste={onBoxPaste}
            onInput={(event) => { if (!event.currentTarget.querySelector("img")) event.currentTarget.textContent = ""; }}
          />
          <p>{t.pasteHint}</p>
          <button type="button" onClick={() => setPasting(false)}>{copy.portraitCrops.cancel}</button>
        </div>
      )}

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
        <form className="admin-pictures-info" onSubmit={(event) => { event.preventDefault(); setPictureInfo(author, editing.src, editing.info); setEditing(null); }}>
          <label>{t.caption}<input value={editing.info.caption ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, caption: event.target.value } })} /></label>
          <label>{t.credit}<input value={editing.info.credit ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, credit: event.target.value } })} /></label>
          <label>{t.source}<input type="url" inputMode="url" value={editing.info.source ?? ""} onChange={(event) => setEditing({ ...editing, info: { ...editing.info, source: event.target.value } })} /></label>
          <div className="crop-editor-actions">
            <button type="button" onClick={() => setEditing(null)}>{copy.portraitCrops.cancel}</button>
            <button type="submit" className="is-primary">{copy.portraitCrops.save}</button>
          </div>
        </form>
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
