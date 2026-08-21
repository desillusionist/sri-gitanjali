/**
 * Паломнический свиток: светлая редакционная среда чтения, шафрановые акценты,
 * асимметричная reading rail и спокойные материальные поверхности.
 */

import { brandAssets } from "@/data/sources";
import { useTranslation } from "@/i18n/LanguageContext";
import { BookOpenText, Bookmark, LibraryBig, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { copy } = useTranslation();
  const [activeHash, setActiveHash] = useState(() => window.location.hash);

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    setActiveHash(window.location.hash);
  }, [location]);

  const navigateToHomeSection = (event: MouseEvent<HTMLAnchorElement>, targetId: "search" | "library") => {
    if (location !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const hash = `#${targetId}`;
    window.history.pushState(null, "", `/${hash}`);
    setActiveHash(hash);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rails = [
    { href: "/#library", targetId: "library" as const, label: copy.navigation.library, icon: LibraryBig, match: (path: string) => path === "/" && activeHash === "#library" },
    { href: "/#search", targetId: "search" as const, label: copy.navigation.search, icon: Search, match: (path: string) => path === "/" && activeHash === "#search" },
    { href: "/favorites", label: copy.navigation.favorites, icon: Bookmark, match: (path: string) => path === "/favorites" },
  ];

  return (
    <div className="app-shell">
      <header className="reading-rail" aria-label={copy.navigation.mainLabel}>
        <Link href="/" className="brand-lockup" aria-label="Kīrtan Guide library">
          <img className="brand-mark" src={brandAssets.mark} alt="" />
          <span className="brand-name">Kīrtan<br />Guide</span>
        </Link>

        <nav className="rail-nav">
          {rails.map(({ href, targetId, label, icon: Icon, match }) => {
            const isActive = match(location);
            return (
              <Link
                key={href}
                href={href}
                className={`rail-nav-link ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={targetId ? (event) => navigateToHomeSection(event, targetId) : undefined}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>{label}</span>
              </Link>
            );
          })}
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
