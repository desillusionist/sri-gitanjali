/** Drag and pinch a picture inside a frame (the portrait circle, or a 3:4 portrait), then save the frame. */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageContext";
import { clampFace, dragFace, faceStyle, PORTRAIT_HEIGHT, zoomFace, type Face } from "@/lib/portraitCrops";

export type FrameEditorProps = {
  title: string;
  src: string;
  /** Frame height over width: 1 for the circle, 4/3 for a portrait. */
  aspect?: number;
  round?: boolean;
  /** The frame to start from; it may depend on the picture's shape, so it gets the picture's height (in % of its width). */
  initial: (height: number) => Face;
  /** Where "Original" goes back to. */
  original: (height: number) => Face;
  /** Small previews of the current frame, if any. */
  previews?: (face: Face) => ReactNode;
  onSave: (face: Face, size: { width: number; height: number }) => void;
  onClose: () => void;
};

export function FrameEditor({ title, src, aspect = 1, round = true, initial, original, previews, onSave, onClose }: FrameEditorProps) {
  const { copy } = useTranslation();
  const t = copy.portraitCrops;
  const [height, setHeight] = useState(PORTRAIT_HEIGHT);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [face, setFace] = useState<Face>(() => initial(PORTRAIT_HEIGHT));
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; face: Face } | null>(null);
  const maxDiameter = Math.min(100, height / aspect);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = () => stage.current?.getBoundingClientRect().width ?? 1;
  const distance = () => {
    const [a, b] = Array.from(pointers.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture for a pointer already lifted; dragging still works inside the frame.
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
      setFace(zoomFace(start.face, distance() / start.distance, height, aspect));
    } else if (pointers.current.size === 1) {
      setFace((current) => dragFace(current, event.clientX - last.x, event.clientY - last.y, width(), height, aspect));
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => setFace((current) => zoomFace(current, Math.exp(-event.deltaY * 0.002), height, aspect));

  return (
    <div className="crop-editor" role="dialog" aria-modal="true" aria-label={title}>
      <div className="crop-editor-panel">
        <header>
          <strong translate="no">{title}</strong>
          <button type="button" className="crop-editor-icon" onClick={onClose} aria-label={t.cancel}><X size={18} /></button>
        </header>
        <div
          ref={stage}
          className={`crop-editor-stage${round ? "" : " is-frame"}`}
          style={{ aspectRatio: `1 / ${aspect}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={faceStyle(face, aspect)}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (!image.naturalWidth) return;
              const next = (100 * image.naturalHeight) / image.naturalWidth;
              setNatural({ width: image.naturalWidth, height: image.naturalHeight });
              setHeight(next);
              setFace(clampFace(initial(next), next, aspect));
            }}
          />
        </div>
        <p className="crop-editor-hint">{t.hint}</p>
        <label className="crop-editor-zoom">
          <span>{t.zoom}</span>
          <input
            type="range"
            min={8}
            max={maxDiameter}
            step={0.5}
            value={maxDiameter + 8 - face[2]}
            onChange={(event) => setFace((current) => clampFace([current[0], current[1], maxDiameter + 8 - Number(event.target.value)], height, aspect))}
          />
        </label>
        {previews && <div className="crop-editor-previews" aria-hidden="true">{previews(face)}</div>}
        <div className="crop-editor-actions">
          <button type="button" onClick={() => setFace(clampFace(original(height), height, aspect))}><RotateCcw size={15} aria-hidden="true" />{t.original}</button>
          <button type="button" className="is-primary" disabled={!natural} onClick={() => natural && onSave(face, natural)}><Check size={15} aria-hidden="true" />{t.save}</button>
        </div>
      </div>
    </div>
  );
}
