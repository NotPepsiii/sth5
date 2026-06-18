// script.js — MOVIES ONLY VERSION (cleaned, no series)

const TMDB_API_KEY = "35ee82bcad013e6a6237a0a087d7eb32";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

const HOSTS = [
  "https://embedmaster.link",
  "https://embedmaster.com",
  "https://player.embedmaster.link",
  "https://player.embedmaster.com"
];

// DOM
const player = document.getElementById("player");
const playerStatus = document.getElementById("playerStatus");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

const popularRow = document.getElementById("popularRow");
const topRatedRow = document.getElementById("topRatedRow");
const actionRow = document.getElementById("actionRow");
const horrorRow = document.getElementById("horrorRow");
const comedyRow = document.getElementById("comedyRow");

// STATE
let trying = false;

// INIT
document.addEventListener("DOMContentLoaded", () => {
  loadInitialRows();
  wireUI();
});

// UI
function wireUI() {
  searchBtn.addEventListener("click", () => {
    const q = searchInput.value.trim();
    if (!q) return;
    searchMovies(q);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBtn.click();
  });
}

// -------------------- LOADERS --------------------

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function loadInitialRows() {
  loadPopularMovies();
  loadTopRatedMovies();
  loadGenreMovies(28, actionRow);
  loadGenreMovies(27, horrorRow);
  loadGenreMovies(35, comedyRow);
}

async function loadPopularMovies() {
  const data = await fetchJson(`${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}`);
  renderRow(data?.results || popularRow, popularRow);
}

async function loadTopRatedMovies() {
  const data = await fetchJson(`${TMDB_BASE}/movie/top_rated?api_key=${TMDB_API_KEY}`);
  renderRow(data?.results || [], topRatedRow);
}

async function loadGenreMovies(genreId, container) {
  const data = await fetchJson(`${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}`);
  renderRow(data?.results || [], container);
}

// -------------------- SEARCH --------------------

async function searchMovies(query) {
  const data = await fetchJson(
    `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
  );

  const searchSection = document.getElementById("searchSection");
  const searchRow = document.getElementById("searchRow");

  searchSection.style.display = "block";
  renderRow(data?.results || [], searchRow);
}

// -------------------- RENDER --------------------

function renderRow(items, container) {
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = "<p>No results found.</p>";
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const posterPath = item.poster_path || item.backdrop_path;
    const poster = posterPath
      ? `${TMDB_IMG}${posterPath}`
      : "https://via.placeholder.com/300x450?text=No+Image";

    const title = item.title || "Untitled";
    const year = (item.release_date || "").slice(0, 4) || "N/A";
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

    card.innerHTML = `
      <img src="${poster}" alt="${title}">
      <div class="movie-info">
        <div class="movie-title">${title}</div>
        <div class="movie-meta">${year} • ⭐ ${rating}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      playMovie(item.id);
    });

    container.appendChild(card);
  });
}

// -------------------- PLAYER --------------------

function playMovie(tmdbId) {
  const url = `${HOSTS[0]}/movie/${tmdbId}`;
  setPlayer(url);
}

function setPlayer(url) {
  try {
    player.src = url;
    playerStatus.textContent = "Loading movie...";
  } catch (e) {
    console.error(e);
  }
}

// -------------------- UTIL --------------------

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
