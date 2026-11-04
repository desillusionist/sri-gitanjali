# SoundCloud smart-matching validation

The supplied list contained 126 SoundCloud links. Deterministic title/opening-line scoring produced 78 high-confidence matches; additional clearly identifiable candidates were manually reviewed against the catalogue’s title and opening text. The deployed local overlay now exposes 109 songs with at least one valid recording while leaving low-confidence and unresolved links unassigned.

The Hare Krishna Mahāmantra page (`/song/hare-krishna-mahamantra-026`) exposes seven labelled recording versions. Selecting **Recording 6** and opening the player produced a valid SoundCloud iframe URL at `https://w.soundcloud.com/player/?visual=false&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F34378124…`, confirming that the selector resets and loads the currently chosen source.

The catalogue’s **With recordings** filter returned 109 songs after the expanded overlay was loaded. The filter state, matching count, and the song list all updated together.
