/** The admin's bar, shown only when signed in: unpublished changes, Publish, a new note, and signing out. */

import { useState } from "react";
import { CloudUpload, ExternalLink, LogOut, Plus, RotateCw, Undo2 } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { adoptFaceOverrides, discardDrafts, draftCount, getDrafts, useDrafts } from "@/lib/admin/drafts";
import { useDeployState } from "@/lib/admin/deploy";
import { publishDrafts } from "@/lib/admin/publish";
import { ADMIN_CONFIG, signOut, useAdminSession } from "@/lib/admin/session";
import { clearFaceOverrides, useFaceOverrides } from "@/lib/portraitCrops";
import { ChangesReview } from "./ChangesReview";
import { NoteEditor, openNoteEditor } from "./NoteEditor";

export function AdminBar() {
  const { copy } = useTranslation();
  const t = copy.admin;
  const session = useAdminSession();
  const drafts = useDrafts();
  const overrides = useFaceOverrides();
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const deploy = useDeployState();
  if (!session) return null;

  if (session.canPush !== true) {
    return (
      <div className="admin-bar is-limited" role="status">
        <span>{session.canPush === false ? t.noAccess.replace("{login}", session.login ?? "") : t.checking}</span>
        <button type="button" onClick={signOut}><LogOut size={15} aria-hidden="true" />{t.signOut}</button>
      </div>
    );
  }

  const pending = (drafts.dirty ? draftCount(drafts) : 0) + Object.keys(overrides).length;
  const waiting = !drafts.dirty && draftCount(drafts) > 0;

  const publish = async () => {
    setBusy(true);
    setStatus({ text: t.publishing });
    try {
      if (Object.keys(overrides).length) adoptFaceOverrides(overrides);
      await publishDrafts(getDrafts(), session.login);
      setStatus(null);
      setReviewing(false);
    } catch (error) {
      setStatus({ text: `${t.publishFailed} ${(error as Error).message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-bar" role="region" aria-label={t.barLabel}>
        <Link href="/admin" className="admin-bar-who" title={session.login}>
          {session.avatarUrl && <img src={session.avatarUrl} alt="" />}
          <span>{t.admin}</span>
        </Link>
        {pending > 0 && !busy && !status?.error ? (
          <button type="button" className="admin-bar-status is-link" onClick={() => setReviewing(true)} title={t.review}>{t.pending.replace("{count}", String(pending))}</button>
        ) : (
          <span className="admin-bar-status" role="status">{status?.text ?? (deploy === "live" ? t.live : deploy === "slow" ? t.deploySlow : deploy === "building" || waiting ? t.waiting : t.noPending)}</span>
        )}
        {!pending && !status && deploy === "live" && (
          <button type="button" onClick={() => window.location.reload()} title={t.reload} aria-label={t.reload}><RotateCw size={15} aria-hidden="true" /></button>
        )}
        {!pending && !status && deploy === "slow" && (
          <a className="admin-bar-link" href={`https://github.com/${ADMIN_CONFIG.repo}/actions`} target="_blank" rel="noreferrer" title={t.deployDetails} aria-label={t.deployDetails}><ExternalLink size={15} aria-hidden="true" /></a>
        )}
        <button type="button" onClick={() => openNoteEditor("")} title={t.newNote} aria-label={t.newNote}><Plus size={15} aria-hidden="true" /></button>
        {pending > 0 && (
          <>
            <button type="button" disabled={busy} title={t.discard} aria-label={t.discard} onClick={() => { if (window.confirm(t.discardConfirm)) { discardDrafts(); clearFaceOverrides(); setStatus(null); } }}><Undo2 size={15} aria-hidden="true" /></button>
            <button type="button" className="is-primary" disabled={busy} onClick={() => setReviewing(true)}><CloudUpload size={15} aria-hidden="true" />{t.publish}</button>
          </>
        )}
      </div>
      {reviewing && <ChangesReview busy={busy} status={status} onPublish={publish} onClose={() => setReviewing(false)} />}
      <NoteEditor />
    </>
  );
}
