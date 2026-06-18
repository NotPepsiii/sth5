// CONFIG
const TMDB_API_KEY = "35ee82bcad013e6a6237a0a087d7eb32";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

// Use the movie embed base that worked for you
const MOVIE_EMBED_BASE = "https://embedmaster.link";

// LocalStorage key for saved TV pattern
const TV_PATTERN_KEY = "pepsi_tv_embed_pattern";

// Candidate TV patterns to test (placeholders: {id}, {s}, {e}, {player_id})
const DEFAULT_TV_PATTERNS = [
  "/player/tv/{id}/{s}/{e}?player_id={player_id}",
  "/tv/{id}/season/{s}/episode/{e}?player_id={player_id}",
  "/series/{id}/season/{s}/episode/{e}?player_id={player_id}",
  "/watch/{id}?season={s}&episode={e}&player_id={player_id}",
  "/tv/{id}",
  "/series/{id}"
];

// DOM
const player = document.getElementById("player");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchSection = document.getElementById("searchSection");
const searchRow = document.getElementById("searchRow");

const popularRow = document.getElementById("popularRow");
const topRatedRow = document.getElementById("topRatedRow");
const actionRow = document.getElementById("actionRow");
const horrorRow = document.getElementById("horrorRow");
const comedyRow = document.getElementById("comedyRow");
const seriesRow = document.getElementById("seriesRow");

const tabMovies = document.getElementById("tabMovies");
const tabSeries = document.getElementById("tabSeries");
const moviesView = document.getElementById("moviesView");
const seriesView = document.getElementById("seriesView");

const seriesPanel = document.getElementById("seriesPanel");
const closeSeriesPanel = document.getElementById("closeSeriesPanel");
const seriesTitle = document.getElementById("seriesTitle");
const seriesOverview = document.getElementById("seriesOverview");
const seasonSelect = document.getElementById("seasonSelect");
const episodeSelect = document.getElementById("episodeSelect");
const playEpisodeBtn = document.getElementById("playEpisodeBtn");
const seriesError = document.getElementById("seriesError");
const episodeList = document.getElementById("episodeList");

const tryButtonsContainer = document.getElementById("tryButtons");
const usePatternBtn = document.getElementById("usePatternBtn");
const openTestBtn = document.getElementById("openTestBtn");
const currentPatternLabel = document.getElementById("currentPatternLabel");

// State
let currentSeriesId = null;
let currentSeasons = [];
let currentEpisodes = [];
let lastTestedUrl = null;
let lastTestedPattern = null;

// INIT
document.addEventListener("DOMContentLoaded", () => {
  renderTryButtons();
  loadPopularMovies();
  loadTopRatedMovies();
  loadGenreMovies(28, actionRow);
  loadGenreMovies(27, horrorRow);
  loadGenreMovies(35, comedyRow);
  loadPopularSeries();

  const saved = localStorage.getItem(TV_PATTERN_KEY);
  if (saved) currentPatternLabel.textContent = `Saved pattern: ${saved}`;

  tryButtonsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".try-btn");
    if (!btn) return;
    const pattern = btn.dataset.pattern;
    handleTryPattern(pattern);
  });

  usePatternBtn.addEventListener("click", () => {
    if (!lastTestedPattern) return;
    localStorage.setItem(TV_PATTERN_KEY, lastTestedPattern);
    currentPatternLabel.textContent = `Saved pattern: ${lastTestedPattern}`;
    usePatternBtn.style.display = "none";
    openTestBtn.style.display = "none";
    showSeriesMessage("Pattern saved. Series will auto-play using this pattern.");
  });

  openTestBtn.addEventListener("click", () => {
    if (!lastTestedUrl) return;
    // open tested URL in new tab only when user explicitly clicks this button
    window.open(lastTestedUrl, "_blank");
  });
});

// TABS
tabMovies.addEventListener("click", () => {
  tabMovies.classList.add("active");
  tabSeries.classList.remove("active");
  moviesView.style.display = "";
  seriesView.style.display = "none";
  seriesPanel.style.display = "none";
});

tabSeries.addEventListener("click", () => {
  tabSeries.classList.add("active");
  tabMovies.classList.remove("active");
  moviesView.style.display = "none";
  seriesView.style.display = "";
  seriesPanel.style.display = "none";
});

