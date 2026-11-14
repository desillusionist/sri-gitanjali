/** Publishing the admin's changes: one commit to the repository, after which the site rebuilds itself. */
import type { HolyNameEdits } from "@/lib/holyNames";
import { CIRCLE_SIZE, circleStem, DEFAULT_FACE } from "@/lib/authors";
import { STORAGE_URL } from "@/data/sources";
import { commitChanges, GitHubError, readRepoFile, type RepoChange } from "./github";
import { draftCount, getDraftFile, isTextField, markPublished, PICTURE_FIELDS, type AuthorPictures, type Drafts } from "./drafts";
import { prepareCircle } from "./images";

export const AUTHORS_PATH = "client/src/data/authors.json";
export const EDITS_PATH = "client/src/data/holy-names-edits.json";
const STORAGE_DIR = "local-storage/";

type AuthorsFile = { authors: (Record<string, unknown> & { id: string })[] };

/** The authors file with the picture changes applied, keeping each author's other fields and their order. */
export function applyAuthorPictures(file: AuthorsFile, changes: Record<string, AuthorPictures>): AuthorsFile {
  return {
    ...file,
    authors: file.authors.map((author) => {
      const pictures = changes[author.id];
      if (!pictures) return author;
      const next: Record<string, unknown> & { id: string } = { ...author };
      for (const field of PICTURE_FIELDS) {
        if (pictures[field] === undefined) { if (!isTextField(field)) delete next[field]; }
        else next[field] = pictures[field];
      }
      return next;
    }),
  };
}

export function applyNoteEdits(file: HolyNameEdits & Record<string, unknown>, drafts: Pick<Drafts, "notes" | "localNotes">): HolyNameEdits & Record<string, unknown> {
  const i18n = { ...file.i18n };
  for (const [language, edits] of Object.entries(drafts.localNotes)) i18n[language] = { ...i18n[language], ...edits };
  return { ...file, entries: { ...file.entries, ...drafts.notes }, i18n };
}

/** Every picture file the authors file uses. */
export function usedFiles(file: AuthorsFile): Set<string> {
  const used = new Set<string>();
  for (const author of file.authors) {
    for (const key of ["portrait", "portraitLarge", "circle"]) if (typeof author[key] === "string") used.add(author[key] as string);
    for (const image of (author.gallery as { src: string }[] | undefined) ?? []) used.add(image.src);
  }
  return used;
}

const indentOf = (text: string) => text.match(/^\{\n( +)/)?.[1].length ?? 2;

function describe(drafts: Drafts): string {
  const parts = [];
  const authors = Object.keys(drafts.authors).length;
  const notes = draftCount({ ...drafts, authors: {} });
  if (authors) parts.push(`${authors} Vaiṣṇava page${authors === 1 ? "" : "s"}`);
  if (notes) parts.push(`${notes} note${notes === 1 ? "" : "s"}`);
  return `Admin: ${parts.join(" and ") || "changes"}`;
}

/**
 * Cuts a new circle picture for each changed author whose circle no longer matches their portrait
 * and face box. Returns the changes with the new circle names, and the new files.
 */
export async function cutCircles(authors: Record<string, AuthorPictures>): Promise<{ authors: Record<string, AuthorPictures>; files: Map<string, Blob> }> {
  const out: Record<string, AuthorPictures> = {};
  const files = new Map<string, Blob>();
  for (const [id, pictures] of Object.entries(authors)) {
    const next = { ...pictures };
    if (!next.portrait) delete next.circle;
    else {
      const stem = circleStem(next.portrait, next.face ?? DEFAULT_FACE);
      if (next.circle?.replace(/\.\w+$/, "") !== stem) {
        const sourceFile = next.portraitLarge ?? next.portrait;
        const image = await prepareCircle(getDraftFile(sourceFile) ?? STORAGE_URL + sourceFile, next.face ?? DEFAULT_FACE, CIRCLE_SIZE);
        next.circle = `${stem}.${image.ext}`;
        files.set(next.circle, image.blob);
      }
    }
    out[id] = next;
  }
  return { authors: out, files };
}

/** Writes all drafts in one commit; tries again when someone else saved at the same moment. */
export async function publishDrafts(drafts: Drafts, login?: string): Promise<string> {
  const circles = await cutCircles(drafts.authors);
  for (let attempt = 0; ; attempt += 1) {
    try {
      const changes: RepoChange[] = [];
      if (Object.keys(drafts.authors).length || drafts.removeFiles.length) {
        const text = await readRepoFile(AUTHORS_PATH);
        if (!text) throw new Error("The authors file is missing from the repository.");
        const before: AuthorsFile = JSON.parse(text);
        const file = applyAuthorPictures(before, circles.authors);
        changes.push({ path: AUTHORS_PATH, text: `${JSON.stringify(file, null, indentOf(text))}\n` });
        const used = usedFiles(file);
        for (const name of Array.from(used)) {
          const blob = getDraftFile(name) ?? circles.files.get(name);
          if (blob) changes.push({ path: STORAGE_DIR + name, blob });
        }
        // Files no longer used: those the admin let go, and circles cut for an earlier portrait or face box.
        const formerCircles = before.authors.filter((author) => circles.authors[author.id]).map((author) => author.circle as string | undefined);
        for (const name of Array.from(new Set([...drafts.removeFiles, ...formerCircles]))) if (name && !used.has(name)) changes.push({ path: STORAGE_DIR + name, remove: true });
      }
      if (Object.keys(drafts.notes).length || Object.keys(drafts.localNotes).length) {
        const text = await readRepoFile(EDITS_PATH);
        const file = text ? JSON.parse(text) : { entries: {}, i18n: {} };
        changes.push({ path: EDITS_PATH, text: `${JSON.stringify(applyNoteEdits(file, drafts), null, 2)}\n` });
      }
      if (!changes.length) return "";
      const sha = await commitChanges(`${describe(drafts)}${login ? `\n\nMade in the app's admin tools by ${login}.` : ""}`, changes);
      markPublished(sha);
      return sha;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 409 && attempt < 2) continue;
      throw error;
    }
  }
}
