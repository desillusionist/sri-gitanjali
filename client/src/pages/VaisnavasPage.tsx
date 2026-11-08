/** The Vaiṣṇavas named in the guide: its poets and the personalities its songs honour, grouped by era. */

import { AppShell } from "@/components/AppShell";
import { AuthorPortrait } from "@/components/AuthorPortrait";
import { useTranslation } from "@/i18n/LanguageContext";
import { AUTHORS, authorHref, VAISNAVA_GROUPS } from "@/lib/authors";
import { ChevronRight, Users } from "lucide-react";
import { Link } from "wouter";

function VaisnavasContent() {
  const { copy } = useTranslation();
  return (
    <div className="favorites-page vaisnavas-page">
      <header className="favorites-header">
        <span className="eyebrow">{copy.vaisnavas.eyebrow}</span>
        <h1>{copy.vaisnavas.title}<br /><em>{copy.vaisnavas.titleEmphasis}</em></h1>
        <p>{copy.vaisnavas.lede}</p>
        <div className="favorites-count">
          <Users size={18} aria-hidden="true" />
          <strong>{AUTHORS.length}</strong>
          <span>{copy.vaisnavas.count}</span>
        </div>
      </header>
      {VAISNAVA_GROUPS.map((group) => {
        const people = AUTHORS.filter((author) => author.group === group);
        if (!people.length) return null;
        return (
          <section className="vaisnava-group" key={group} aria-labelledby={`vaisnava-group-${group}`}>
            <h2 id={`vaisnava-group-${group}`} className="eyebrow">{copy.vaisnavas.groups[group]}</h2>
            <ul className="vaisnava-list">
              {people.map((person) => (
                <li key={person.id}>
                  <Link href={authorHref(person)} className="vaisnava-row">
                    <AuthorPortrait author={person} />
                    <span className="vaisnava-row-text">
                      <strong>{person.name}</strong>
                      <small>{person.role} · {person.dates}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function VaisnavasPage() {
  return <AppShell><VaisnavasContent /></AppShell>;
}