// SEARCH
searchBtn.addEventListener("click", () => {
  const q = searchInput.value.trim();
  if (!q) return;
  searchAll(q);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// FETCH helper
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err, url);
    return null;
  }
}

// LOADERS
async function loadPopularMovies() {
  const data = await fetchJson(`${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
  renderRow(data?.results || [], popularRow, false);
}

async function loadTopRatedMovies() {
  const data = await fetchJson(`${TMDB_BASE}/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
  renderRow(data?.results || [], topRatedRow, false);
}

async function loadGenreMovies(genreId, container) {
  const data = await fetchJson(`${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${genreId}&page=1`);
  renderRow(data?.results || [], container, false);
}

async function loadPopularSeries() {
  const data = await fetchJson(`${TMDB_BASE}/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
  renderRow(data?.results || [], seriesRow, true);
}

// SEARCH (movies + tv)
async function searchAll(query) {
  searchSection.style.display = "block";
  searchRow.innerHTML = `<p>Searching for "${escapeHtml(query)}"…</p>`;
  const [movies, tv] = await Promise.all([
    fetchJson(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`),
    fetchJson(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`)
  ]);
  const movieResults = (movies?.results || []).map(m => ({ ...m, _isTv: false }));
  const tvResults = (tv?.results || []).map(t => ({ ...t, _isTv: true }));
  const combined = [...movieResults, ...tvResults];
  renderRow(combined, searchRow, null);
  tabMovies.classList.add("active");
  tabSeries.classList.remove("active");
  moviesView.style.display = "";
  seriesView.style.display = "none";
  searchSection.scrollIntoView({ behavior: "smooth" });
}

// RENDER
function renderRow(items, container, isTvFlag) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No items.</p>";
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const posterPath = item.poster_path || item.backdrop_path || "";
    const poster = posterPath ? `${TMDB_IMG}${posterPath}` : "https://via.placeholder.com/300x450?text=No+Image";

    const title = item.title || item.name || "Untitled";
    const year = (item.release_date || item.first_air_date || "N/A").slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

    card.innerHTML = `
      <img src="${poster}" alt="${escapeHtml(title)}">
      <div class="movie-info">
        <div class="movie-title">${escapeHtml(title)}</div>
        <div class="movie-meta">${year} • ⭐ ${rating}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      const tmdbId = item.id;
      const tvFlag = (typeof isTvFlag === "boolean") ? isTvFlag : !!item._isTv;

      if (tvFlag) {
        openSeriesPanel(tmdbId);
        tabSeries.classList.add("active");
        tabMovies.classList.remove("active");
        moviesView.style.display = "none";
        seriesView.style.display = "";
      } else {
        const embedUrl = `${MOVIE_EMBED_BASE}/movie/${tmdbId}`;
        player.src = embedUrl;
        if (window.innerWidth < 900) document.querySelector(".player-section").scrollIntoView({ behavior: "smooth" });
      }
    });

    container.appendChild(card);
  });
}

// SERIES PANEL
async function openSeriesPanel(tvId) {
  seriesError.style.display = "none";
  episodeList.innerHTML = "";
  seasonSelect.innerHTML = "";
  episodeSelect.innerHTML = "";
  seriesPanel.style.display = "block";
  currentSeriesId = tvId;

  const details = await fetchJson(`${TMDB_BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`);
  if (!details) {
    seriesError.textContent = "Failed to load series details.";
    seriesError.style.display = "block";
    return;
  }

  seriesTitle.textContent = details.name || details.original_name || "Series";
  seriesOverview.textContent = details.overview || "";

  currentSeasons = (details.seasons || []).filter(s => typeof s.season_number === "number");
  currentSeasons.sort((a,b) => a.season_number - b.season_number);
  seasonSelect.innerHTML = "";
  currentSeasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = String(s.season_number);
    opt.textContent = `Season ${s.season_number} ${s.name ? `- ${s.name}` : ""}`;
    seasonSelect.appendChild(opt);
  });

  if (currentSeasons.length === 0) {
    seriesError.textContent = "No seasons available for this series.";
    seriesError.style.display = "block";
    return;
  }

  const firstSeason = currentSeasons[0].season_number;
  await loadSeasonEpisodes(tvId, firstSeason);
}

