import { searchAniList, fetchAniListDetails } from "./anilist.js";
import { readStore, writeStore } from "./storage.js";

const app = document.getElementById("app");

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

setTheme(state.theme);
render();

if (!state.searchResults.length) {
  performSearch(state.search);
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

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function setState(updates) {
  const previousTheme = state.theme;
  state = normalizeState({ ...state, ...updates });
  if (state.theme !== previousTheme) {
    setTheme(state.theme);
  }
  writeStore("state", state);
  render();
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
    return isAnime ? "Completed — all episodes released" : "Completed — all chapters released";
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

async function performSearch(nextSearch = state.search) {
  if (bootstrappedSearch && nextSearch.query === state.search.query && nextSearch.category === state.search.category) {
    return;
  }

  bootstrappedSearch = true;
  setState({ search: nextSearch, searchStatus: "loading", searchError: null });

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

  const content = state.user ? renderAuthedShell() : renderAuth();

  app.innerHTML = `
    ${renderHeader()}
    ${content}
    <button class="fab" id="fab-search" title="Search and add">
      +
    </button>
  `;

  wireEvents();
}

function renderHeader() {
  const tabs = [
    { id: "library", label: "Library" },
    { id: "search", label: "Discover" },
    { id: "details", label: "Details" },
    { id: "settings", label: "Settings" },
  ];

  const userLabel = state.user
    ? `<div class="badge">👤 ${state.user.name || state.user.email}</div>`
    : "";

  return `
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">OT</div>
        <div>
          <div style="font-weight: 800; font-size: 18px">Otoko Tracker</div>
          <div style="color: var(--muted); font-weight: 600;">Anime & Comics Journal</div>
        </div>
      </div>
      <nav class="top-nav">
        ${tabs
          .map(
            (tab) => `
              <button data-nav="${tab.id}" class="${
              tab.id === state.activeTab ? "active" : ""
            }">${tab.label}</button>
            `
          )
          .join("")}
      </nav>
      <div class="brand" style="justify-content:flex-end; gap:10px; min-width: 180px;">
        <button id="theme-toggle" class="button secondary" aria-label="Toggle theme">
          ${document.documentElement.dataset.theme === "dark" ? "🌙" : "☀️"}
        </button>
        ${userLabel}
      </div>
    </header>
  `;
}

function renderAuth() {
  return `
    <main>
      <div class="panel auth-card">
        <h2>Welcome to Otoko Tracker</h2>
        <p class="muted">Sign in to start tracking anime, movies, manga, and manhwa.</p>
        <form id="auth-form" class="grid" style="gap:12px; margin-top: 12px;">
          <input type="email" name="email" placeholder="Email" required />
          <input type="text" name="name" placeholder="Display name (optional)" />
          <button type="submit">Continue</button>
        </form>
      </div>
    </main>
  `;
}

function renderAuthedShell() {
  switch (state.activeTab) {
    case "search":
      return renderSearch();
    case "details":
      return renderDetails();
    case "settings":
      return renderSettings();
    default:
      return renderLibrary();
  }
}

function renderLibrary() {
  const entries = libraryEntries();
  const hasEntries = entries.length > 0;

  return `
    <section class="panel">
      <div class="section-header">
        <h2>Your Library</h2>
        <div class="brand" style="gap:8px;">
          <button data-library-filter="anime" class="button ${
            state.libraryFilter === "anime" ? "" : "secondary"
          }">Anime / Movies</button>
          <button data-library-filter="comic" class="button ${
            state.libraryFilter === "comic" ? "" : "secondary"
          }">Manga / Manhwa</button>
        </div>
      </div>
      ${
        hasEntries
          ? `<div class="grid cards">${entries
              .map(({ entry, meta }) => renderLibraryCard(entry, meta))
              .join("")}</div>`
          : `<div class="panel" style="text-align:center;">
              <h3>Nothing here yet</h3>
              <p class="muted">Search AniList and add titles to your list.</p>
              <button class="button" data-nav="search">Find something</button>
            </div>`
      }
    </section>
  `;
}

function renderLibraryCard(entry, meta) {
  if (!meta) return "";
  const maxParts = Math.max(meta.totalParts || 0, entry.progress || 0, 1);
  const pct = Math.min(100, Math.round(((entry.progress || 0) / maxParts) * 100));
  const totalLabel = meta.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(meta);
  return `
    <article class="panel library-card media-card">
      <div class="media-thumb">${meta.coverImage ? `<img src="${meta.coverImage}" alt="${meta.title} cover" />` : ""}</div>
      <div class="media-body">
        <div class="card-title">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge">${meta.format === "anime" ? "🎞️" : "📚"} ${
    meta.category
  }</span>
              <strong>${meta.title}</strong>
            </div>
            <p class="muted" style="margin-top:4px;">${meta.year || "Unknown"} · ${meta.tags
    .slice(0, 3)
    .join(" · ")}</p>
          </div>
          <div class="badge subtle">${entry.status}</div>
        </div>
        <p class="muted">${totalLabel}: ${meta.totalParts || "?"}</p>
        ${nextRelease ? `<p class="muted">${nextRelease}</p>` : ""}
        <p class="line-clamp-2">${meta.description}</p>
        <div class="progress-shell">
          <div class="progress"><span style="width:${pct}%;"></span></div>
          <div class="library-controls">
            <input type="range" min="0" max="${maxParts}" value="${entry.progress || 0}" data-progress-id="${
    entry.id
  }" />
            <div class="count">${entry.progress || 0} / ${meta.totalParts || "?"}</div>
            <select data-status-id="${entry.id}">
              ${["watching", "reading", "complete", "on-hold"]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      status === entry.status ? "selected" : ""
                    }>${status}</option>`
                )
                .join("")}
            </select>
            <button class="button secondary" data-remove-id="${entry.id}">Remove</button>
            <button class="button" data-open-id="${entry.id}">Details</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderSearch() {
  const results = sortResults(state.searchResults);
  const loading = state.searchStatus === "loading";
  const errored = state.searchStatus === "error";

  return `
    <section class="panel">
      <div class="section-header">
        <h2>Discover</h2>
        <p class="muted">Live AniList results with add-to-library actions.</p>
      </div>
      <form id="search-form" class="search-bar">
        <input type="search" name="query" placeholder="Search AniList for a title or tag" value="${
          state.search.query
        }" />
        <select name="category">
          <option value="all" ${state.search.category === "all" ? "selected" : ""}>All</option>
          <option value="anime" ${state.search.category === "anime" ? "selected" : ""}>Anime / Movie</option>
          <option value="manga" ${state.search.category === "manga" ? "selected" : ""}>Manga</option>
          <option value="manhwa" ${state.search.category === "manhwa" ? "selected" : ""}>Manhwa</option>
        </select>
        <select name="sort">
          <option value="year-desc" ${state.search.sort === "year-desc" ? "selected" : ""}>Newest</option>
          <option value="year-asc" ${state.search.sort === "year-asc" ? "selected" : ""}>Oldest</option>
          <option value="title" ${state.search.sort === "title" ? "selected" : ""}>Title A-Z</option>
        </select>
        <button type="submit">Search</button>
      </form>
      ${loading ? `<p class="muted">Loading AniList…</p>` : ""}
      ${errored ? `<p class="muted">${state.searchError || "Failed to load AniList."}</p>` : ""}
      <div class="grid cards" style="margin-top: 12px;">
        ${results.map((item) => renderSearchCard(item)).join("")}
      </div>
      ${!loading && !errored && results.length === 0 ? `<p class="muted">No results yet. Try a different search.</p>` : ""}
    </section>
  `;
}

