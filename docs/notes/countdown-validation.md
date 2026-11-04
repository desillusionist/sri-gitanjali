# Slideshow countdown validation notes

## Desktop preview — 2026-08-22

The route `/song/bhajan-giti-042` was opened through Reading tools → Teleprompter → Slideshow. At speed 30, the first verse reported `≈ 28s · 28 syllables`, preserving the one-second-per-syllable baseline. Starting the slideshow collapsed the reading rail to one pause control with the saffron progress ring. Its accessible label changed from `Next in 28s` to `Next in 20s` after eight seconds, confirming that the displayed indicator is driven by the active slide interval.

The first verse advanced automatically to the second after the countdown completed. The full-screen lyric changed to verse 02 and the compact pause control immediately reported `Next in 24s`, confirming that the timer restarts for the new verse’s independently calculated syllable duration.

Pressing the compact pause control restored the expanded rail and removed the visible countdown. A manual Next verse action then moved the reader to verse 03 while the slideshow remained paused, confirming that manual navigation does not retain a stale active timer. A full-page desktop review also confirmed that the general song-page composition remains coherent after the functional change.
