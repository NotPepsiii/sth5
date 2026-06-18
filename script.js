// script.js
// Automatic series embed detection (uses same approach as movies)
// Replace your existing script.js with this file.

const TMDB_API_KEY = "35ee82bcad013e6a6237a0a087d7eb32";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

// Base that worked for movies in your app
const EMBED_BASE = "https://embedmaster.link";

// LocalStorage key for saved TV pattern
const TV_PATTERN_KEY = "pepsi_tv_embed_pattern_v2";

// DOM refs (assumes your index.html uses the same IDs)
const player = document.getElementById("player");
const playerStatus = document.getElementById("playerStatus");
const patternInfo = document.getElementById("patternInfo");
const seriesError = document.getElementById("seriesError");

const seasonSelect = document.getElementById("seasonSelect");
const episodeSelect = document.getElementById("episodeSelect");
const playEpisodeBtn = document.getElementById("playEpisodeBtn");

// state
let currentTmdbId = null;
let currentImdbId = null;
let currentSeasons = [];
let currentEpisodes = [];
let trying = false;

// Candidate patterns (ordered). Patterns use placeholders:
// {imdb} = imdb id like tt0903747
// {tmdb} = numeric tmdb tv id
// {s} = season number (normalized)
// {e} = episode number (normalized)
// {player_id} = 16-char alphanumeric
const CANDIDATE_PATTERNS = [
  // IMDb-first patterns (common)
  "/player/tv/{imdb}/{s}/{e}?player_id={player_id}",
  "/tv/{imdb}/season/{s}/episode/{e}?player_id={player_id}",
  "/player/tv/{imdb}/{s}/{e}",
  "/tv/{imdb}/season/{s}/episode/{e}",

  // TMDB numeric id patterns (fallback)
  "/player/tv/{tmdb}/{s}/{e}?player_id={player_id}",
  "/tv/{tmdb}/season/{s}/episode/{e}?player_id={player_id}",
  "/player/tv/{tmdb}/{s}/{e}",
  "/tv/{tmdb}/season/{s}/episode/{e}",

  // Query-style variants
  "/watch/{tmdb}?season={s}&episode={e}&player_id={player_id}",
  "/watch/{imdb}?season={s}&episode={e}&player_id={player_id}",

  // Simple tv page fallbacks
  "/tv/{imdb}",
  "/tv/{tmdb}"
];

