# PWA update checklist

- [x] Add a typed English-default localization dictionary with future language registration.
- [x] Replace visible Russian interface copy across navigation, library, detail, and state screens.
- [x] Add a favorites store backed by localStorage and accessible throughout the app.
- [x] Add a dedicated Favorites route and navigation entry.
- [x] Connect favorite/unfavorite actions on song detail and cards, then verify persistence.
- [x] Run TypeScript/build checks, visually verify key routes, and save a checkpoint.

## Search and filters

- [x] Audit existing song fields and derive normalized filter options.
- [x] Add a reusable text-search and combined-filter model for title, verse text, author, and category.
- [x] Add author and category controls, active-filter feedback, and a clear-all action.
- [x] Verify empty, single-filter, and combined-filter states; run build checks and save a checkpoint.

## Search excerpts and highlights

- [x] Audit result-row rendering and define matching priorities for title, author, lines, and translations.
- [x] Add diacritic-insensitive match ranges and contextual excerpt generation.
- [x] Render highlighted query fragments in live-search result rows without changing the empty-filter view.
- [x] Verify word and phrase matches on real songs, then run build checks and save a checkpoint.

## In-song search navigation

- [x] Audit song routes and define a URL-safe query handoff from live-search results.
- [x] Add a full-song match model that identifies each matching title, author, line, translation, or comment fragment.
- [x] Add the compact in-song search bar, active-match highlight, and previous/next controls with scroll behavior.
- [x] Verify routed phrase search and multi-match navigation on real songs, then run build checks and save a checkpoint.

## Scroll persistence and library flow

- [x] Make the global application header and all navigation controls persist at the top of the viewport while scrolling.
- [x] Keep the active in-song search panel reachable below the fixed header on desktop and mobile.
- [x] Move the home-page statistics block below the search results, then verify its position in filtered and unfiltered states.
- [x] Verify desktop and mobile scrolling behavior, run build checks, and save a checkpoint.

## Recent search history

- [x] Define a resilient localStorage model for a small, deduplicated list of recent text queries.
- [x] Save meaningful global-search queries without recording blank values or filter-only states.
- [x] Show recent queries on focus, support applying an item, and provide an accessible clear-history action.
- [x] Verify persistence after reload, query reuse, clearing history, and responsive presentation; then save a checkpoint.

## In-song search stickiness fix

- [x] Identify why the in-song search panel leaves the viewport during long-page scrolling.
- [x] Make the panel persist below the global navigation without clipping or overlapping song content on desktop and mobile.
- [x] Verify actual scroll behavior on a long song, run build checks, and save a checkpoint.

## Collapsible verse translations

- [x] Define clear, accessible states for the global translation switch and independent verse overrides.
- [x] Add a global show/hide control and per-verse disclosure controls without changing the transliterated source text.
- [x] Ensure combined global and individual actions remain predictable on desktop and mobile.
- [x] Verify keyboard access, different states, build checks, and save a checkpoint.

## Minimal verse translation control

- [x] Replace the text-only per-verse translation action with an interactive verse-number marker and compact disclosure cue.
- [x] Use an inverted marker state to communicate that the corresponding translation is open, while preserving an accessible name.
- [x] Verify independent and global translation states, mobile layout, build checks, and save a checkpoint.

## Contextual library navigation

- [x] Make the Library and Search navigation items route to the home page and scroll to their respective library and search anchors.
- [x] Add an accessible per-song badge that reports the total number of text matches in global search results.
- [x] Link song authors and categories to the home page with the corresponding author or category filter preselected.
- [x] Verify anchored navigation, filter links, match badges, desktop/mobile presentation, build checks, and save a checkpoint.

## Teleprompter mode

- [x] Design an accessible reading-mode toggle and play/pause control for automatic song scrolling.
- [x] Implement automatic scrolling with adjustable speed and safe cancellation on user interaction or page exit.
- [x] Preserve the reading context and make controls usable on desktop and mobile.
- [x] Verify start, pause, speed adjustment, manual interruption, TypeScript, production build, and responsive presentation before saving a checkpoint.

## Home navigation and song index

- [x] Keep Library and Search neutral on the home page until the visitor intentionally selects one of those section links.
- [x] Make the song-count marker of each Library category open its complete category listing with a clear return path.
- [x] Add a Library / Index A–Z view switch on the home page.
- [x] Build a complete alphabetical index of songs ordered by each song’s first transliterated verse line, with readable letter groups.
- [x] Verify navigation states, category expansion, the two library views, desktop/mobile layout, type checks, and production build before saving a checkpoint.

## Index navigation and library card readability

- [x] Add a complete alphabet strip that jumps to each available letter group in Index A–Z.
- [x] Move each alphabet letter and its song count above its song group to eliminate the mobile left gutter.
- [x] Put the opening transliterated verse line on its own line in Library cards, distinct from title and author metadata.
- [x] Verify alphabetical jumps, mobile text wrapping, desktop composition, types, and production build before saving a checkpoint.

## Teleprompter repair and distraction-free view

- [x] Identify and fix the failed automatic-scroll start behavior.
- [x] Render teleprompter as a clean dedicated reading view containing only large transliterated shlokas.
- [x] Exclude translations and ordinary song-page chrome from the teleprompter reading surface.
- [x] Verify play, pause, speed control, end-of-song behavior, desktop/mobile presentation, types, and production build before saving a checkpoint.

## Route-position and autoscroll regression fix

- [x] Identify why a library-to-song transition restores the browser at the end of a song instead of the opening.
- [x] Ensure a normal song transition resets both document and reading-container positions to the top, while preserving intentional in-song match navigation.
- [x] Identify the actual scrollable teleprompter element and drive it reliably with animation frames.
- [x] Verify first-open position, text movement after play, pause on interaction, speed adjustment, mobile behavior, types, and production build before saving a checkpoint.

