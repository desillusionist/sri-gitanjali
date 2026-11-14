/**
 * The admin's GitHub sign-in. The sign-in service (workers/github-auth) sends the browser to GitHub
 * and back with a key in the address's #fragment; the key is kept in this browser and lets the
 * admin tools write to the repository. Only people who can write to the repository on GitHub get
 * the tools: the key's rights are checked with GitHub after each sign-in.
 */
import { useSyncExternalStore } from "react";
import config from "@/data/admin.json";

export const ADMIN_CONFIG = config as { authUrl: string; repo: string; branch: string };

export type AdminSession = {
  token: string;
  refreshToken?: string;
  /** When the key stops working, in ms since 1970. */
  expiresAt?: number;
  login?: string;
  avatarUrl?: string;
  /** Whether this GitHub account may write to the repository. */
  canPush?: boolean;
};

const STORAGE_KEY = "kirtan-guide:admin-session";
const listeners = new Set<() => void>();

function load(): AdminSession | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return stored?.token ? stored : null;
  } catch {
    return null;
  }
}

let session: AdminSession | null = typeof window === "undefined" ? null : load();
let signInError: string | null = null;

function update(next: AdminSession | null) {
  session = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session lasts until the page is closed.
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

/** True when a signed-in GitHub account may write to the repository: the admin tools show. */
export function useIsAdmin(): boolean {
  return useAdminSession()?.canPush === true;
}

export function getSignInError() {
  return signInError;
}

export const canSignIn = () => Boolean(ADMIN_CONFIG.authUrl);

/** Goes to GitHub to sign in, coming back to this page. */
export function startSignIn() {
  const back = window.location.href.split("#")[0];
  window.location.assign(`${ADMIN_CONFIG.authUrl.replace(/\/$/, "")}/login?return=${encodeURIComponent(back)}`);
}

export function signOut() {
  update(null);
}

/** Picks up the key the sign-in service left in the address, and removes it from there at once. */
export function consumeSignInRedirect() {
  if (typeof window === "undefined" || !/[#&](admin_token|admin_error)=/.test(window.location.hash)) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const error = params.get("admin_error");
  if (error) {
    signInError = error;
    listeners.forEach((listener) => listener());
    return;
  }
  const expiresIn = Number(params.get("expires_in"));
  update({
    token: params.get("admin_token")!,
    refreshToken: params.get("refresh_token") || undefined,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  });
  void verifySession();
}

/** A working key, renewed first when it is about to expire. */
export async function getToken(): Promise<string> {
  if (!session) throw new Error("Not signed in.");
  if (session.expiresAt && session.expiresAt - 60_000 < Date.now() && session.refreshToken) {
    const response = await fetch(`${ADMIN_CONFIG.authUrl.replace(/\/$/, "")}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) {
      update(null);
      throw new Error("The sign-in has expired. Please sign in again.");
    }
    update({ ...session, token: result.access_token, refreshToken: result.refresh_token || session.refreshToken, expiresAt: result.expires_in ? Date.now() + result.expires_in * 1000 : undefined });
  }
  return session!.token;
}

/** Asks GitHub who is signed in and whether they may write to the repository. */
export async function verifySession(): Promise<void> {
  if (!session) return;
  try {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const [user, repo] = await Promise.all([
      fetch("https://api.github.com/user", { headers }).then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status))))),
      fetch(`https://api.github.com/repos/${ADMIN_CONFIG.repo}`, { headers }).then((response) => (response.ok ? response.json() : null)),
    ]);
    update({ ...session!, login: user.login, avatarUrl: user.avatar_url, canPush: repo?.permissions?.push === true });
  } catch (error) {
    if ((error as Error).message === "401") update(null);
  }
}

// Local development only (left out of the published site): lets the admin screens be tried without GitHub.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __kirtanAdminPreview?: (login: string) => void }).__kirtanAdminPreview = (login) => update({ token: "preview", login, canPush: true });
}
