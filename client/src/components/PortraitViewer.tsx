/** The tall portrait on an author's page, which opens full screen when tapped. */

import { AuthorPortrait } from "@/components/AuthorPortrait";
import { useTranslation } from "@/i18n/LanguageContext";
import { authorLargePortraitUrl, type Author } from "@/lib/authors";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function PortraitViewer({ author }: { author: Author }) {
  const { copy } = useTranslation();
  const label = copy.author.enlargePortrait.replace("{author}", author.name);
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger className="portrait-viewer-trigger" aria-label={label} title={label}>
        <AuthorPortrait author={author} variant="tall" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="portrait-viewer-overlay" />
        <DialogPrimitive.Content className="portrait-viewer" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">{author.name}</DialogPrimitive.Title>
          {/* A tap anywhere on the picture or around it closes the view. */}
          <DialogPrimitive.Close className="portrait-viewer-frame" aria-label={copy.author.closePortrait}>
            <img src={authorLargePortraitUrl(author)} alt={author.name} decoding="async" />
          </DialogPrimitive.Close>
          <p className="portrait-viewer-caption">{author.name}<span>{author.dates}</span></p>
          <DialogPrimitive.Close className="portrait-viewer-close" aria-label={copy.author.closePortrait} title={copy.author.closePortrait}>
            <X size={20} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
