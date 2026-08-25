/**
 * Паломнический свиток: источник данных остаётся локальным и прозрачным;
 * JSON даёт быстрый старт, CSV сохраняет проверяемый путь импорта.
 */

import type { Song } from "@/domain/song";
import { parseSongsFromCsv, parseSongsJson } from "./songParser";
import { SONGS_CSV_URL, SONGS_JSON_URL } from "./sources";
import { soundCloudRecordingOverlay } from "./soundcloudRecordings";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load content source (${response.status}).`);
  return response.text();
}

function applySoundCloudRecordingOverlay(songs: Song[]): Song[] {
  return songs.map((song) => {
    const overlayLinks = soundCloudRecordingOverlay[song.id] ?? [];
    const audioLinks = Array.from(new Set([...overlayLinks, ...(song.audioLinks ?? []), ...(song.audioLink ? [song.audioLink] : [])]));
    return audioLinks.length ? { ...song, audioLinks } : song;
  });
}

export async function loadSongs(): Promise<{ songs: Song[]; source: "json" | "csv" }> {
  try {
    return { songs: applySoundCloudRecordingOverlay(parseSongsJson(await fetchText(SONGS_JSON_URL))), source: "json" };
  } catch {
    const csv = await fetchText(SONGS_CSV_URL);
    return { songs: applySoundCloudRecordingOverlay(parseSongsFromCsv(csv)), source: "csv" };
  }
}
