/** Adjusting the round crops of the portraits: drag and pinch each face into its circle, then share the result. */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Check, Copy, RotateCcw, Share2, X } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { AuthorPortrait } from "@/components/AuthorPortrait";
import { useTranslation } from "@/i18n/LanguageContext";
import { AUTHORS, authorPortraitUrl, type Author } from "@/lib/authors";
import { usePageMeta } from "@/lib/pageMeta";
import { setCircle, useDrafts, useLiveAuthor } from "@/lib/admin/drafts";
import { useIsAdmin } from "@/lib/admin/session";
import {
  clampFace, clearFaceOverrides, defaultFace, dragFace, faceStyle, formatFaceChanges, PORTRAIT_HEIGHT, setFaceOverride, useFaceOverrides, zoomFace, type Face,
} from "@/lib/portraitCrops";

const WITH_PORTRAIT = AUTHORS.filter((author) => author.portrait);
const CAN_SHARE = typeof navigator !== "undefined" && "share" in navigator;

function CropEditor({ author, onClose }: { author: Author; onClose: () => void }) {
  const { copy } = useTranslation();
  const t = copy.portraitCrops;
  const overrides = useFaceOverrides();
  const isAdmin = useIsAdmin();
  const live = useLiveAuthor(author);
  const original = author.face as Face | undefined;
  const [height, setHeight] = useState(PORTRAIT_HEIGHT);
  const [face, setFace] = useState<Face>(() => overrides[author.id] ?? (live.face as Face | undefined) ?? defaultFace());
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; face: Face } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const size = () => stage.current?.getBoundingClientRect().width ?? 1;
  const distance = () => {
    const [a, b] = Array.from(pointers.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture for a pointer already lifted; dragging still works inside the circle.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) pinch.current = { distance: distance(), face };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const start = pinch.current;
      setFace(zoomFace(start.face, distance() / start.distance, height));
    } else if (pointers.current.size === 1) {
      setFace((current) => dragFace(current, event.clientX - last.x, event.clientY - last.y, size(), height));
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => setFace((current) => zoomFace(current, Math.exp(-event.deltaY * 0.002), height));

  const save = () => {
    if (isAdmin) setCircle(author, face);
    else setFaceOverride(author, face);
    onClose();
  };
  const url = authorPortraitUrl(live);
  const preview = { ...live, face };

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={t.editLabel.replace("{name}", author.name)}>
      <div className="crop-editor-panel">
        <header>
          <strong translate="no">{author.name}</strong>
          <button type="button" className="crop-editor-icon" onClick={onClose} aria-label={t.cancel}><X size={18} /></button>
        </header>
        <div
          ref={stage}
          className="crop-editor-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {url && (
            <img
              src={url}
              alt=""
              draggable={false}
              style={faceStyle(face)}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (!image.naturalWidth) return;
                const next = (100 * image.naturalHeight) / image.naturalWidth;
                setHeight(next);
                setFace((current) => clampFace(current, next));
              }}
            />
          )}
        </div>
        <p className="crop-editor-hint">{t.hint}</p>
        <label className="crop-editor-zoom">
          <span>{t.zoom}</span>
          <input
            type="range"
            min={8}
            max={Math.min(100, height)}
            step={0.5}
            value={Math.min(100, height) + 8 - face[2]}
            onChange={(event) => setFace((current) => clampFace([current[0], current[1], Math.min(100, height) + 8 - Number(event.target.value)], height))}
          />
        </label>
        <div className="crop-editor-previews" aria-hidden="true">
          {["3rem", "2.6rem", "1.9rem"].map((width) => (
            <span key={width} style={{ width, height: width }} className="crop-editor-preview"><AuthorPortraitPreview author={preview} /></span>
          ))}
        </div>
        <div className="crop-editor-actions">
          <button type="button" onClick={() => setFace(original ?? defaultFace(height))}><RotateCcw size={15} aria-hidden="true" />{t.original}</button>
          <button type="button" className="is-primary" onClick={save}><Check size={15} aria-hidden="true" />{t.save}</button>
        </div>
      </div>
    </div>
  );
}

/** The small round portrait with a face box that is not saved yet. */
function AuthorPortraitPreview({ author }: { author: Author & { face: Face } }) {
  const url = authorPortraitUrl(author);
  return <span className="author-portrait author-portrait-round">{url && <img src={url} alt="" style={faceStyle(author.face)} />}</span>;
}

function PortraitCropsContent() {
  const { copy } = useTranslation();
  const t = copy.portraitCrops;
  usePageMeta(t.title);
  const overrides = useFaceOverrides();
  const isAdmin = useIsAdmin();
  const drafts = useDrafts();
  const [editing, setEditing] = useState<Author | null>(null);
  const [sent, setSent] = useState<"copied" | "shared" | null>(null);
  const changed = Object.keys(overrides).length;
  const text = formatFaceChanges(overrides, AUTHORS);

  const share = async () => {
    try {
      if (CAN_SHARE) {
        await navigator.share({ text });
        setSent("shared");
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSent("copied");
    } catch {
      window.prompt(t.copyPrompt, text);
    }
  };

  return (
    <div className="favorites-page portrait-crops-page">
      <header className="favorites-header">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.lede}</p>
      </header>
      <ul className="portrait-crops-grid">
        {WITH_PORTRAIT.map((author) => (
          <li key={author.id}>
            <button type="button" onClick={() => { setEditing(author); setSent(null); }} className={overrides[author.id] || drafts.authors[author.id] ? "is-changed" : undefined}>
              <AuthorPortrait author={author} />
              <span translate="no">{author.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {!isAdmin && <div className="portrait-crops-bar" role="status">
        <span>{changed ? t.changed.replace("{count}", String(changed)) : t.noChanges}</span>
        {changed > 0 && (
          <>
            <button type="button" onClick={() => { if (window.confirm(t.clearConfirm)) clearFaceOverrides(); }}>{t.clear}</button>
            <button type="button" className="is-primary" onClick={share}>
              {sent ? <Check size={15} aria-hidden="true" /> : CAN_SHARE ? <Share2 size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {sent === "copied" ? t.copied : sent === "shared" ? t.shared : t.send}
            </button>
          </>
        )}
      </div>}
      <p className="portrait-crops-back"><Link href="/vaisnavas">{t.back}</Link></p>
      {editing && <CropEditor author={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default function PortraitCropsPage() {
  return <AppShell><PortraitCropsContent /></AppShell>;
}
