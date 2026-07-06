# Otoko Tracker

A lightweight multi-page tracker for anime, movies, manga, and manhwa with dark/light themes and local-first persistence.

## Project shape

Otoko Tracker is a static ES module website. There is no build step, package manager, backend, or server database. The browser loads thin HTML page shells that all share the same source modules:

- `index.html` for the home and local sign-in experience.
- `library.html` for saved titles and progress controls.
- `discover.html` for AniList search.
- `details.html` for selected title metadata, including `details.html?id=<anilist-id>`.
- `settings.html` for profile, theme, privacy, and local data controls.
- `src/main.js` for shared state, rendering, routing, navigation, and UI events.
- `src/anilist.js` for AniList GraphQL search and detail lookups.
- `src/storage.js` for localStorage persistence.
- `src/styles.css` for the responsive light/dark UI.

## Getting started

No build step is required. You can open `index.html` directly in your browser or serve it locally:

```bash
python -m http.server 4173
# then open http://localhost:4173
```

## Features

- Email/name sign-in (local only) with settings for theme and profile.
- Live search backed by the AniList GraphQL API with detail view.
- Add titles to your library with progress sliders, status tags, and sorting by media type.
- Floating "+" button to jump to search and quickly add new entries.
- Data is stored locally in your browser so you can pick up where you left off.

## Data and privacy

All profile, library, theme, filter, cache, and progress data is stored in browser localStorage under the `otoko-tracker:state` key. Search terms are sent to AniList only when fetching catalog results.

## Manual checks

After changes, open `index.html` or run the local server command above and check:

- Sign in with an email and optional display name.
- Navigate between Home, Library, Discover, Details, and Settings with normal page URLs.
- Search AniList from `discover.html`, open `details.html?id=<id>`, and add an entry to the library.
- Change progress/status and reload to confirm persistence.
- Switch light/dark theme and clear local data from Settings.