// --------------------
// Utility helpers
// --------------------
function generatePlayerId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function setPlayerSrc(url) {
  try {
    player.src = url;
    playerStatus && (playerStatus.textContent = `Loading: ${url}`);
  } catch (err) {
    console.error("setPlayerSrc error", err);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Robust season/episode normalization: accepts "S01", "Season 1", "01", "1", "0"
function normalizeNumberInput(val) {
  if (val === undefined || val === null) return null;
  const raw = String(val).trim();
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  let digits = m[1].replace(/^0+(?=\d)/, ""); // strip leading zeros but keep "0"
  if (digits === "") digits = "0";
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  return String(n);
}

// Build URL from pattern and placeholders
function buildUrl(pattern, { imdb, tmdb, s, e }) {
  const player_id = generatePlayerId();
  let url = pattern
    .replace(/{imdb}/g, imdb || "")
    .replace(/{tmdb}/g, tmdb || "")
    .replace(/{s}/g, s || "")
    .replace(/{e}/g, e || "")
    .replace(/{player_id}/g, player_id);

  if (url.startsWith("/")) url = EMBED_BASE + url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith(EMBED_BASE)) {
    url = EMBED_BASE + (url.startsWith("/") ? url : "/" + url);
  }

  // ensure player_id present for /player/tv/... if not already
  if (/\/player\/tv\/[^\/]+\/\d+\/\d+/.test(url) && !/player_id=/.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}player_id=${player_id}`;
  }
  return url;
}

// Wait for iframe load or detect cross-origin as success
function waitForIframeLoadOrDetect(timeout = 2500) {
  return new Promise(resolve => {
    let done = false;
    function success() { if (!done) { done = true; resolve(true); } }
    function fail() { if (!done) { done = true; resolve(false); } }

    const onLoad = () => {
      try {
        const doc = player.contentDocument || player.contentWindow.document;
        const title = (doc && doc.title) ? doc.title.toLowerCase() : "";
        if (title.includes("404") || title.includes("not found") || title.includes("page not found")) {
          fail();
        } else {
          success();
        }
      } catch (err) {
        // cross-origin -> treat as success (real player)
        success();
      }
    };

    const onError = () => fail();

    player.addEventListener("load", onLoad, { once: true });
    player.addEventListener("error", onError, { once: true });

    setTimeout(() => {
      if (done) return;
      try {
        const doc = player.contentDocument || player.contentWindow.document;
        const title = (doc && doc.title) ? doc.title.toLowerCase() : "";
        if (title.includes("404") || title.includes("not found") || title.includes("page not found")) {
          fail();
        } else {
          success();
        }
      } catch (err) {
        success();
      }
    }, timeout);
  });
}

// --------------------
// Main detection flow
// --------------------
async function detectAndPlay({ seasonRaw, episodeRaw }) {
  if (trying) return;
  trying = true;
  seriesError.style.display = "none";

  const s = normalizeNumberInput(seasonRaw);
  const e = normalizeNumberInput(episodeRaw);
  if (s === null) {
    showSeriesError("Invalid season. Use Season 1, S01, 1, or 0.");
    trying = false;
    return;
  }
  if (e === null) {
    showSeriesError("Invalid episode. Use Episode 1, 01, or 1.");
    trying = false;
    return;
  }

  // If user saved a working pattern, use it immediately
  const savedPattern = localStorage.getItem(TV_PATTERN_KEY);
  if (savedPattern) {
    const url = buildUrl(savedPattern, { imdb: currentImdbId, tmdb: currentTmdbId, s, e });
    setPlayerSrc(url);
    patternInfo && (patternInfo.textContent = `Using saved pattern: ${savedPattern}`);
    trying = false;
    return;
  }

  // Try candidate patterns in order
  for (const pattern of CANDIDATE_PATTERNS) {
    // skip imdb patterns if we don't have imdb id
    if (pattern.includes("{imdb}") && !currentImdbId) continue;
    // skip tmdb patterns if we don't have tmdb id
    if (pattern.includes("{tmdb}") && !currentTmdbId) continue;

    const url = buildUrl(pattern, { imdb: currentImdbId, tmdb: currentTmdbId, s, e });
    setPlayerSrc(url);

    // wait for load/detect
    const ok = await waitForIframeLoadOrDetect(2800);
    if (ok) {
      // Save the working pattern (store the pattern string)
      localStorage.setItem(TV_PATTERN_KEY, pattern);
      patternInfo && (patternInfo.textContent = `Saved working pattern: ${pattern}`);
      playerStatus && (playerStatus.textContent = `Pattern matched: ${pattern}`);
      trying = false;
      return;
    }
    // else try next
  }

  // Nothing matched: set a reasonable fallback and show debug info
  const fallback = `${EMBED_BASE}/tv/${currentTmdbId || currentImdbId}/season/${s}/episode/${e}`;
  setPlayerSrc(fallback);
  showSeriesError(`Auto-detection failed. iframe src: ${player.src}`);
  playerStatus && (playerStatus.textContent = "Auto-detection failed — see iframe src above.");
  trying = false;
}

// --------------------
// Helpers to show errors
// --------------------
function showSeriesError(msg) {
  if (!seriesError) return;
  seriesError.textContent = msg;
  seriesError.style.display = "block";
}

// --------------------
// Integration points (these functions assume your index.html wiring)
// --------------------

// Call this when opening a series panel (pass TMDB tv id)
async function openSeries(tvId) {
  currentTmdbId = tvId;
  currentImdbId = null;
  patternInfo && (patternInfo.textContent = "");
  seriesError && (seriesError.style.display = "none");

  // fetch details + external ids
  const [details, external] = await Promise.all([
    fetchJson(`${TMDB_BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`),
    fetchJson(`${TMDB_BASE}/tv/${tvId}/external_ids?api_key=${TMDB_API_KEY}`)
  ]);

  if (!details) {
    showSeriesError("Failed to load series details from TMDB.");
    return;
  }

  if (external && external.imdb_id) {
    currentImdbId = external.imdb_id; // e.g., "tt0903747"
    patternInfo && (patternInfo.textContent = `IMDb id: ${currentImdbId}`);
  } else {
    patternInfo && (patternInfo.textContent = `No IMDb id; will try TMDB patterns.`);
  }

  // populate seasons and episodes UI (assumes seasonSelect/episodeSelect exist)
  currentSeasons = (details.seasons || []).filter(s => typeof s.season_number === "number");
  currentSeasons.sort((a,b) => a.season_number - b.season_number);
  seasonSelect && (seasonSelect.innerHTML = "");
  currentSeasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = String(Number(s.season_number));
    opt.textContent = `Season ${s.season_number}${s.name ? ` - ${s.name}` : ""}`;
    seasonSelect.appendChild(opt);
  });

  if (currentSeasons.length) {
    // load first season episodes
    await loadSeasonEpisodes(tvId, currentSeasons[0].season_number);
  }
}

// load episodes for a season
async function loadSeasonEpisodes(tvId, seasonNumber) {
  seriesError && (seriesError.style.display = "none");
  episodeSelect && (episodeSelect.innerHTML = "");
  episodeList && (episodeList.innerHTML = "<p>Loading episodes…</p>");

  const seasonNum = normalizeNumberInput(seasonNumber);
  if (seasonNum === null) {
    showSeriesError("Invalid season selected.");
    return;
  }

  const data = await fetchJson(`${TMDB_BASE}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=en-US`);
  if (!data) {
    showSeriesError("Failed to load season data.");
    episodeList && (episodeList.innerHTML = "");
    return;
  }

  currentEpisodes = data.episodes || [];
  episodeList && (episodeList.innerHTML = "");
  episodeSelect && (episodeSelect.innerHTML = "");

  currentEpisodes.forEach(ep => {
    const epNum = Number(ep.episode_number);
    const opt = document.createElement("option");
    opt.value = String(epNum);
    opt.textContent = `${epNum}. ${ep.name || `Episode ${epNum}`}`;
    episodeSelect.appendChild(opt);

    if (episodeList) {
      const item = document.createElement("div");
      item.className = "episode-item";
      item.innerHTML = `<strong>${epNum}. ${escapeHtml(ep.name || `Episode ${epNum}`)}</strong><div class="muted">${escapeHtml(ep.overview || "")}</div>`;
      item.addEventListener("click", () => {
        seasonSelect.value = String(seasonNum);
        episodeSelect.value = String(epNum);
        // preview in iframe (no detection) — user should press Play to auto-detect and save
        const previewUrl = currentImdbId
          ? `${EMBED_BASE}/tv/${currentImdbId}/season/${seasonNum}/episode/${epNum}`
          : `${EMBED_BASE}/tv/${tvId}/season/${seasonNum}/episode/${epNum}`;
        setPlayerSrc(previewUrl);
        playerStatus && (playerStatus.textContent = "Preview set — press Play to auto-detect working pattern.");
      });
      episodeList.appendChild(item);
    }
  });

  episodeSelect.selectedIndex = 0;
  episodeList && (episodeList.scrollTop = 0);
}

// small fetch helper
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchJson error", err, url);
    return null;
  }
}

// Wire Play button (assumes seasonSelect and episodeSelect exist)
if (playEpisodeBtn) {
  playEpisodeBtn.addEventListener("click", () => {
    const seasonRaw = seasonSelect ? seasonSelect.value : null;
    const episodeRaw = episodeSelect ? episodeSelect.value : null;
    detectAndPlay({ seasonRaw, episodeRaw });
  });
}

// Expose openSeries for your existing click handlers to call
window.openSeries = openSeries;

// End of script.js
