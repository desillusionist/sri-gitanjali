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

- [ ] Make the Library and Search navigation items route to the home page and scroll to their respective library and search anchors.
- [ ] Add an accessible per-song badge that reports the total number of text matches in global search results.
- [ ] Link song authors and categories to the home page with the corresponding author or category filter preselected.
- [ ] Verify anchored navigation, filter links, match badges, desktop/mobile presentation, build checks, and save a checkpoint.
