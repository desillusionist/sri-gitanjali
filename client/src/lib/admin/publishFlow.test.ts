/**
 * The whole Publish path against a pretend GitHub: what the one commit carries (the authors file,
 * new pictures, a freshly cut circle, files let go) and the retry when someone else saved first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Drafts } from "./drafts";

const draftFiles = new Map<string, Blob>();
const markPublished = vi.fn();

vi.mock("./session", () => ({ ADMIN_CONFIG: { repo: "owner/repo", branch: "main" }, getToken: async () => "test-token" }));
vi.mock("./drafts", async (importOriginal) => ({ ...(await importOriginal<typeof import("./drafts")>()), getDraftFile: (name: string) => draftFiles.get(name), markPublished }));
vi.mock("./images", () => ({ prepareCircle: vi.fn(async () => ({ blob: new Blob(["circle"], { type: "image/webp" }), ext: "webp", width: 240, height: 240 })) }));

const { publishDrafts } = await import("./publish");
const { prepareCircle } = await import("./images");

type TreeItem = { path: string; sha?: string | null; content?: string };

/** A repository on the main branch: file texts, the head commit, and what was sent to it. */
function fakeGitHub(files: Record<string, string>) {
  const state = { head: "c0", files: { ...files }, blobs: 0, trees: [] as TreeItem[][], messages: [] as string[], refusePushes: 0, onRefuse: () => {} };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetchMock = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/repos/owner/repo", "");
    const method = init.method ?? "GET";
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    if (method === "GET" && path.startsWith("/contents/")) {
      const file = decodeURIComponent(path.slice("/contents/".length));
      return file in state.files ? new Response(state.files[file]) : json({ message: "Not Found" }, 404);
    }
    if (method === "GET" && path === "/git/ref/heads/main") return json({ object: { sha: state.head } });
    if (method === "GET" && path.startsWith("/git/commits/")) return json({ tree: { sha: `tree-${path.split("/").pop()}` } });
    if (method === "POST" && path === "/git/blobs") return json({ sha: `blob-${(state.blobs += 1)}` });
    if (method === "POST" && path === "/git/trees") {
      state.trees.push(JSON.parse(String(init.body)).tree);
      return json({ sha: `tree-new-${state.trees.length}` });
    }
    if (method === "POST" && path === "/git/commits") {
      state.messages.push(JSON.parse(String(init.body)).message);
      return json({ sha: `c${state.messages.length}` });
    }
    if (method === "PATCH" && path === "/git/refs/heads/main") {
      if (state.refusePushes > 0) {
        state.refusePushes -= 1;
        state.onRefuse();
        return json({ message: "Update is not a fast forward" }, 422);
      }
      state.head = JSON.parse(String(init.body)).sha;
      return json({});
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
  return { state, fetchMock };
}

const AUTHORS_PATH = "client/src/data/authors.json";
const EDITS_PATH = "client/src/data/holy-names-edits.json";
const authorsFile = (authors: object[]) => `${JSON.stringify({ _note: "kept", authors }, null, 2)}\n`;
const authorA = { id: "a", names: [], name: "A", dates: "d", place: "p", role: "r", portrait: "a.webp", portraitLarge: "a-large.webp", face: [50, 40, 30], circle: "circles/a@50_40_30.webp", summary: "s", bio: ["b"], sources: [] };

const drafts = (partial: Partial<Drafts>): Drafts => ({ authors: {}, notes: {}, localNotes: {}, removeFiles: [], dirty: true, ...partial });
const lastTree = (state: { trees: TreeItem[][] }) => state.trees[state.trees.length - 1];
const authorsIn = (tree: TreeItem[]) => JSON.parse(tree.find((item) => item.path === AUTHORS_PATH)!.content!).authors;

describe("publishing to a pretend GitHub", () => {
  beforeEach(() => {
    draftFiles.clear();
    markPublished.mockClear();
    vi.mocked(prepareCircle).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("writes a new main portrait, an added picture, new text and a new circle in one commit", async () => {
    const { state, fetchMock } = fakeGitHub({ [AUTHORS_PATH]: authorsFile([authorA, { id: "b", name: "B" }]) });
    vi.stubGlobal("fetch", fetchMock);
    for (const name of ["a2.webp", "a2-large.webp", "added.webp"]) draftFiles.set(name, new Blob([name], { type: "image/webp" }));

    const sha = await publishDrafts(drafts({
      authors: { a: { portrait: "a2.webp", portraitLarge: "a2-large.webp", gallery: [{ src: "a-large.webp" }, { src: "added.webp", caption: "New" }], name: "A, renamed", circle: authorA.circle } },
      removeFiles: ["a.webp"],
    }), "admin");

    expect(sha).toBe("c1");
    expect(state.head).toBe("c1");
    expect(markPublished).toHaveBeenCalledWith("c1");
    expect(state.messages[0]).toBe("Admin: 1 Vaiṣṇava page\n\nMade in the app's admin tools by admin.");

    const tree = lastTree(state);
    const [a, b] = authorsIn(tree);
    // The other author, and the changed author's other fields, are left as they were.
    expect(b).toEqual({ id: "b", name: "B" });
    expect(a).toMatchObject({ name: "A, renamed", summary: "s", bio: ["b"], portrait: "a2.webp", portraitLarge: "a2-large.webp", gallery: [{ src: "a-large.webp" }, { src: "added.webp", caption: "New" }] });
    // A new portrait without a face box gets the default circle, cut from its sharp copy.
    expect(a.face).toBeUndefined();
    expect(a.circle).toBe("circles/a2@50_55_100.webp");
    expect(vi.mocked(prepareCircle).mock.calls[0][0]).toBe(draftFiles.get("a2-large.webp"));

    const sent = (path: string) => tree.find((item) => item.path === path);
    for (const name of ["a2.webp", "a2-large.webp", "added.webp", "circles/a2@50_55_100.webp"]) expect(sent(`local-storage/${name}`)?.sha, name).toMatch(/^blob-/);
    // Let go: the old portrait and the old circle; kept: the old sharp copy, now in the slideshow.
    expect(sent("local-storage/a.webp")).toMatchObject({ sha: null });
    expect(sent("local-storage/circles/a@50_40_30.webp")).toMatchObject({ sha: null });
    expect(sent("local-storage/a-large.webp")).toBeUndefined();
    expect(sent(EDITS_PATH)).toBeUndefined();
  });

  it("only moves the circle when the face box changes", async () => {
    const { state, fetchMock } = fakeGitHub({ [AUTHORS_PATH]: authorsFile([authorA]) });
    vi.stubGlobal("fetch", fetchMock);
    await publishDrafts(drafts({ authors: { a: { portrait: "a.webp", portraitLarge: "a-large.webp", face: [52, 38, 28], circle: authorA.circle } } }));
    const tree = lastTree(state);
    expect(authorsIn(tree)[0]).toMatchObject({ face: [52, 38, 28], circle: "circles/a@52_38_28.webp" });
    // Read from the site, since the portrait itself is not new.
    expect(vi.mocked(prepareCircle).mock.calls[0][0]).toBe("/manus-storage/a-large.webp");
    expect(tree.map((item) => item.path).sort()).toEqual([AUTHORS_PATH, "local-storage/circles/a@50_40_30.webp", "local-storage/circles/a@52_38_28.webp"]);
  });

  it("lays note changes over the edits file, keeping the others", async () => {
    const { state, fetchMock } = fakeGitHub({ [EDITS_PATH]: JSON.stringify({ entries: { old: { about: "Old." } }, i18n: { ru: { old: { about: "Старое." } } } }) });
    vi.stubGlobal("fetch", fetchMock);
    await publishDrafts(drafts({ notes: { maya: { about: "Changed." } }, localNotes: { ru: { maya: { about: "Изменено." } } } }));
    const tree = lastTree(state);
    expect(tree.map((item) => item.path)).toEqual([EDITS_PATH]);
    expect(JSON.parse(tree[0].content!)).toEqual({ entries: { old: { about: "Old." }, maya: { about: "Changed." } }, i18n: { ru: { old: { about: "Старое." }, maya: { about: "Изменено." } } } });
    expect(state.messages[0]).toBe("Admin: 2 notes");
  });

  it("starts again from the newest files when someone else saved first", async () => {
    const { state, fetchMock } = fakeGitHub({ [AUTHORS_PATH]: authorsFile([authorA]) });
    vi.stubGlobal("fetch", fetchMock);
    state.refusePushes = 1;
    state.onRefuse = () => {
      state.files[AUTHORS_PATH] = authorsFile([authorA, { id: "c", name: "Added elsewhere" }]);
      state.head = "c-elsewhere";
    };
    const sha = await publishDrafts(drafts({ authors: { a: { portrait: "a.webp", portraitLarge: "a-large.webp", face: authorA.face as [number, number, number], circle: authorA.circle, role: "New role" } } }));
    expect(state.trees).toHaveLength(2);
    expect(sha).toBe("c2");
    expect(state.head).toBe("c2");
    const authors = authorsIn(lastTree(state));
    expect(authors.map((author: { id: string }) => author.id)).toEqual(["a", "c"]);
    expect(authors[0].role).toBe("New role");
    expect(markPublished).toHaveBeenCalledTimes(1);
  });

  it("gives up after three refusals and publishes nothing", async () => {
    const { state, fetchMock } = fakeGitHub({ [AUTHORS_PATH]: authorsFile([authorA]) });
    vi.stubGlobal("fetch", fetchMock);
    state.refusePushes = 5;
    await expect(publishDrafts(drafts({ authors: { a: { ...authorA, face: authorA.face as [number, number, number], role: "x" } } }))).rejects.toThrow("Someone else saved changes at the same time.");
    expect(state.head).toBe("c0");
    expect(markPublished).not.toHaveBeenCalled();
  });
});