closeSeriesPanel.addEventListener("click", () => {
  seriesPanel.style.display = "none";
});

seasonSelect.addEventListener("change", async () => {
  const seasonVal = seasonSelect.value;
  const seasonNum = normalizeSeason(seasonVal);
  if (seasonNum === null) return;
  await loadSeasonEpisodes(currentSeriesId, seasonNum);
});

playEpisodeBtn.addEventListener("click", () => {
  const seasonVal = seasonSelect.value;
  const episodeVal = episodeSelect.value;
  const seasonNum = normalizeSeason(seasonVal);
  const episodeNum = normalizeEpisode(episodeVal);
  if (seasonNum === null || episodeNum === null) return;

  const savedPattern = localStorage.getItem(TV_PATTERN_KEY);
  let url;
  if (savedPattern) {
    url = buildUrlFromPattern(savedPattern, { id: currentSeriesId, s: seasonNum, e: episodeNum });
  } else {
    // default: /player/tv/{id}/{s}/{e} with a valid player_id appended
    url = `${MOVIE_EMBED_BASE}/player/tv/${currentSeriesId}/${seasonNum}/${episodeNum}`;
    if (!/player_id=/.test(url)) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}player_id=${generatePlayerId()}`;
    }
  }

  // set iframe src to play inside the page (no new tab)
  player.src = url;
  if (window.innerWidth < 900) document.querySelector(".player-section").scrollIntoView({ behavior: "smooth" });
});

async function loadSeasonEpisodes(tvId, seasonNumber) {
  seriesError.style.display = "none";
  episodeList.innerHTML = "<p>Loading episodes…</p>";
  episodeSelect.innerHTML = "";

  const seasonNum = normalizeSeason(seasonNumber);
  if (seasonNum === null) {
    episodeList.innerHTML = "";
    return;
  }

  const data = await fetchJson(`${TMDB_BASE}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=en-US`);
  if (!data) {
    seriesError.textContent = "Failed to load season data.";
    seriesError.style.display = "block";
    episodeList.innerHTML = "";
    return;
  }

  currentEpisodes = data.episodes || [];
  episodeList.innerHTML = "";

  if (!currentEpisodes.length) {
    episodeList.innerHTML = "<p>No episodes found for this season.</p>";
    return;
  }

  episodeSelect.innerHTML = "";
  currentEpisodes.forEach(ep => {
    const epNum = ep.episode_number;
    const opt = document.createElement("option");
    opt.value = String(epNum);
    opt.textContent = `${epNum}. ${ep.name || `Episode ${epNum}`}`;
    episodeSelect.appendChild(opt);

    const item = document.createElement("div");
    item.className = "episode-item";
    item.innerHTML = `<strong>${epNum}. ${escapeHtml(ep.name || `Episode ${epNum}`)}</strong><div class="muted">${escapeHtml(ep.overview || "")}</div>`;
    item.addEventListener("click", () => {
      // set selects
      seasonSelect.value = String(seasonNum);
      episodeSelect.value = String(epNum);

      // build URL (saved pattern or default) and set iframe.src — no new tab
      const savedPattern = localStorage.getItem(TV_PATTERN_KEY);
      let url;
      if (savedPattern) {
        url = buildUrlFromPattern(savedPattern, { id: tvId, s: seasonNum, e: epNum });
      } else {
        url = `${MOVIE_EMBED_BASE}/player/tv/${tvId}/${seasonNum}/${epNum}`;
        if (!/player_id=/.test(url)) {
          const sep = url.includes("?") ? "&" : "?";
          url = `${url}${sep}player_id=${generatePlayerId()}`;
        }
      }

      player.src = url;
      if (window.innerWidth < 900) document.querySelector(".player-section").scrollIntoView({ behavior: "smooth" });
    });
    episodeList.appendChild(item);
  });

  episodeSelect.selectedIndex = 0;
  episodeList.scrollTop = 0;
}

// TRY PATTERNS
function renderTryButtons() {
  tryButtonsContainer.innerHTML = "";
  DEFAULT_TV_PATTERNS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "try-btn";
    btn.dataset.pattern = p;
    btn.textContent = p;
    tryButtonsContainer.appendChild(btn);
  });
}

function handleTryPattern(pattern) {
  if (!currentSeriesId) {
    showSeriesMessage("No series selected.");
    return;
  }

  const seasonVal = seasonSelect.value || (currentSeasons[0] && String(currentSeasons[0].season_number)) || "1";
  const episodeVal = episodeSelect.value || (currentEpisodes[0] && String(currentEpisodes[0].episode_number)) || "1";

  // fill placeholders including a valid player_id if pattern expects it
  const replacements = {
    "{id}": String(currentSeriesId),
    "{s}": String(seasonVal),
    "{e}": String(episodeVal),
    "{player_id}": generatePlayerId()
  };

  let url = pattern;
  Object.keys(replacements).forEach(k => {
    url = url.replace(new RegExp(k, "g"), replacements[k]);
  });

  if (url.startsWith("/")) url = MOVIE_EMBED_BASE + url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith(MOVIE_EMBED_BASE)) {
    url = MOVIE_EMBED_BASE + (url.startsWith("/") ? url : "/" + url);
  }

  lastTestedUrl = url;
  lastTestedPattern = pattern;
  usePatternBtn.style.display = "inline-block";
  openTestBtn.style.display = "inline-block";
  currentPatternLabel.textContent = `Last tested: ${pattern}`;

  // set iframe src to test inside the page (no automatic new tab)
  player.src = url;
  showSeriesMessage(`Testing: ${url} — if it loads correctly, click "Use this pattern" to save it.`);
}

// Build URL from pattern and placeholders. If pattern starts with '/', prefix MOVIE_EMBED_BASE.
function buildUrlFromPattern(pattern, { id, s, e }) {
  const playerId = generatePlayerId();
  let url = pattern.replace(/{id}/g, String(id)).replace(/{s}/g, String(s)).replace(/{e}/g, String(e)).replace(/{player_id}/g, playerId);
  if (url.startsWith("/")) url = MOVIE_EMBED_BASE + url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith(MOVIE_EMBED_BASE)) {
    url = MOVIE_EMBED_BASE + (url.startsWith("/") ? url : "/" + url);
  }
  // ensure /player/tv/... has player_id
  if (/\/player\/tv\/\d+\/\d+\/\d+/.test(url) && !/player_id=/.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}player_id=${playerId}`;
  }
  return url;
}

