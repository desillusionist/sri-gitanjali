/** The tall portrait on an author's page, which opens full screen when tapped; more pictures follow as a slideshow. */

import { AuthorPortrait } from "@/components/AuthorPortrait";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorSlides, type Author } from "@/lib/authors";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";

const SWIPE_PX = 40;

export function PortraitViewer({ author }: { author: Author }) {
  const { copy } = useTranslation();
  const label = copy.author.enlargePortrait.replace("{author}", author.name);
  const slides = authorSlides(author);
  const [index, setIndex] = useState(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const count = slides.length;
  const slide = slides[Math.min(index, count - 1)];
  const go = (step: number) => setIndex((current) => (current + step + count) % count);

  return (
    <DialogPrimitive.Root onOpenChange={(open) => { if (open) setIndex(0); }}>
      <DialogPrimitive.Trigger className="portrait-viewer-trigger" aria-label={label} title={label}>
        <AuthorPortrait author={author} variant="tall" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="portrait-viewer-overlay" />
        <DialogPrimitive.Content
          className="portrait-viewer"
          aria-describedby={undefined}
          onKeyDown={(event) => {
            if (count < 2) return;
            if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
            if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
          }}
        >
          <DialogPrimitive.Title className="sr-only">{author.name}</DialogPrimitive.Title>
          {/* A tap on the picture or around it closes the view; a swipe moves to the next or previous picture. */}
          <DialogPrimitive.Close
            className="portrait-viewer-frame"
            aria-label={copy.author.closePortrait}
            onPointerDown={(event) => { swipeRef.current = { x: event.clientX, y: event.clientY }; swipedRef.current = false; }}
            onPointerUp={(event) => {
              const start = swipeRef.current;
              swipeRef.current = null;
              if (!start || count < 2) return;
              const dx = event.clientX - start.x;
              if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
                swipedRef.current = true;
                go(dx < 0 ? 1 : -1);
              }
            }}
            onClick={(event) => { if (swipedRef.current) { event.preventDefault(); swipedRef.current = false; } }}
          >
            {slide && <img key={slide.src} src={slide.src} alt={slide.caption ? `${author.name}: ${slide.caption}` : author.name} decoding="async" draggable={false} />}
          </DialogPrimitive.Close>
          <div className="portrait-viewer-caption">
            <p>{author.name}<span>{slide?.caption ?? author.dates}</span></p>
            {slide?.credit && (
              <p className="portrait-viewer-credit">
                {slide.source ? <a href={slide.source} target="_blank" rel="noreferrer">{slide.credit}</a> : slide.credit}
              </p>
            )}
            {count > 1 && (
              <div className="portrait-viewer-nav">
                <button type="button" onClick={() => go(-1)} aria-label={copy.author.previousPortrait} title={copy.author.previousPortrait}><ChevronLeft size={20} aria-hidden="true" /></button>
                <span aria-live="polite">{copy.author.portraitCount.replace("{index}", String(index + 1)).replace("{count}", String(count))}</span>
                <button type="button" onClick={() => go(1)} aria-label={copy.author.nextPortrait} title={copy.author.nextPortrait}><ChevronRight size={20} aria-hidden="true" /></button>
              </div>
            )}
          </div>
          <DialogPrimitive.Close className="portrait-viewer-close" aria-label={copy.author.closePortrait} title={copy.author.closePortrait}>
            <X size={20} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
