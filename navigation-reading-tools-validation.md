# Navigation and Reading Tools Validation

- The controlled brand menu closed after the in-page **Search** destination, after **Library**, and after navigating to **Favorites**.
- The Favorites navigation completed on `/favorites` with the brand menu absent from the visible interactive elements.
- On `/song/bhajan-giti-042`, the Reading Tools trigger is rendered inside the song article as `#song-reading-tools-trigger`.
- Opening the trigger exposed text-size, line-spacing, ornaments, translations, teleprompter, favorites, copy, and in-song search controls, confirming that the panel retained its existing functional scope.

After raising the trigger above the panel stack, the same sticky control opened and closed the reader panel correctly while the article was scrolled. On `/song/sri-gaura-arati-049`, a line containing ā̐ computed to the intended `"Charis SIL", Georgia, serif` stack at weight `400` with `font-synthesis: none`; the browser reported the font as available for the compound glyph.
