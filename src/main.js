import { catalog, findCatalogItem } from "./catalog.js";
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
  library: {},
};

let state = normalizeState(readStore("state", defaultState));
setTheme(state.theme);
render();

function normalizeState(value) {
  return {
    ...defaultState,
    ...value,
    search: { ...defaultState.search, ...(value?.search ?? {}) },
    library: value?.library ?? {},
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

function updateLibraryItem(id, updates) {
  const current = state.library[id] ?? {
    id,
    status: "watching",
    progress: 0,
  };
  setState({
    library: {
      ...state.library,
      [id]: { ...current, ...updates },
    },
  });
}

function removeLibraryItem(id) {
  const next = { ...state.library };
  delete next[id];
  setState({ library: next });
}

function libraryEntries(filter = state.libraryFilter) {
  return Object.values(state.library)
    .map((entry) => ({ entry, meta: findCatalogItem(entry.id) }))
    .filter(({ meta }) => {
      if (!meta) return false;
      if (filter === "anime") return meta.format === "anime";
      if (filter === "comic") return meta.format === "comic";
      return true;
    });
}

function searchResults() {
  const { query, category, sort } = state.search;
  const term = query.trim().toLowerCase();

  let results = catalog.filter((item) => {
    const matchesQuery =
      !term ||
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.tags.some((tag) => tag.toLowerCase().includes(term));

    const matchesCategory =
      category === "all" ||
      item.category === category ||
      (category === "anime" && item.category === "movie");

    return matchesQuery && matchesCategory;
  });

  if (sort === "year-desc") results = results.sort((a, b) => b.year - a.year);
  if (sort === "year-asc") results = results.sort((a, b) => a.year - b.year);
  if (sort === "title")
    results = results.sort((a, b) => a.title.localeCompare(b.title));

  return results;
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
              <p class="muted">Search for a title and add it to your list.</p>
              <button class="button" data-nav="search">Find something</button>
            </div>`
      }
    </section>
  `;
}

function renderLibraryCard(entry, meta) {
  const pct = Math.min(100, Math.round((entry.progress / meta.totalParts) * 100));
  return `
    <article class="panel library-card">
      <div class="card-title">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge">${meta.format === "anime" ? "🎞️" : "📚"} ${
    meta.category
  }</span>
            <strong>${meta.title}</strong>
          </div>
          <p class="muted" style="margin-top:4px;">${meta.year} · ${meta.tags
    .slice(0, 3)
    .join(" · ")}</p>
        </div>
        <div class="badge subtle">${entry.status}</div>
      </div>
      <p>${meta.description}</p>
      <div class="progress-shell">
        <div class="progress"><span style="width:${pct}%;"></span></div>
        <div class="library-controls">
          <input type="range" min="0" max="${meta.totalParts}" value="${
    entry.progress
  }" data-progress-id="${entry.id}" />
          <div class="count">${entry.progress} / ${meta.totalParts}</div>
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
    </article>
  `;
}

function renderSearch() {
  const results = searchResults();

  return `
    <section class="panel">
      <div class="section-header">
        <h2>Discover</h2>
        <p class="muted">Search for anime, movies, manga, and manhwa.</p>
      </div>
      <form id="search-form" class="search-bar">
        <input type="search" name="query" placeholder="Search for a title or tag" value="${
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
      </form>
      <div class="grid cards" style="margin-top: 12px;">
        ${results.map((item) => renderSearchCard(item)).join("")}
      </div>
    </section>
  `;
}

function renderSearchCard(item) {
  const inLibrary = Boolean(state.library[item.id]);
  return `
    <article class="panel">
      <div class="card-title">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge">${item.format === "anime" ? "🎞️" : "📚"} ${
    item.category
  }</span>
            <strong>${item.title}</strong>
          </div>
          <p class="muted" style="margin-top:4px;">${item.year} · ${item.tags
    .slice(0, 3)
    .join(" · ")}</p>
        </div>
        <button class="button secondary" data-open-id="${item.id}">Details</button>
      </div>
      <p>${item.description}</p>
      <div class="tag-row">
        ${item.tags.map((tag) => `<span class="badge subtle">${tag}</span>`).join("")}
      </div>
      <div style="margin-top:12px; display:flex; gap:10px;">
        ${inLibrary ? `<span class="badge">Already in library</span>` : ""}
        <button class="button" data-add-id="${item.id}">
          ${inLibrary ? "Update entry" : "Add to library"}
        </button>
      </div>
    </article>
  `;
}

function renderDetails() {
  const meta = state.selectedId ? findCatalogItem(state.selectedId) : null;

  if (!meta)
    return `
      <section class="panel">
        <div class="section-header">
          <h2>Details</h2>
          <p class="muted">Select a title from search or your library.</p>
        </div>
        <button class="button" data-nav="search">Browse catalog</button>
      </section>
    `;

  const entry = state.library[meta.id];
  const progress = entry?.progress ?? 0;
  const pct = Math.min(100, Math.round((progress / meta.totalParts) * 100));

  return `
    <section class="panel">
      <div class="section-header">
        <div>
          <h2>${meta.title}</h2>
          <p class="muted">${meta.year} · ${meta.category} · ${meta.tags
    .slice(0, 3)
    .join(" · ")}</p>
        </div>
        <div class="badge">${meta.format === "anime" ? "🎞️" : "📚"} ${
    meta.format
  }</div>
      </div>
      <p>${meta.description}</p>
      <div class="tag-row">${meta.tags
        .map((tag) => `<span class="badge subtle">${tag}</span>`)
        .join("")}</div>
      <div class="progress-shell" style="margin-top:16px;">
        <div class="progress"><span style="width:${pct}%;"></span></div>
        <div class="library-controls" style="margin-top: 8px;">
          <input type="range" min="0" max="${meta.totalParts}" value="${progress}" data-progress-id="${
    meta.id
  }" />
          <div class="count">${progress} / ${meta.totalParts}</div>
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
    const handleSearchChange = () => {
      const data = new FormData(searchForm);
      setState({
        search: {
          query: data.get("query"),
          category: data.get("category"),
          sort: data.get("sort"),
        },
      });
    };
    searchForm.addEventListener("input", handleSearchChange);
    searchForm.addEventListener("change", handleSearchChange);
  }

  app.querySelectorAll("[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.addId;
      const meta = findCatalogItem(id);
      if (!meta) return;
      updateLibraryItem(id, { status: meta.format === "anime" ? "watching" : "reading" });
      setState({ selectedId: id, activeTab: "details" });
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