function renderSearchCard(item) {
  const inLibrary = Boolean(state.library[item.id]);
  const totalLabel = item.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(item);
  return `
    <article class="panel media-card">
      <div class="media-thumb">${item.coverImage ? `<img src="${item.coverImage}" alt="${item.title} cover" />` : ""}</div>
      <div class="media-body">
        <div class="card-title">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge">${item.format === "anime" ? "🎞️" : "📚"} ${item.category}</span>
              <strong>${item.title}</strong>
            </div>
            <p class="muted" style="margin-top:4px;">${item.year || "Unknown"} · ${item.tags
    .slice(0, 3)
    .join(" · ")}</p>
          </div>
          <button class="button secondary" data-open-id="${item.id}">Details</button>
        </div>
        <p class="muted">${totalLabel}: ${item.totalParts || "?"}</p>
        ${nextRelease ? `<p class="muted">${nextRelease}</p>` : ""}
        <p class="line-clamp-2">${item.description}</p>
        <div class="tag-row">
          ${item.tags.map((tag) => `<span class="badge subtle">${tag}</span>`).join("")}
        </div>
        <div style="margin-top:12px; display:flex; gap:10px;">
          ${inLibrary ? `<span class="badge">Already in library</span>` : ""}
          <button class="button" data-add-id="${item.id}">
            ${inLibrary ? "Update entry" : "Add to library"}
          </button>
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
      <section class="panel">
        <div class="section-header">
          <h2>Details</h2>
          <p class="muted">Select a title from search or your library.</p>
        </div>
        <button class="button" data-nav="search">Browse catalog</button>
      </section>
    `;
  }

  if (!meta && status !== "loading") {
    loadDetails(state.selectedId).catch(() => {});
  }

  if (!meta) {
    return `
      <section class="panel">
        <div class="section-header">
          <h2>Loading details…</h2>
          <p class="muted">Fetching from AniList.</p>
        </div>
      </section>
    `;
  }

  const entry = state.library[meta.id];
  const progress = entry?.progress ?? 0;
  const maxParts = Math.max(meta.totalParts || 0, progress || 0, 1);
  const pct = Math.min(100, Math.round(((progress || 0) / maxParts) * 100));
  const totalLabel = meta.format === "anime" ? "Latest episode" : "Latest chapter";
  const nextRelease = formatNextRelease(meta);

  return `
    <section class="panel media-card detail-card">
      <div class="media-thumb">${meta.coverImage ? `<img src="${meta.coverImage}" alt="${meta.title} cover" />` : ""}</div>
      <div class="media-body">
        <div class="section-header">
          <div>
            <h2>${meta.title}</h2>
            <p class="muted">${meta.year || "Unknown"} · ${meta.category} · ${meta.tags
    .slice(0, 3)
    .join(" · ")}</p>
          </div>
          <div class="badge">${meta.format === "anime" ? "🎞️" : "📚"} ${meta.format}</div>
        </div>
        <p class="muted">${totalLabel}: ${meta.totalParts || "?"}</p>
        ${nextRelease ? `<p class="muted">${nextRelease}</p>` : ""}
        <p>${meta.description}</p>
        <div class="tag-row">${meta.tags
          .map((tag) => `<span class="badge subtle">${tag}</span>`)
          .join("")}</div>
        <div class="progress-shell" style="margin-top:16px;">
          <div class="progress"><span style="width:${pct}%;"></span></div>
          <div class="library-controls" style="margin-top: 8px;">
            <input type="range" min="0" max="${maxParts}" value="${progress}" data-progress-id="${
    meta.id
  }" />
            <div class="count">${progress} / ${meta.totalParts || "?"}</div>
            <select data-status-id="${meta.id}">
              ${["watching", "reading", "complete", "on-hold"]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      status === entry?.status ? "selected" : ""
                    }>${status}</option>`
                )
                .join("")}
            </select>
            <button class="button" data-add-id="${meta.id}">Save to library</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="panel">
        <h3>Profile</h3>
        <p class="muted">Update your display name and email.</p>
        <form id="profile-form" class="grid" style="gap: 10px; margin-top: 10px;">
          <input name="name" value="${state.user?.name ?? ""}" placeholder="Display name" />
          <input name="email" value="${state.user?.email ?? ""}" type="email" placeholder="Email" />
          <button type="submit">Save profile</button>
        </form>
      </div>
      <div class="panel">
        <h3>Preferences</h3>
        <p class="muted">Theme, sorting, and quick toggles.</p>
        <div class="grid" style="gap: 10px; margin-top: 10px;">
          <div class="card-title">
            <span>Color theme</span>
            <div style="display:flex; gap:8px;">
              <button class="button ${state.theme === "dark" ? "" : "secondary"}" data-theme="dark">Dark</button>
              <button class="button ${state.theme === "light" ? "" : "secondary"}" data-theme="light">Light</button>
            </div>
          </div>
          <div class="card-title">
            <span>Library view</span>
            <div style="display:flex; gap:8px;">
              <button class="button ${state.libraryFilter === "anime" ? "" : "secondary"}" data-library-filter="anime">Anime</button>
              <button class="button ${state.libraryFilter === "comic" ? "" : "secondary"}" data-library-filter="comic">Comics</button>
            </div>
          </div>
          <div class="card-title">
            <span>Sign out</span>
            <button class="button ghost" id="sign-out">Sign out</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function wireEvents() {
  app.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      setState({ activeTab: nav });
      if (nav === "search") {
        app.querySelector("input[name='query']")?.focus();
      }
    });
  });

  const themeToggle = app.querySelector("#theme-toggle");
  themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    setState({ theme: next });
  });

  const fab = app.querySelector("#fab-search");
  fab?.addEventListener("click", () => setState({ activeTab: "search" }));

  const authForm = app.querySelector("#auth-form");
  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(authForm);
    setState({
      user: {
        email: data.get("email"),
        name: data.get("name"),
      },
      activeTab: "library",
    });
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
  signOut?.addEventListener("click", () => setState({ user: null, activeTab: "library" }));

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
        setState({ selectedId: id, activeTab: "details" });
        return;
      }
      loadDetails(id)
        .then((fetched) => {
          if (fetched) {
            addOrUpdateLibrary(fetched);
            setState({ selectedId: id, activeTab: "details" });
          }
        })
        .catch(() => {});
    });
  });

  app.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.openId;
      setState({ selectedId: id, activeTab: "details" });
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
