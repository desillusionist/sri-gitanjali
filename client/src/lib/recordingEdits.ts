/**
 * Recordings changed in the admin tools, laid over the hand-made lists in soundcloudRecordings.ts:
 * the published ones (recording-edits.json) and, on the admin's device, the unpublished ones.
 */
import { useSyncExternalStore } from "react";
import published from "@/data/recording-edits.json";

export type RecordingTrack = { singer?: string; seconds?: number };
export type RecordingEdits = {
  /** A song's full list of recordings, by song id. */
  songs: Record<string, string[]>;
  /** Per track path ("/account/track"): who sings it, and its length. */
  tracks: Record<string, RecordingTrack>;
  /** Singers added in the admin tools: id → name. */
  singers: Record<string, string>;
};

export const EMPTY_RECORDING_EDITS: RecordingEdits = { songs: {}, tracks: {}, singers: {} };

function normalize(value: unknown): RecordingEdits {
  const file = (value ?? {}) as Partial<RecordingEdits>;
  return { songs: { ...file.songs }, tracks: { ...file.tracks }, singers: { ...file.singers } };
}

export const PUBLISHED_RECORDING_EDITS = normalize(published);

/** Both layers together: this device's unpublished changes win. */
export function mergeRecordingEdits(base: RecordingEdits, over: RecordingEdits): RecordingEdits {
  const tracks = { ...base.tracks };
  for (const [path, track] of Object.entries(over.tracks)) tracks[path] = { ...tracks[path], ...track };
  return { songs: { ...base.songs, ...over.songs }, tracks, singers: { ...base.singers, ...over.singers } };
}

let current = PUBLISHED_RECORDING_EDITS;
const listeners = new Set<() => void>();

/** Lays this device's unpublished changes (from the admin drafts) over the published ones. */
export function setDraftRecordingEdits(draft: RecordingEdits | undefined) {
  current = draft ? mergeRecordingEdits(PUBLISHED_RECORDING_EDITS, normalize(draft)) : PUBLISHED_RECORDING_EDITS;
  listeners.forEach((listener) => listener());
}

export function recordingEdits(): RecordingEdits {
  return current;
}

/** The recording edits in force; components using it render again when the admin changes them. */
export function useRecordingEdits(): RecordingEdits {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => current, () => PUBLISHED_RECORDING_EDITS);
}

/** "/account/track" for a soundcloud.com address, the key of `tracks`. */
export function soundCloudTrackPath(url: string): string | null {
  try {
    const [, account, track] = new URL(url).pathname.split("/");
    return account && track ? `/${account}/${track}` : null;
  } catch {
    return null;
  }
}
