/**
 * Паломнический свиток: светлая редакционная среда чтения, шафрановые акценты,
 * асимметричная reading rail и спокойные материальные поверхности.
 */

import { brandAssets } from "@/data/sources";
import { useTranslation } from "@/i18n/LanguageContext";
import { BookOpenText, Bookmark, ChevronDown, LibraryBig, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { useState, type MouseEvent, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { copy } = useTranslation();
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);

  const navigateToHomeSection = (event: MouseEvent<HTMLAnchorElement>, targetId: "search" | "library") => {
    if (location !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const hash = `#${targetId}`;
    window.history.pushState(null, "", `/${hash}`);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <header className="reading-rail" aria-label={copy.navigation.mainLabel}>
        <DropdownMenu open={isBrandMenuOpen} onOpenChange={setIsBrandMenuOpen}>
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
              <Link href="/#library" onClick={(event) => { navigateToHomeSection(event, "library"); setIsBrandMenuOpen(false); }}>
                <LibraryBig aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.library}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/#search" onClick={(event) => { navigateToHomeSection(event, "search"); setIsBrandMenuOpen(false); }}>
                <Search aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.search}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/favorites" onClick={() => setIsBrandMenuOpen(false)}>
                <Bookmark aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.favorites}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="rail-note">
          <BookOpenText aria-hidden="true" size={17} />
          <p>{copy.railNote}</p>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
