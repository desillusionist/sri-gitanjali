/**
 * Паломнический свиток: светлая редакционная среда чтения, шафрановые акценты,
 * асимметричная reading rail и спокойные материальные поверхности.
 */

import { brandAssets } from "@/data/sources";
import { useTranslation } from "@/i18n/LanguageContext";
import { BookOpenText, Bookmark, ChevronDown, LibraryBig, ListMusic, Palette, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { THEMES, setTheme, useTheme, type Theme } from "@/lib/theme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { useState, type MouseEvent, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { copy } = useTranslation();
  const theme = useTheme();
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);

  const navigateToHomeSection = (event: MouseEvent<HTMLAnchorElement>, targetId: "search" | "library") => {
    if (location !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const hash = `#${targetId}`;
    window.history.pushState(null, "", `${import.meta.env.BASE_URL}${hash}`);
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
            <DropdownMenuSeparator className="brand-menu-separator" />
            <DropdownMenuItem asChild className="brand-menu-item">
              <Link href="/playlist" onClick={() => setIsBrandMenuOpen(false)}>
                <ListMusic aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.playlist}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="brand-menu-separator" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="brand-menu-item">
                <Palette aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{copy.navigation.theme}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="brand-menu">
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                  {THEMES.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option} className="brand-menu-item theme-option">
                      <span className={`theme-swatch is-${option}`} aria-hidden="true" />
                      <span className="theme-option-text"><strong>{copy.navigation.themes[option].name}</strong><small>{copy.navigation.themes[option].description}</small></span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
