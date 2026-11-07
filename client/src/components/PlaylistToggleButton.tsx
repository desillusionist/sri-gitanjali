import { usePlaylist } from "@/hooks/usePlaylist";
import { useTranslation } from "@/i18n/LanguageContext";
import { ListMusic, ListPlus } from "lucide-react";

/** Adds a recording to the playlist, or takes it out again. */
export function PlaylistToggleButton({ url, label }: { url: string; label: string }) {
  const { has, toggle } = usePlaylist();
  const { copy } = useTranslation();
  const inPlaylist = has(url);
  const action = (inPlaylist ? copy.playlist.removeTrack : copy.playlist.addTrack).replace("{track}", label);
  return (
    <button className={`playlist-toggle${inPlaylist ? " is-in-playlist" : ""}`} type="button" onClick={() => toggle(url)} aria-pressed={inPlaylist} aria-label={action} title={action}>
      {inPlaylist ? <ListMusic size={16} aria-hidden="true" /> : <ListPlus size={16} aria-hidden="true" />}
    </button>
  );
}
