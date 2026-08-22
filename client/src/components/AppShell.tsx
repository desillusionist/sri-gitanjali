/**
 * Паломнический свиток: светлая редакционная среда чтения, шафрановые акценты,
 * асимметричная reading rail и спокойные материальные поверхности.
 */

import { brandAssets } from "@/data/sources";
import { useTranslation } from "@/i18n/LanguageContext";
import { BookOpenText, Bookmark, ChevronDown, LibraryBig, Search, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { copy } = useTranslation();
  const [activeHash, setActiveHash] = useState(() => window.location.hash);
  const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    setActiveHash(window.location.hash);
  }, [location]);

  useEffect(() => {
    const syncReaderPanel = (event: Event) => setIsReaderPanelOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("kirtan-guide:reader-panel-state", syncReaderPanel);
    return () => window.removeEventListener("kirtan-guide:reader-panel-state", syncReaderPanel);
  }, []);

  const isSongPage = location.startsWith("/song/");

  const navigateToHomeSection = (event: MouseEvent<HTMLAnchorElement>, targetId: "search" | "library") => {
    if (location !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const hash = `#${targetId}`;
    window.history.pushState(null, "", `/${hash}`);
    setActiveHash(hash);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleReaderPanel = () => {
    window.dispatchEvent(new Event("kirtan-guide:toggle-reader-panel"));
  };

  return (
    <div className="app-shell">
      <header className="reading-rail" aria-label={copy.navigation.mainLabel}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="brand-lockup" type="button" aria-label={copy.navigation.openMenu}>
                  <img className="brand-mark" src={brandAssets.mark} alt="" />
                  <span className="brand-name">Kīrtan<br />Guide</span>
                  <ChevronDown className="brand-menu-chevron" aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{copy.navigation.openMenu}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="brand-menu" align="start" side="bottom" sideOffset={8}>
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/#library" onClick={(event) => navigateToHomeSection(event, "library")}>
                <LibraryBig aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.library}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/#search" onClick={(event) => navigateToHomeSection(event, "search")}>
                <Search aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.search}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/favorites">
                <Bookmark aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.favorites}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="rail-nav">
          {isSongPage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button id="global-reading-tools-trigger" className={`rail-nav-link rail-reader-tools-trigger ${isReaderPanelOpen ? "is-active" : ""}`} type="button" onClick={toggleReaderPanel} aria-expanded={isReaderPanelOpen} aria-controls="reader-panel" aria-label={isReaderPanelOpen ? copy.song.closeReaderPanel : copy.song.openReaderPanel}>
                  <SlidersHorizontal aria-hidden="true" size={18} strokeWidth={1.7} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{isReaderPanelOpen ? copy.song.closeReaderPanel : copy.song.openReaderPanel}</TooltipContent>
            </Tooltip>
          )}
        </nav>

        <div className="rail-note">
          <span className="rail-note-rule" />
          <BookOpenText aria-hidden="true" size={17} />
          <p>{copy.railNote}</p>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
