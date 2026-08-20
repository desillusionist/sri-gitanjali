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
