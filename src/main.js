import { searchAniList, fetchAniListDetails } from "./anilist.js";
import { readStore, writeStore } from "./storage.js";

const app = document.getElementById("app");

const routes = {
  home: "index.html",
  library: "library.html",
  search: "discover.html",
  details: "details.html",
  settings: "settings.html",
};

const page = app?.dataset.page || document.body.dataset.page || inferPage();

const defaultState = {
  theme: "dark",
  user: null,
  activeTab: "library",
  selectedId: null,
  libraryFilter: "anime",
  search: {
    query: "",
    category: "all",
    sort: "year-desc",
  },
  searchResults: [],
  searchStatus: "idle",
  searchError: null,
  library: {},
  detailCache: {},
  detailStatus: {},
};

let state = normalizeState(readStore("state", defaultState));
let bootstrappedSearch = false;

const urlSelectedId = new URLSearchParams(window.location.search).get("id");
if (page === "details" && urlSelectedId && state.selectedId !== urlSelectedId) {
  state = normalizeState({ ...state, selectedId: urlSelectedId, activeTab: "details" });
  writeStore("state", state);
}

setTheme(state.theme);
render();

if (page === "search" && !state.searchResults.length) {
  performSearch(state.search);
}

function inferPage() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  if (file === "library.html") return "library";
  if (file === "discover.html") return "search";
  if (file === "details.html") return "details";
  if (file === "settings.html") return "settings";
  return "home";
}

function normalizeState(value) {
  return {
    ...defaultState,
    ...value,
    search: { ...defaultState.search, ...(value?.search ?? {}) },
    library: value?.library ?? {},
    searchResults: value?.searchResults ?? [],
    detailCache: value?.detailCache ?? {},
    detailStatus: value?.detailStatus ?? {},
  };
}

