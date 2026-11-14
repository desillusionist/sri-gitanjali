/** Signing in to the admin tools with GitHub, and what they do. */

import { Github, LogOut } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { useTranslation } from "@/i18n/LanguageContext";
import { usePageMeta } from "@/lib/pageMeta";
import { canSignIn, getSignInError, signOut, startSignIn, useAdminSession } from "@/lib/admin/session";

function AdminContent() {
  const { copy } = useTranslation();
  const t = copy.admin;
  usePageMeta(t.pageTitle);
  const session = useAdminSession();
  const error = getSignInError();
  return (
    <div className="favorites-page admin-page">
      <header className="favorites-header">
        <span className="eyebrow">{t.admin}</span>
        <h1>{t.pageTitle}</h1>
        <p>{t.pageLede}</p>
      </header>
      {error && <p className="admin-pictures-note is-error" role="alert">{t.signInFailed} {error}</p>}
      {session?.canPush ? (
        <div className="admin-page-panel">
          <p>{t.signedInAs.replace("{login}", session.login ?? "")}</p>
          <ul>
            <li>{t.helpPictures}</li>
            <li>{t.helpNotes}</li>
            <li>{t.helpPublish}</li>
          </ul>
          <p><Link href="/vaisnavas">{t.goToVaisnavas}</Link></p>
          <button type="button" onClick={signOut}><LogOut size={15} aria-hidden="true" />{t.signOut}</button>
        </div>
      ) : session ? (
        <div className="admin-page-panel">
          <p>{session.canPush === false ? t.noAccess.replace("{login}", session.login ?? "") : t.checking}</p>
          <button type="button" onClick={signOut}><LogOut size={15} aria-hidden="true" />{t.signOut}</button>
        </div>
      ) : (
        <div className="admin-page-panel">
          {canSignIn() ? (
            <button type="button" className="is-primary" onClick={startSignIn}><Github size={16} aria-hidden="true" />{t.signIn}</button>
          ) : (
            <p>{t.notSetUp}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return <AppShell><AdminContent /></AppShell>;
}
