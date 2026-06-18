const TMDB_API_KEY = "35ee82bcad013e6a6237a0a087d7eb32";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

// Main player (EmbedMaster)
const HOSTS = [
  "https://embedmaster.com"
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

// INIT
document.addEventListener("DOMContentLoaded", () => {
  loadAll();
  wireSearch();
});

// ---------------- SEARCH ----------------
function wireSearch() {
  searchBtn.onclick = () => {
    const q = searchInput.value.trim();
    if (!q) return;
    searchMovies(q);
  };

  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") searchBtn.click();
  });
}

// ---------------- FETCH ----------------
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch {
    return null;
  }
}

function tmdb(path) {
  return `${TMDB_BASE}${path}?api_key=${TMDB_API_KEY}&language=en-US`;
}

// ---------------- LOAD ROWS ----------------
async function loadAll() {
  render(await get("/movie/popular"), popularRow);
  render(await get("/movie/top_rated"), topRatedRow);
  render(await get("/discover/movie?with_genres=28"), actionRow);
  render(await get("/discover/movie?with_genres=27"), horrorRow);
  render(await get("/discover/movie?with_genres=35"), comedyRow);
}

async function get(path) {
  const data = await fetchJson(tmdb(path));
  return data?.results || [];
}

// ---------------- RENDER ----------------
function render(items, container) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = "<p>No results</p>";
    return;
  }

  items.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const img = movie.poster_path
      ? `${TMDB_IMG}${movie.poster_path}`
      : "https://via.placeholder.com/300x450?text=No+Image";

    const year = (movie.release_date || "").slice(0, 4) || "N/A";

    card.innerHTML = `
      <div class="card-wrap">
        <img src="${img}" alt="${movie.title}">
        
        <button class="play-btn">▶</button>

        <div class="movie-info">
          <div class="movie-title">${movie.title}</div>
          <div class="movie-meta">${year} • ⭐ ${movie.vote_average?.toFixed(1) || "N/A"}</div>
        </div>
      </div>
    `;

    // ▶ PLAY BUTTON (THIS IS THE FIX)
    card.querySelector(".play-btn").onclick = (e) => {
      e.stopPropagation();
      playMovie(movie);
    };

    // click card also plays
    card.onclick = () => playMovie(movie);

    container.appendChild(card);
  });
}

// ---------------- PLAY MOVIE ----------------
function playMovie(movie) {
  const url = `${HOSTS[0]}/movie/${movie.id}`;

  player.src = url;
  playerStatus.textContent = `Playing: ${movie.title}`;
}