// Generate a valid 16-character alphanumeric player_id
function generatePlayerId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

// VALIDATION
function normalizeSeason(val) {
  if (val === undefined || val === null) {
    showSeriesError("Season is required.");
    return null;
  }
  const s = String(val).trim();
  if (!/^\d+$/.test(s)) {
    showSeriesError("Invalid season (must be numeric).");
    return null;
  }
  if (s.length > 1 && s.startsWith("0")) {
    showSeriesError("Invalid season (no leading zeros).");
    return null;
  }
  const n = Number(s);
  if (n < 0 || n > 9999) {
    showSeriesError("Invalid season (must be 0-9999).");
    return null;
  }
  seriesError.style.display = "none";
  return String(n);
}

function normalizeEpisode(val) {
  if (val === undefined || val === null) {
    showSeriesError("Episode is required.");
    return null;
  }
  const s = String(val).trim();
  if (!/^\d+$/.test(s)) {
    showSeriesError("Invalid episode (must be numeric).");
    return null;
  }
  if (s.length > 1 && s.startsWith("0")) {
    showSeriesError("Invalid episode (no leading zeros).");
    return null;
  }
  const n = Number(s);
  if (n < 0 || n > 9999) {
    showSeriesError("Invalid episode (must be 0-9999).");
    return null;
  }
  seriesError.style.display = "none";
  return String(n);
}

function showSeriesError(msg) {
  seriesError.textContent = msg;
  seriesError.style.display = "block";
}

function showSeriesMessage(msg) {
  seriesError.textContent = msg;
  seriesError.style.display = "block";
  setTimeout(() => { seriesError.style.display = "none"; }, 4000);
}

// UTIL
function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