function pageTitle() {
  const titles = {
    home: "Otoko Tracker",
    library: "Library | Otoko Tracker",
    search: "Discover | Otoko Tracker",
    details: "Details | Otoko Tracker",
    settings: "Settings | Otoko Tracker",
  };
  return titles[page] || titles.home;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function setState(updates, options = {}) {
  const previousTheme = state.theme;
  state = normalizeState({ ...state, ...updates });
  if (state.theme !== previousTheme) {
    setTheme(state.theme);
  }
  writeStore("state", state);
  if (options.render !== false) {
    render();
  }
}

function resetAppData() {
  bootstrappedSearch = false;
  setState(defaultState, { render: false });
  goTo("home");
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildUrl(targetPage, params = {}) {
  const route = routes[targetPage] || routes.home;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `${route}?${queryString}` : route;
}

function goTo(targetPage, params = {}) {
  window.location.href = buildUrl(targetPage, params);
}

function getMeta(id) {
  const libraryMeta = state.library[id]?.meta;
  const detailMeta = state.detailCache[id];
  const searchMeta = state.searchResults.find((item) => item.id === id);
  return detailMeta || libraryMeta || searchMeta || null;
}

function addOrUpdateLibrary(meta, updates = {}) {
  if (!meta) return;
  const existing = state.library[meta.id] ?? {
    id: meta.id,
    status: meta.format === "anime" ? "watching" : "reading",
    progress: 0,
  };

  setState({
    library: {
      ...state.library,
      [meta.id]: {
        ...existing,
        ...updates,
        meta,
      },
    },
  });
}

function updateLibraryItem(id, updates) {
  const current = state.library[id];
  if (!current) return;
  const nextProgress = updates.progress ?? current.progress ?? 0;
  const nextMeta = current.meta
    ? { ...current.meta, totalParts: Math.max(current.meta.totalParts || 0, nextProgress) }
    : current.meta;
  addOrUpdateLibrary(nextMeta, { ...current, ...updates, progress: nextProgress });
}

function removeLibraryItem(id) {
  const next = { ...state.library };
  delete next[id];
  setState({ library: next });
}

function libraryEntries(filter = state.libraryFilter) {
  return Object.values(state.library)
    .map((entry) => ({ entry, meta: entry.meta }))
    .filter(({ meta }) => {
      if (!meta) return false;
      if (filter === "anime") return meta.format === "anime";
      if (filter === "comic") return meta.format === "comic";
      return true;
    });
}

function getLibraryStats() {
  const entries = Object.values(state.library);
  const anime = entries.filter((entry) => entry.meta?.format === "anime").length;
  const comics = entries.filter((entry) => entry.meta?.format === "comic").length;
  const complete = entries.filter((entry) => entry.status === "complete").length;
  const active = entries.filter((entry) => ["watching", "reading"].includes(entry.status)).length;
  return { total: entries.length, anime, comics, complete, active };
}

function sortResults(results) {
  const { sort } = state.search;
  const yearSort = (a, b) => (b.year || 0) - (a.year || 0);
  if (sort === "year-desc") return [...results].sort(yearSort);
  if (sort === "year-asc") return [...results].sort((a, b) => (a.year || 0) - (b.year || 0));
  if (sort === "title") return [...results].sort((a, b) => a.title.localeCompare(b.title));
  return results;
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatNextRelease(meta) {
  if (!meta) return null;
  const isAnime = meta.format === "anime";
  const label = isAnime ? "Next episode" : "Next chapter";

  if (meta.status === "FINISHED") {
    return isAnime ? "Completed, all episodes released" : "Completed, all chapters released";
  }

  if (isAnime && meta.upcomingAiringEpisode && meta.nextReleaseAt) {
    const date = formatDate(meta.nextReleaseAt);
    return `${label}: ${meta.upcomingAiringEpisode} ${date ? `on ${date}` : ""}`.trim();
  }

  if (isAnime && meta.nextAiringEpisodeNumber) {
    return `Latest aired episode: ${meta.nextAiringEpisodeNumber}`;
  }

  return `${label}: ${meta.nextReleaseAt ? formatDate(meta.nextReleaseAt) : "TBD"}`;
}

function mediaTypeLabel(meta) {
  if (!meta) return "Title";
  if (meta.category === "movie") return "Movie";
  if (meta.category === "manhwa") return "Manhwa";
  if (meta.category === "manga") return "Manga";
  return "Anime";
}

async function performSearch(nextSearch = state.search) {
  if (bootstrappedSearch && nextSearch.query === state.search.query && nextSearch.category === state.search.category) {
    return;
  }

  bootstrappedSearch = true;
  setState({ search: nextSearch, activeTab: "search", searchStatus: "loading", searchError: null });

  try {
    const results = await searchAniList(nextSearch);
    setState({
      searchResults: sortResults(results),
      searchStatus: "done",
      searchError: null,
    });
  } catch (error) {
    setState({ searchStatus: "error", searchError: error.message, searchResults: [] });
  }
}

async function loadDetails(id) {
  if (state.detailCache[id]) return state.detailCache[id];
  setState({ detailStatus: { ...state.detailStatus, [id]: "loading" } });
  try {
    const meta = await fetchAniListDetails(id);
    setState({
      detailCache: { ...state.detailCache, [id]: meta },
      detailStatus: { ...state.detailStatus, [id]: "done" },
    });
    return meta;
  } catch (error) {
    setState({ detailStatus: { ...state.detailStatus, [id]: "error" } });
    throw error;
  }
}

function render() {
  if (!app) return;
  document.title = pageTitle();

  const content = state.user ? renderAuthedPage() : renderAuth();

  app.innerHTML = `
    <div class="ambient-layer" aria-hidden="true">
      <span class="orb orb-one"></span>
      <span class="orb orb-two"></span>
      <span class="depth-grid"></span>
    </div>
    ${renderHeader()}
    ${content}
    ${state.user ? renderFab() : ""}
  `;

  wireEvents();
}

function renderHeader() {
  const tabs = [
    { id: "library", label: "Library", href: routes.library },
    { id: "search", label: "Discover", href: routes.search },
    { id: "details", label: "Details", href: buildUrl("details", { id: state.selectedId }) },
    { id: "settings", label: "Settings", href: routes.settings },
  ];

  const userLabel = state.user
    ? `<span class="account-chip">${escapeHTML(state.user.name || state.user.email)}</span>`
    : `<span class="account-chip ghost">Local session</span>`;

  return `
    <header class="app-header">
      <a class="brand-lockup" href="${routes.home}" aria-label="Open home">
        <span class="brand-mark">OT</span>
        <span>
          <strong>Otoko Tracker</strong>
          <small>Anime and comics journal</small>
        </span>
      </a>
      <nav class="top-nav" aria-label="Primary">
        ${tabs
          .map(
            (tab) => `
              <a href="${tab.href}" class="${tab.id === page ? "active" : ""}">
                ${tab.label}
              </a>
            `
          )
          .join("")}
      </nav>
      <div class="header-actions">
        <button id="theme-toggle" class="icon-button" aria-label="Toggle theme">
          ${document.documentElement.dataset.theme === "dark" ? "Light" : "Dark"}
        </button>
        ${userLabel}
      </div>
    </header>
  `;
}

function renderAuth() {
  return `
    <main class="auth-layout">
      <section class="auth-hero surface-panel reveal">
        <div class="auth-copy">
          <p class="system-label">Local-first watchlist</p>
          <h1>Track the stories you keep returning to.</h1>
          <p class="lead">Search AniList, save titles, update progress, and keep the whole library private in this browser.</p>
        </div>
        <form id="auth-form" class="auth-form" aria-label="Start local session">
          <label class="field">
            <span class="field-label">Email</span>
            <input type="email" name="email" placeholder="you@example.com" autocomplete="email" required />
          </label>
          <label class="field">
            <span class="field-label">Display name</span>
            <input type="text" name="name" placeholder="Optional" autocomplete="name" />
          </label>
          <button type="submit">Continue</button>
          <p class="form-note">No remote account is created. Your profile stays on this device.</p>
        </form>
      </section>
    </main>
  `;
}

function renderAuthedPage() {
  switch (page) {
    case "library":
      return renderLibrary();
    case "search":
      return renderSearch();
    case "details":
      return renderDetails();
    case "settings":
      return renderSettings();
    default:
      return renderHome();
  }
}

function renderHome() {
  const entries = libraryEntries("all");
  const stats = getLibraryStats();
  const featured = entries.slice(0, 3);
  const continueItems = entries.slice(0, 4);

  return `
    <main class="page-stack">
      <section class="dashboard-hero reveal">
        <div class="hero-copy">
          <p class="system-label">Private media tracker</p>
          <h1>Track every episode and chapter without the clutter.</h1>
          <p class="lead">Keep anime, movies, manga, and manhwa in one local library with release context and clean progress controls.</p>
          <div class="hero-actions">
            <a class="button" href="${routes.search}">Discover titles</a>
            <a class="button secondary" href="${routes.library}">Open library</a>
          </div>
        </div>
        <div class="hero-console surface-panel tilt-card" aria-label="Library summary">
          <div class="console-header">
            <span>Library signal</span>
            <strong>${stats.total} saved</strong>
          </div>
          <div class="stat-grid">
            ${renderStat("Active", stats.active)}
            ${renderStat("Anime", stats.anime)}
            ${renderStat("Comics", stats.comics)}
            ${renderStat("Complete", stats.complete)}
          </div>
          <div class="cover-stack" aria-hidden="true">
            ${featured.length
              ? featured.map(({ meta }) => renderMiniCover(meta)).join("")
              : `<span class="empty-cover"></span><span class="empty-cover"></span><span class="empty-cover"></span>`}
          </div>
        </div>
      </section>

      <section class="surface-panel reveal">
        <div class="section-header">
          <div>
            <p class="system-label">Continue</p>
            <h2>Pick up where you left off</h2>
          </div>
          <a class="button secondary" href="${routes.library}">View all</a>
        </div>
        ${
          continueItems.length
            ? `<div class="media-grid">${continueItems.map(({ entry, meta }, index) => renderLibraryCard(entry, meta, index)).join("")}</div>`
            : renderEmptyState("No saved titles yet", "Discover your first title and start tracking progress.", "Find something", "search")
        }
      </section>
    </main>
  `;
}

function renderLibrary() {
  const entries = libraryEntries();
  const hasEntries = entries.length > 0;

  return `
    <main class="page-stack">
      <section class="surface-panel reveal">
        <div class="section-header">
          <div>
            <p class="system-label">Collection</p>
            <h1>Your Library</h1>
            <p class="lead compact">Filter saved anime, movies, manga, and manhwa without leaving the page.</p>
          </div>
          <div class="segmented-control" aria-label="Library filter">
            <button data-library-filter="anime" class="${state.libraryFilter === "anime" ? "active" : ""}">Anime / Movies</button>
            <button data-library-filter="comic" class="${state.libraryFilter === "comic" ? "active" : ""}">Manga / Manhwa</button>
          </div>
        </div>
        ${
          hasEntries
            ? `<div class="media-grid">${entries.map(({ entry, meta }, index) => renderLibraryCard(entry, meta, index)).join("")}</div>`
            : renderEmptyState("Your collection is empty", "Search AniList and add the next title you want to track.", "Find something", "search")
        }
      </section>
    </main>
  `;
}

function renderStat(label, value) {
  return `
    <div class="stat-tile">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderMiniCover(meta) {
  return `
    <span class="mini-cover">
      ${meta.coverImage ? `<img src="${escapeHTML(meta.coverImage)}" alt="" loading="lazy" />` : ""}
    </span>
  `;
}

function renderEmptyState(title, copy, actionLabel, navTarget) {
  return `
    <div class="empty-state">
      <div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(copy)}</p>
      </div>
      <button class="button" data-nav="${navTarget}">${escapeHTML(actionLabel)}</button>
    </div>
  `;
}

function renderLibraryCard(entry, meta, index = 0) {
  if (!meta) return "";
  const maxParts = Math.max(meta.totalParts || 0, entry.progress || 0, 1);
  const pct = Math.min(100, Math.round(((entry.progress || 0) / maxParts) * 100));
  const totalLabel = meta.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(meta);
  return `
    <article class="media-card reveal tilt-card" style="--stagger:${Math.min(index, 8)};">
      ${renderCover(meta)}
      <div class="media-body">
        <div class="card-title">
          <div class="title-block">
            <span class="badge">${mediaTypeLabel(meta)}</span>
            <h3>${escapeHTML(meta.title)}</h3>
          </div>
          <span class="status-chip">${escapeHTML(entry.status)}</span>
        </div>
        <p class="meta-line">${escapeHTML(meta.year || "Unknown")} / ${escapeHTML(meta.tags.slice(0, 3).join(" / "))}</p>
        <p class="meta-line">${totalLabel}: ${escapeHTML(meta.totalParts || "?")}</p>
        ${nextRelease ? `<p class="release-note">${escapeHTML(nextRelease)}</p>` : ""}
        <p class="line-clamp-2">${escapeHTML(meta.description)}</p>
        <div class="progress-shell" aria-label="Progress ${pct}%">
          <div class="progress"><span style="width:${pct}%;"></span></div>
          <div class="library-controls">
            <input type="range" min="0" max="${maxParts}" value="${entry.progress || 0}" data-progress-id="${entry.id}" aria-label="Progress for ${escapeHTML(meta.title)}" />
            <span class="count">${entry.progress || 0} / ${meta.totalParts || "?"}</span>
            <select class="status-select" data-status-id="${entry.id}" aria-label="Status for ${escapeHTML(meta.title)}">
              ${["watching", "reading", "complete", "on-hold"]
                .map((status) => `<option value="${status}" ${status === entry.status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <div class="card-actions">
          <button class="button secondary" data-open-id="${entry.id}">Details</button>
          <button class="button ghost" data-remove-id="${entry.id}">Remove</button>
        </div>
      </div>
    </article>
  `;
}

function renderCover(meta) {
  return `
    <div class="media-thumb">
      ${meta.coverImage ? `<img src="${escapeHTML(meta.coverImage)}" alt="${escapeHTML(meta.title)} cover" loading="lazy" />` : `<span>No cover</span>`}
    </div>
  `;
}

function renderSearch() {
  const results = sortResults(state.searchResults);
  const loading = state.searchStatus === "loading";
  const errored = state.searchStatus === "error";

  return `
    <main class="page-stack">
      <section class="surface-panel reveal">
        <div class="section-header search-heading">
          <div>
            <p class="system-label">AniList search</p>
            <h1>Discover titles without leaving your tracker.</h1>
            <p class="lead compact">Search by title or tag, then save the result directly into your local library.</p>
          </div>
        </div>
        <form id="search-form" class="search-bar">
          <label>
            <span class="visually-hidden">Search query</span>
            <input type="search" name="query" placeholder="Search AniList for a title or tag" value="${escapeHTML(state.search.query)}" />
          </label>
          <label>
            <span class="visually-hidden">Category</span>
            <select name="category">
              <option value="all" ${state.search.category === "all" ? "selected" : ""}>All media</option>
              <option value="anime" ${state.search.category === "anime" ? "selected" : ""}>Anime / Movie</option>
              <option value="manga" ${state.search.category === "manga" ? "selected" : ""}>Manga</option>
              <option value="manhwa" ${state.search.category === "manhwa" ? "selected" : ""}>Manhwa</option>
            </select>
          </label>
          <label>
            <span class="visually-hidden">Sort order</span>
            <select name="sort">
              <option value="year-desc" ${state.search.sort === "year-desc" ? "selected" : ""}>Newest</option>
              <option value="year-asc" ${state.search.sort === "year-asc" ? "selected" : ""}>Oldest</option>
              <option value="title" ${state.search.sort === "title" ? "selected" : ""}>Title A-Z</option>
            </select>
          </label>
          <button type="submit">Search</button>
        </form>
        ${loading ? renderLoadingState() : ""}
        ${errored ? `<div class="notice error"><strong>AniList did not respond.</strong><span>${escapeHTML(state.searchError || "Try again in a moment.")}</span></div>` : ""}
        ${!loading && !errored && results.length === 0 ? renderEmptyState("No results yet", "Try another title, genre, or category filter.", "Search again", "search") : ""}
      </section>
      ${
        results.length
          ? `<section class="media-grid search-results">${results.map((item, index) => renderSearchCard(item, index)).join("")}</section>`
          : ""
      }
    </main>
  `;
}

function renderLoadingState() {
  return `
    <div class="skeleton-grid" aria-live="polite" aria-label="Loading AniList results">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
}

function renderSearchCard(item, index = 0) {
  const inLibrary = Boolean(state.library[item.id]);
  const totalLabel = item.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(item);
  return `
    <article class="media-card reveal tilt-card" style="--stagger:${Math.min(index, 8)};">
      ${renderCover(item)}
      <div class="media-body">
        <div class="card-title">
          <div class="title-block">
            <span class="badge">${mediaTypeLabel(item)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
          <button class="button secondary" data-open-id="${item.id}">Details</button>
        </div>
        <p class="meta-line">${escapeHTML(item.year || "Unknown")} / ${escapeHTML(item.tags.slice(0, 3).join(" / "))}</p>
        <p class="meta-line">${totalLabel}: ${escapeHTML(item.totalParts || "?")}</p>
        ${nextRelease ? `<p class="release-note">${escapeHTML(nextRelease)}</p>` : ""}
        <p class="line-clamp-2">${escapeHTML(item.description)}</p>
        <div class="tag-row">
          ${item.tags.map((tag) => `<span class="badge subtle">${escapeHTML(tag)}</span>`).join("")}
        </div>
        <div class="card-actions">
          ${inLibrary ? `<span class="status-chip">In library</span>` : ""}
          <button class="button" data-add-id="${item.id}">${inLibrary ? "Update entry" : "Add to library"}</button>
        </div>
      </div>
    </article>
  `;
}

function renderDetails() {
  const meta = state.selectedId ? getMeta(state.selectedId) : null;
  const status = state.selectedId ? state.detailStatus[state.selectedId] : null;

  if (!state.selectedId) {
    return `
      <main class="page-stack">
        <section class="surface-panel reveal">
          <div class="section-header">
            <div>
              <p class="system-label">Details</p>
              <h1>No title selected</h1>
              <p class="lead compact">Open a title from Discover or your Library to inspect metadata and progress.</p>
            </div>
          </div>
          <a class="button" href="${routes.search}">Browse catalog</a>
        </section>
      </main>
    `;
  }

  if (!meta && status !== "loading") {
    loadDetails(state.selectedId).catch(() => {});
  }

  if (!meta) {
    return `
      <main class="page-stack">
        <section class="surface-panel reveal">
          <p class="system-label">Details</p>
          <h1>Loading details</h1>
          ${renderLoadingState()}
        </section>
      </main>
    `;
  }

  const entry = state.library[meta.id];
  const progress = entry?.progress ?? 0;
  const maxParts = Math.max(meta.totalParts || 0, progress || 0, 1);
  const pct = Math.min(100, Math.round((progress / maxParts) * 100));
  const totalLabel = meta.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(meta);

  return `
    <main class="page-stack">
      <section class="detail-layout reveal">
        <aside class="detail-poster tilt-card">
          ${renderCover(meta)}
          <div class="poster-actions">
            <button class="button" data-add-id="${meta.id}">Save to library</button>
            <a class="button secondary" href="${routes.search}">Back to discover</a>
          </div>
        </aside>
        <article class="surface-panel detail-copy">
          <div class="section-header">
            <div>
              <p class="system-label">${mediaTypeLabel(meta)}</p>
              <h1>${escapeHTML(meta.title)}</h1>
              <p class="meta-line">${escapeHTML(meta.year || "Unknown")} / ${escapeHTML(meta.tags.slice(0, 3).join(" / "))}</p>
            </div>
            <span class="status-chip">${escapeHTML(entry?.status || "not saved")}</span>
          </div>
          <div class="detail-meta">
            <span>${totalLabel}: ${escapeHTML(meta.totalParts || "?")}</span>
            ${nextRelease ? `<span>${escapeHTML(nextRelease)}</span>` : ""}
          </div>
          <p>${escapeHTML(meta.description || "No description available.")}</p>
          <div class="tag-row">${meta.tags.map((tag) => `<span class="badge subtle">${escapeHTML(tag)}</span>`).join("")}</div>
          <div class="progress-shell detail-progress" aria-label="Progress ${pct}%">
            <div class="progress"><span style="width:${pct}%;"></span></div>
            <div class="library-controls">
              <input type="range" min="0" max="${maxParts}" value="${progress}" data-progress-id="${meta.id}" aria-label="Progress for ${escapeHTML(meta.title)}" />
              <span class="count">${progress} / ${meta.totalParts || "?"}</span>
              <select class="status-select" data-status-id="${meta.id}" aria-label="Status for ${escapeHTML(meta.title)}">
                ${["watching", "reading", "complete", "on-hold"]
                  .map((option) => `<option value="${option}" ${option === entry?.status ? "selected" : ""}>${option}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </article>
      </section>
    </main>
  `;
}

function renderSettings() {
  const emailLabel = state.user?.email || "Not signed in";
  const nameLabel = state.user?.name || "";
  const sessionStatus = state.user ? "Signed in" : "Guest session";

  return `
    <main class="page-stack">
      <section class="settings-grid">
        <div class="surface-panel settings-card reveal">
          <div class="section-header settings-header">
            <div>
              <p class="system-label">Account</p>
              <h2>Profile and access</h2>
              <p class="lead compact">Update how you appear across the app and confirm your local contact info.</p>
            </div>
            <span class="status-chip">${sessionStatus}</span>
          </div>
          <form id="profile-form" class="settings-form">
            <label class="field">
              <span class="field-label">Display name</span>
              <input name="name" value="${escapeHTML(nameLabel)}" placeholder="Display name" autocomplete="name" />
            </label>
            <label class="field">
              <span class="field-label">Email</span>
              <input name="email" value="${escapeHTML(state.user?.email ?? "")}" type="email" placeholder="Email" autocomplete="email" />
            </label>
            <div class="form-actions">
              <a class="button secondary" href="${routes.library}">Back to library</a>
              <button type="submit">Save profile</button>
            </div>
          </form>
          <div class="settings-row">
            <div>
              <strong>Session controls</strong>
              <p>Currently signed in as <span class="pill">${escapeHTML(emailLabel)}</span>. Sign out to switch accounts.</p>
            </div>
            <button class="button ghost" id="sign-out">Sign out</button>
          </div>
        </div>

        <div class="surface-panel settings-card reveal">
          <div class="section-header settings-header">
            <div>
              <p class="system-label">Experience</p>
              <h2>Appearance and preferences</h2>
              <p class="lead compact">Tune the theme and default browsing mode.</p>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <strong>Color theme</strong>
              <p>Switch between light and dark for the entire app.</p>
            </div>
            <div class="row-actions">
              <button class="button ${state.theme === "dark" ? "" : "secondary"}" data-theme="dark">Dark</button>
              <button class="button ${state.theme === "light" ? "" : "secondary"}" data-theme="light">Light</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <strong>Default library view</strong>
              <p>Choose which collection you see first.</p>
            </div>
            <div class="row-actions">
              <button class="button ${state.libraryFilter === "anime" ? "" : "secondary"}" data-library-filter="anime">Anime / Movies</button>
              <button class="button ${state.libraryFilter === "comic" ? "" : "secondary"}" data-library-filter="comic">Manga / Manhwa</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <strong>Quick access</strong>
              <p>Jump to discovery or the selected detail view.</p>
            </div>
            <div class="row-actions">
              <a class="button secondary" href="${routes.search}">Discover titles</a>
              <a class="button secondary" href="${buildUrl("details", { id: state.selectedId })}">Open details</a>
            </div>
          </div>
        </div>

        <div class="surface-panel settings-card full-width reveal">
          <div class="section-header settings-header">
            <div>
              <p class="system-label">Privacy</p>
              <h2>Local data policy</h2>
              <p class="lead compact">Otoko Tracker keeps your information on this device. Nothing is sent to a server.</p>
            </div>
          </div>
          <div class="legal-box">
            <p><strong>Where your data lives:</strong> your library, preferences, and profile stay in browser local storage.</p>
            <p><strong>What leaves the device:</strong> search terms are sent to AniList only while fetching catalog results.</p>
            <p><strong>How to control it:</strong> sign out to remove your profile, or clear local data on a shared device.</p>
          </div>
          <details class="legal-details">
            <summary>Read the in-app privacy policy</summary>
            <ul>
              <li>Otoko Tracker does not create remote accounts or upload your library.</li>
              <li>AniList receives search terms only when you use Discover.</li>
              <li>The Clear local data control removes locally stored profile, preferences, cache, and library entries.</li>
              <li>Theme and filter changes only update preferences saved in this browser.</li>
            </ul>
          </details>
          <div class="settings-row">
            <div>
              <strong>Data controls</strong>
              <p>Manage stored information on this device.</p>
            </div>
            <button class="button secondary" id="reset-app">Clear local data</button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderFab() {
  return `
    <button class="fab" id="fab-search" title="Search and add" aria-label="Search and add a title">
      <span>+</span>
    </button>
  `;
}

function wireEvents() {
  app.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goTo(btn.dataset.nav);
    });
  });

  const themeToggle = app.querySelector("#theme-toggle");
  themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    setState({ theme: next });
  });

  const fab = app.querySelector("#fab-search");
  fab?.addEventListener("click", () => goTo("search"));

  const authForm = app.querySelector("#auth-form");
  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(authForm);
    setState(
      {
        user: {
          email: data.get("email"),
          name: data.get("name"),
        },
        activeTab: "library",
      },
      { render: false }
    );
    goTo("library");
  });

  const profileForm = app.querySelector("#profile-form");
  profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(profileForm);
    setState({
      user: {
        email: data.get("email"),
        name: data.get("name"),
      },
    });
  });

  app.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.theme;
      setTheme(next);
      setState({ theme: next });
    });
  });

  app.querySelectorAll("[data-library-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ libraryFilter: btn.dataset.libraryFilter }));
  });

  const signOut = app.querySelector("#sign-out");
  signOut?.addEventListener("click", () => {
    setState({ user: null, activeTab: "library" }, { render: false });
    goTo("home");
  });

  const resetApp = app.querySelector("#reset-app");
  resetApp?.addEventListener("click", () => resetAppData());

  const searchForm = app.querySelector("#search-form");
  if (searchForm) {
    const handleSearchSubmit = (event) => {
      event?.preventDefault();
      const data = new FormData(searchForm);
      const nextSearch = {
        query: data.get("query"),
        category: data.get("category"),
        sort: data.get("sort"),
      };
      performSearch(nextSearch);
    };
    searchForm.addEventListener("submit", handleSearchSubmit);
    searchForm.addEventListener("change", (event) => {
      if (event.target.name !== "query") {
        handleSearchSubmit(event);
      }
    });
  }

  app.querySelectorAll("[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.addId;
      const meta = getMeta(id);
      if (meta) {
        addOrUpdateLibrary(meta);
        setState({ selectedId: id, activeTab: "details" }, { render: page === "details" });
        if (page !== "details") {
          goTo("details", { id });
        }
        return;
      }
      loadDetails(id)
        .then((fetched) => {
          if (fetched) {
            addOrUpdateLibrary(fetched);
            setState({ selectedId: id, activeTab: "details" }, { render: page === "details" });
            if (page !== "details") {
              goTo("details", { id });
            }
          }
        })
        .catch(() => {});
    });
  });

  app.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.openId;
      setState({ selectedId: id, activeTab: "details" }, { render: false });
      goTo("details", { id });
    });
  });

  app.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => removeLibraryItem(btn.dataset.removeId));
  });

  app.querySelectorAll("[data-progress-id]").forEach((slider) => {
    slider.addEventListener("input", () => {
      const id = slider.dataset.progressId;
      const value = Number(slider.value);
      updateLibraryItem(id, { progress: value });
    });
  });

  app.querySelectorAll("[data-status-id]").forEach((select) => {
    select.addEventListener("change", () => {
      const id = select.dataset.statusId;
      const status = select.value;
      updateLibraryItem(id, { status });
    });
  });
}
