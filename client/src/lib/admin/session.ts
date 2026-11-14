/**
 * The admin's GitHub key. The admin creates a fine-grained personal access token on GitHub that may
 * only change this repository's contents, and pastes it once on the Admin page; it is kept in this
 * browser and lets the admin tools write to the repository. Only a key that can write to the
 * repository opens the tools: GitHub is asked each time the app starts.
 */
import { useSyncExternalStore } from "react";
import config from "@/data/admin.json";

export const ADMIN_CONFIG = config as { repo: string; branch: string };

export type AdminSession = {
  token: string;
  login?: string;
  avatarUrl?: string;
  /** Whether this key may write to the repository. */
  canPush?: boolean;
};

const STORAGE_KEY = "kirtan-guide:admin-session";
const listeners = new Set<() => void>();

function load(): AdminSession | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return stored?.token ? { token: stored.token, login: stored.login, avatarUrl: stored.avatarUrl, canPush: stored.canPush } : null;
  } catch {
    return null;
  }
}

let session: AdminSession | null = typeof window === "undefined" ? null : load();

function update(next: AdminSession | null) {
  session = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the key lasts until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminSession(): AdminSession | null {
  return useSyncExternalStore(subscribe, () => session, () => null);
}

/** True when the saved key may write to the repository: the admin tools show. */
export function useIsAdmin(): boolean {
  return useAdminSession()?.canPush === true;
}

export async function getToken(): Promise<string> {
  if (!session) throw new Error("Not signed in.");
  return session.token;
}

type Check = { ok: true; login: string; avatarUrl?: string; canPush: boolean } | { ok: false; reason: "invalid" | "network" };

async function check(token: string): Promise<Check> {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  try {
    const user = await fetch("https://api.github.com/user", { headers });
    if (user.status === 401) return { ok: false, reason: "invalid" };
    if (!user.ok) return { ok: false, reason: "network" };
    const { login, avatar_url: avatarUrl } = await user.json();
    const repo = await fetch(`https://api.github.com/repos/${ADMIN_CONFIG.repo}`, { headers });
    const permissions = repo.ok ? (await repo.json()).permissions : null;
    return { ok: true, login, avatarUrl, canPush: permissions?.push === true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Saves a pasted key once GitHub accepts it. Returns why not, if it does not open the tools. */
export async function signInWithToken(token: string): Promise<"ok" | "invalid" | "noAccess" | "network"> {
  const trimmed = token.trim();
  if (!trimmed) return "invalid";
  const result = await check(trimmed);
  if (!result.ok) return result.reason;
  if (!result.canPush) return "noAccess";
  update({ token: trimmed, login: result.login, avatarUrl: result.avatarUrl, canPush: true });
  return "ok";
}

export function signOut() {
  update(null);
}

/** Asks GitHub again whether the saved key still works and may write; forgets it when GitHub rejects it. */
export async function verifySession(): Promise<void> {
  if (!session) return;
  const result = await check(session.token);
  if (!result.ok) {
    if (result.reason === "invalid") update(null);
    return;
  }
  update({ ...session, login: result.login, avatarUrl: result.avatarUrl, canPush: result.canPush });
}

// Local development only (left out of the published site): lets the admin screens be tried without GitHub.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __kirtanAdminPreview?: (login: string) => void }).__kirtanAdminPreview = (login) => update({ token: "preview", login, canPush: true });
}
