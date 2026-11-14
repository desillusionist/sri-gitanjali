/** Reading files from the repository and writing many files back as one commit, with the admin's key. */
import { ADMIN_CONFIG, getToken } from "./session";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function github<T>(path: string, init: RequestInit = {}, accept = "application/vnd.github+json"): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new GitHubError(detail.message || `GitHub answered ${response.status}`, response.status);
  }
  return (accept.includes("raw") ? response.text() : response.json()) as Promise<T>;
}

const repoPath = (path: string) => `/repos/${ADMIN_CONFIG.repo}${path}`;

/** A file's current text on the branch, or null when it does not exist yet. */
export async function readRepoFile(path: string): Promise<string | null> {
  try {
    return await github<string>(repoPath(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ADMIN_CONFIG.branch}`), {}, "application/vnd.github.raw+json");
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export type RepoChange = { path: string; text: string } | { path: string; blob: Blob } | { path: string; remove: true };

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 0x8000)));
  return btoa(binary);
}

/**
 * Writes all changes as one commit on top of the branch's latest commit. Fails with status 409
 * when someone else committed in between; the caller then reads the files again and retries.
 */
export async function commitChanges(message: string, changes: RepoChange[]): Promise<string> {
  const ref = await github<{ object: { sha: string } }>(repoPath(`/git/ref/heads/${ADMIN_CONFIG.branch}`));
  const parent = await github<{ tree: { sha: string } }>(repoPath(`/git/commits/${ref.object.sha}`));
  const tree = await Promise.all(changes.map(async (change) => {
    if ("remove" in change) return { path: change.path, mode: "100644", type: "blob", sha: null };
    if ("text" in change) return { path: change.path, mode: "100644", type: "blob", content: change.text };
    const blob = await github<{ sha: string }>(repoPath("/git/blobs"), { method: "POST", body: JSON.stringify({ content: await blobToBase64(change.blob), encoding: "base64" }) });
    return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
  }));
  const newTree = await github<{ sha: string }>(repoPath("/git/trees"), { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
  const commit = await github<{ sha: string }>(repoPath("/git/commits"), { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
  try {
    await github(repoPath(`/git/refs/heads/${ADMIN_CONFIG.branch}`), { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) throw new GitHubError("Someone else saved changes at the same time.", 409);
    throw error;
  }
  return commit.sha;
}