## Secondary song ornaments

- [x] Add a clear song-page reading preference to hide text enclosed in round brackets within transliterated shlokas.
- [x] Preserve the unmodified source text for translations, search, copy, and teleprompter mode.
- [x] Ensure parenthetical fragments are removed cleanly without leaving doubled whitespace or punctuation artefacts.
- [x] Verify the toggle on representative songs, desktop/mobile layout, types, and production build before saving a checkpoint.

## Reading typography controls

- [x] Define accessible size and line-height presets for transliterated shlokas.
- [x] Add compact song-page controls that change the regular reading view without affecting translations or page chrome.
- [x] Apply the selected typography to the dedicated teleprompter reading surface.
- [x] Verify keyboard access, desktop/mobile presentation, TypeScript, and production build before saving a checkpoint.

## Reading-control refinement

- [x] Remove the unintended repeated saffron rule from the song-page visual system while retaining purposeful navigation marks.
- [x] Replace typography sliders with compact, labelled graphical increment/decrement controls for text size and line spacing.
- [x] Carry the active text-size, line-spacing, and secondary-ornament preferences into teleprompter rendering.
- [x] Verify ordinary reading and teleprompter behavior on desktop/mobile, keyboard access, types, and production build before saving a checkpoint.

## Brand mark, diacritics, and reading toggles

- [x] Remove the saffron rule that overlaps the Kīrtan Guide logo mark.
- [x] Adopt a visually compatible serif typeface that renders `ā̐` and related combining diacritics reliably in shlokas.
- [x] Replace the two reading switches with compact, accessible icon controls and small on-demand explanations.
- [x] Verify the logo, diacritic rendering, toggle state, hints, keyboard access, desktop/mobile layout, types, and production build before saving a checkpoint.

## Collapsible reading panel and saved preferences

- [x] Remove the visible “Reading comfort” label and provide an accessible text description for every reading and navigation control.
- [x] Merge typography, visibility controls, and the in-song search input into one mobile-friendly reading panel.
- [x] Make the combined panel remain reachable at the top while sliding in from the right on demand and closing on a repeat action or loss of focus.
- [x] Reduce the teleprompter trigger to an icon while preserving descriptive accessible text for every control in the panel.
- [x] Persist typography, translation, ornament, and relevant reader-panel preferences in localStorage and restore them after reload.
- [x] Verify desktop/mobile layouts, open/close behavior, keyboard access, persistence, TypeScript, and production build before saving a checkpoint.

## Navigation consolidation, layering, and teleprompter slides

- [x] Move global Favorites into the logo menu, leaving only the song-reading tools trigger in global navigation on song pages.
- [x] Fix stacking contexts so dropdown menus and all tooltips appear above the sticky global navigation and remain readable and clickable.
- [x] Place the verse-count metadata below the song-header divider rather than alongside author metadata.
- [x] Arrange the reader-panel controls in the requested single-row sequence with spacers and visual dividers.
- [x] Add a teleprompter slideshow view in addition to the existing automatic-scroll reading mode.
- [x] Verify menus, overlays, tooltips, teleprompter modes, desktop/mobile behavior, TypeScript, and production build before saving a checkpoint.

## Desktop trigger and timed slideshow

- [x] Show the global Reading Tools trigger as a labelled desktop button while retaining the compact icon treatment on mobile.
- [x] Preserve play/pause and a speed control in slideshow view; make speed determine the automatic interval between verses instead of scroll velocity.
- [x] Verify desktop and mobile trigger presentation, timed scroll/slideshow playback, pausing, speed changes, TypeScript, and production build before saving a checkpoint.

## Compact teleprompter control rail

- [x] Recompose the Auto-scroll and Slideshow controls into a compact shared control rail with a clear visual hierarchy.
- [x] Consolidate mode selection, tempo, verse progress, direct navigation, and play/pause so each mode only shows its relevant controls.
- [x] Preserve all existing teleprompter logic, keyboard accessibility, and Pilgrim Scroll visual language while reducing unused space.
- [x] Verify desktop/mobile layouts, both modes, play/pause, speed changes, verse navigation, TypeScript, and production build before saving a checkpoint.

## Teleprompter tempo and collapsed playback controls

- [x] Allow Auto-scroll to start at 1 px/s while preserving clear, usable speed adjustments.
- [x] Calculate the default Slideshow pacing from the active verse’s syllable count, using one second per syllable as the reference.
- [x] Collapse the teleprompter control rail to a single accessible play/pause control while playback is active, with a way to restore the full rail.
- [x] Verify both modes, pace changes, timed verse transitions, collapsed/expanded controls, desktop/mobile behavior, TypeScript, and production build before saving a checkpoint.

## Slideshow countdown indicator

- [x] Add a compact visual countdown to the next verse in active Slideshow playback, synchronized with the syllable-based interval.
- [x] Ensure the indicator pauses, resets, and restarts correctly after play/pause, manual verse changes, and automatic verse advances.
- [x] Verify the countdown on desktop/mobile, its reduced playback control state, TypeScript, and production build before saving a checkpoint.

## Navigation, reading tools, and diacritics

- [x] Close the global navigation menu after every destination choice, including in-page Search and Library anchors.
- [x] Remove the long-line-and-ring decorative span motif throughout the UI.
- [x] Move Reading Tools to a sticky top-right position on the song article while retaining every existing control.
- [x] Make the ā̐ compound glyph render consistently with the selected verse typeface on desktop and mobile, then verify build and responsive behavior.
