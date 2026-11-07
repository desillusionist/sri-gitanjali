import { usePlaylist } from "@/hooks/usePlaylist";
import { ListMusic, ListPlus } from "lucide-react";

/**
 * Adds recordings to the playlist, or takes them out again: one recording on a song page,
 * or all of a song's recordings in the library.
 */
export function PlaylistToggleButton({ urls, addLabel, removeLabel, className = "" }: { urls: string[]; addLabel: string; removeLabel: string; className?: string }) {
  const { tracks, addMany, removeMany } = usePlaylist();
  const inPlaylist = urls.length > 0 && urls.every((url) => tracks.includes(url));
  const action = inPlaylist ? removeLabel : addLabel;
  return (
    <button
      className={`playlist-toggle${inPlaylist ? " is-in-playlist" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      onClick={() => (inPlaylist ? removeMany(urls) : addMany(urls))}
      aria-pressed={inPlaylist}
      aria-label={action}
      title={action}
    >
      {inPlaylist ? <ListMusic size={16} aria-hidden="true" /> : <ListPlus size={16} aria-hidden="true" />}
    </button>
  );
}
