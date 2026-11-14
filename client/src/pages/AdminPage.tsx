/** Unlocking the admin tools with a GitHub key, and what they do. */

import { useState } from "react";
import { ExternalLink, KeyRound, LogOut } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { useTranslation } from "@/i18n/LanguageContext";
import { usePageMeta } from "@/lib/pageMeta";
import { ADMIN_CONFIG, signInWithToken, signOut, useAdminSession } from "@/lib/admin/session";

const [OWNER, REPO] = ADMIN_CONFIG.repo.split("/");
/** GitHub's form for a new fine-grained key, filled in as far as GitHub allows. */
const NEW_KEY_URL = `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({
  name: "Kirtan Guide admin",
  description: `Admin tools of the Kīrtan Guide: may change the contents of ${ADMIN_CONFIG.repo}`,
  target_name: OWNER,
  expires_in: "366",
  contents: "write",
}).toString()}`;

function AdminContent() {
  const { copy } = useTranslation();
  const t = copy.admin;
  usePageMeta(t.pageTitle);
  const session = useAdminSession();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    const result = await signInWithToken(key);
    setBusy(false);
    if (result === "ok") setKey("");
    else setProblem(result === "invalid" ? t.keyInvalid : result === "noAccess" ? t.keyNoAccess : t.keyNetwork);
  };

  return (
    <div className="favorites-page admin-page">
      <header className="favorites-header">
        <span className="eyebrow">{t.admin}</span>
        <h1>{t.pageTitle}</h1>
        <p>{t.pageLede}</p>
      </header>
      {session?.canPush ? (
        <div className="admin-page-panel">
          <p>{t.signedInAs.replace("{login}", session.login ?? "")}</p>
          <ul>
            <li>{t.helpPictures}</li>
            <li>{t.helpNotes}</li>
            <li>{t.helpPublish}</li>
          </ul>
          <p><Link href="/vaisnavas">{t.goToVaisnavas}</Link></p>
          <p><Link href="/notes">{t.goToNotesReview}</Link></p>
          <button type="button" onClick={signOut}><LogOut size={15} aria-hidden="true" />{t.signOut}</button>
        </div>
      ) : (
        <div className="admin-page-panel">
          <ol>
            <li>
              {t.keyStep1} <a href={NEW_KEY_URL} target="_blank" rel="noreferrer">{t.keyStep1Link}<ExternalLink size={12} aria-hidden="true" /></a>
            </li>
            <li>{t.keyStep2.replace("{repo}", REPO)}</li>
            <li>{t.keyStep3}</li>
            <li>{t.keyStep4}</li>
          </ol>
          <form className="admin-key-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label>
              {t.keyLabel}
              <input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="github_pat_…" />
            </label>
            <button type="submit" className="is-primary" disabled={busy || !key.trim()}><KeyRound size={15} aria-hidden="true" />{busy ? t.working : t.unlock}</button>
          </form>
          {problem && <p className="admin-pictures-note is-error" role="alert">{problem}</p>}
          <p className="admin-pictures-note">{t.keyPrivacy}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return <AppShell><AdminContent /></AppShell>;
}
