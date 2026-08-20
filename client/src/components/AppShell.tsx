/**
 * Паломнический свиток: светлая редакционная среда чтения, шафрановые акценты,
 * асимметричная reading rail и спокойные материальные поверхности.
 */

import { brandAssets } from "@/data/sources";
import { BookOpenText, LibraryBig, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

const rails = [
  { href: "/", label: "Библиотека", icon: LibraryBig },
  { href: "/#search", label: "Поиск", icon: Search },
];

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();

  return (
    <div className="app-shell">
      <aside className="reading-rail" aria-label="Основная навигация">
        <Link href="/" className="brand-lockup" aria-label="Kīrtan Guide — библиотека">
          <img className="brand-mark" src={brandAssets.mark} alt="" />
          <span className="brand-name">Kīrtan<br />Guide</span>
        </Link>

        <nav className="rail-nav">
          {rails.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith("/search");
            return (
              <Link
                key={href}
                href={href}
                className={`rail-nav-link ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
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
          <p>Песни — рядом, даже когда вы далеко от бумажного сборника.</p>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
