import { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  Tv,
  Film,
  AlertCircle,
  History,
  Bookmark,
  Calendar,
  Star,
  Play,
  Info,
  MessagesSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MediaItem, WatchHistoryItem, WatchlistItem } from "./types";
import { smartFetch } from "./api";
import MovieCard from "./components/MovieCard";
import MovieCarousel from "./components/MovieCarousel";
import VideoPlayer from "./components/VideoPlayer";
import DetailModal from "./components/DetailModal";

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<"home" | "movies" | "series" | "watchlist" | "history">("home");
  
  // Data lists
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [popularTV, setPopularTV] = useState<MediaItem[]>([]);
  const [scifiMovies, setScifiMovies] = useState<MediaItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MediaItem[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<MediaItem[]>([]);
  const [spotlightItem, setSpotlightItem] = useState<MediaItem | null>(null);

  // User States (Persisted)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Active overlays/viewer
  const [activePlayerItem, setActivePlayerItem] = useState<MediaItem | null>(null);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<MediaItem | null>(null);
  const [showInfoDropdown, setShowInfoDropdown] = useState(false);

  // System general logs/states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const theaterRef = useRef<HTMLDivElement>(null);

  // Load local watchlist & history
  useEffect(() => {
    try {
      const persistedWatchlist = localStorage.getItem("cinestream_watchlist");
      if (persistedWatchlist) {
        setWatchlist(JSON.parse(persistedWatchlist));
      }
      const persistedHistory = localStorage.getItem("cinestream_history");
      if (persistedHistory) {
        setWatchHistory(JSON.parse(persistedHistory));
      }
    } catch (e) {
      console.error("Local storage sync error:", e);
    }
  }, []);

  // Fetch initial content feed on load
  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [trendingRes, tvRes, scifiRes, actionRes, horrorRes] = await Promise.all([
          smartFetch("/api/trending?type=movie"),
          smartFetch("/api/trending?type=tv"),
          smartFetch("/api/discover?type=movie&genres=878"), // Sci-Fi
          smartFetch("/api/discover?type=movie&genres=28"),  // Action
          smartFetch("/api/discover?type=movie&genres=27"),  // Horror
        ]);

        if (!trendingRes.ok || !tvRes.ok || !scifiRes.ok) {
          throw new Error("Could not load the catalog feed.");
        }

        const trendingData = await trendingRes.json();
        const tvData = await tvRes.json();
        const scifiData = await scifiRes.json();
        const actionData = await actionRes.json();
        const horrorData = await horrorRes.json();

        const moviesList = trendingData.results || [];
        setTrendingMovies(moviesList);
        setPopularTV(tvData.results || []);
        setScifiMovies(scifiData.results || []);
        setActionMovies(actionData.results || []);
        setHorrorMovies(horrorData.results || []);

        // Pick top trending movie as spotlight hero banner with fallback details fetch
        if (moviesList.length > 0) {
          const topItem = moviesList[0];
          fetchFullDetails(topItem.id, "movie", true);
        }
      } catch (err: any) {
        console.error("Content loading error:", err);
        setErrorMsg("Failed to connect to the movie database. Please check your network connection or API Key configured.");
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, []);

  // Real-time search processing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchLoading(true);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await smartFetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter items with post paths to maintain visual standard
          const filtered = (data.results || []).filter(
            (item: MediaItem) => item.poster_path && (item.media_type === "movie" || item.media_type === "tv")
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 450);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Fetch full details of movie/tv (including runtime, imdb_id, cast details, etc)
  const fetchFullDetails = async (id: number, type: "movie" | "tv", isSpotlight = false) => {
    try {
      const res = await smartFetch(`/api/${type}/${id}`);
      if (res.ok) {
        const fullItemDetails = await res.json();
        fullItemDetails.media_type = type;

        if (isSpotlight) {
          setSpotlightItem(fullItemDetails);
        } else {
          setSelectedDetailsItem(fullItemDetails);
        }
      }
    } catch (err) {
      console.error("Details loading error:", err);
    }
  };

  // Toggle watchlist
  const handleToggleWatchlist = (item: MediaItem) => {
    const isTv = item.first_air_date !== undefined;
    const itemType = item.media_type || (isTv ? "tv" : "movie");
    const exists = watchlist.some((w) => w.mediaId === item.id);
    let updated;

    if (exists) {
      updated = watchlist.filter((w) => w.mediaId !== item.id);
    } else {
      const newItem: WatchlistItem = {
        mediaId: item.id,
        title: item.title || item.name || "Untitled",
        posterPath: item.poster_path,
        mediaType: itemType as "movie" | "tv",
        backdropPath: item.backdrop_path,
        voteAverage: item.vote_average,
        releaseDate: item.release_date || item.first_air_date
      };
      updated = [newItem, ...watchlist];
    }

    setWatchlist(updated);
    localStorage.setItem("cinestream_watchlist", JSON.stringify(updated));
  };

  // Handle watch history
  const handleUpdateHistory = (newHistoryItem: WatchHistoryItem) => {
    const filtered = watchHistory.filter((h) => h.mediaId !== newHistoryItem.mediaId);
    const updated = [newHistoryItem, ...filtered].slice(0, 20);
    setWatchHistory(updated);
    localStorage.setItem("cinestream_history", JSON.stringify(updated));
  };

  // Clear watchlist
  const handleClearWatchlist = () => {
    setWatchlist([]);
    localStorage.removeItem("cinestream_watchlist");
  };

  // Clear history
  const handleClearHistory = () => {
    setWatchHistory([]);
    localStorage.removeItem("cinestream_history");
  };

  // Start video playback
  const startPlayback = async (item: MediaItem) => {
    const isTv = item.first_air_date !== undefined;
    const itemType = item.media_type || (isTv ? "tv" : "movie");

    try {
      const response = await smartFetch(`/api/${itemType}/${item.id}`);
      if (response.ok) {
        const fullItem = await response.json();
        fullItem.media_type = itemType;
        setActivePlayerItem(fullItem);
        setTimeout(() => {
          theaterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } catch (e) {
      console.error("Playback load error, default item loaded instead:", e);
      setActivePlayerItem(item);
    }
  };

  const watchlistMediaIds = watchlist.map((w) => w.mediaId);

  // Render search-results or primary content carousels
  const renderHomeFeeds = () => {
    if (isSearching) {
      return (
        <div id="searching-matrix-overlay" className="px-4 md:px-12 py-10">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-4 mb-8">
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-white">
              Search Results for: &ldquo;{searchQuery}&rdquo;
            </h2>
            {searchLoading ? (
              <span className="text-xs text-neutral-500 animate-pulse">(Searching Catalog...)</span>
            ) : (
              <span className="text-xs text-neutral-500">({searchResults.length} matches found)</span>
            )}
          </div>

          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center rounded-lg border border-neutral-800 bg-neutral-900/30">
              <AlertCircle className="w-12 h-12 text-neutral-600 mb-4" />
              <p className="text-sm text-neutral-400">
                No titles match your search.
              </p>
              <button
                id="btn-search-clear-hint"
                onClick={() => setSearchQuery("")}
                className="mt-4 text-xs font-semibold text-[#e50914] hover:underline"
              >
                Clear Search Query
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 justify-items-center">
              {searchResults.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isInWatchlist={watchlistMediaIds.includes(item.id)}
                  onSelect={(i) => fetchFullDetails(i.id, i.media_type || (i.first_air_date ? "tv" : "movie"))}
                  onPlay={startPlayback}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div id="cinematic-carousels-container" className="space-y-4">
        {/* Continue Watching Section if watch history is not empty */}
        {watchHistory.length > 0 && (
          <div className="my-6 px-4 md:px-12 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg md:text-xl font-bold tracking-tight text-white/95">
                Continue Watching
              </h3>
              <button
                id="btn-clear-complete-history"
                onClick={handleClearHistory}
                className="text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1 rounded"
              >
                Clear History
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 pr-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {watchHistory.map((item) => {
                const dummyMedia: MediaItem = {
                  id: item.mediaId,
                  title: item.mediaType === "movie" ? item.title : undefined,
                  name: item.mediaType === "tv" ? item.title : undefined,
                  poster_path: item.posterPath,
                  backdrop_path: null,
                  media_type: item.mediaType,
                  overview: "Playback history track item",
                  genre_ids: [],
                  popularity: 1,
                  vote_average: item.progressPercent / 10,
                  vote_count: 1
                };

                return (
                  <div key={item.mediaId} className="relative group/history shrink-0 w-36 md:w-44">
                    <div className="h-52 md:h-60 rounded-md overflow-hidden relative border border-neutral-800 hover:border-white transition-all duration-300 cursor-pointer bg-neutral-900 shadow-lg">
                      <img
                        src={item.posterPath ? `https://image.tmdb.org/t/p/w185${item.posterPath}` : "https://images.unsplash.com/photo-1542204172-e7052809a86e?q=80&w=150"}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 group-hover/history:bg-black/45 transition-colors flex flex-col justify-end p-2.5">
                        <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded w-fit font-bold mb-1 uppercase">
                          {item.mediaType === "tv" ? "TV Show" : "Movie"}
                        </span>
                        
                        <h4 className="text-[11px] font-bold text-white tracking-tight line-clamp-1 mb-1 font-sans">
                          {item.title}
                        </h4>

                        {item.lastSeason && (
                          <span className="text-[10px] text-neutral-400 block mb-1">
                            S{item.lastSeason} Ep {item.lastEpisode}
                          </span>
                        )}

                        {/* Progress Bar resembling Netflix standard styling */}
                        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full bg-[#e50914] rounded-full"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Resume Button on hover */}
                    <button
                      id={`btn-resume-history-${item.mediaId}`}
                      onClick={() => startPlayback(dummyMedia)}
                      className="absolute inset-0 bg-black/75 opacity-0 group-hover/history:opacity-100 flex items-center justify-center transition-opacity duration-300 rounded-md"
                    >
                      <span className="flex items-center gap-1.5 bg-white text-black text-xs font-bold py-2 px-3.5 rounded shadow-lg">
                        Resume
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories carousels */}
        {activeTab === "home" && (
          <>
            <MovieCarousel
              title="Trending Now"
              items={trendingMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Popular TV Shows"
              items={popularTV}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "tv")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Sci-Fi & Fantasy"
              items={scifiMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Action Hits"
              items={actionMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Horror & Chill"
              items={horrorMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </>
        )}

        {activeTab === "movies" && (
          <>
            <MovieCarousel
              title="Trending Movies"
              items={trendingMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Action Movies"
              items={actionMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Sci-Fi Movies"
              items={scifiMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
            <MovieCarousel
              title="Horror Movies"
              items={horrorMovies}
              watchlist={watchlistMediaIds}
              onSelect={(i) => fetchFullDetails(i.id, "movie")}
              onPlay={startPlayback}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </>
        )}

        {activeTab === "series" && (
          <MovieCarousel
            title="Premium Television Series"
            items={popularTV}
            watchlist={watchlistMediaIds}
            onSelect={(i) => fetchFullDetails(i.id, "tv")}
            onPlay={startPlayback}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}
      </div>
    );
  };

  // Render My List View
  const renderWatchlistView = () => {
    if (watchlist.length === 0) {
      return (
        <div className="px-4 md:px-12 py-24 text-center max-w-md mx-auto">
          <Bookmark className="w-14 h-14 mx-auto text-neutral-700 stroke-1 mb-4" />
          <h2 className="font-sans text-lg font-bold text-neutral-300 uppercase tracking-wider mb-2">
            Your List is Empty
          </h2>
          <p className="text-sm text-neutral-500">
            Save movies and TV shows and find them here easily anytime.
          </p>
          <button
            id="btn-return-home-watchlist"
            onClick={() => setActiveTab("home")}
            className="mt-6 font-semibold text-sm text-[#e50914] border border-[#e50914]/20 hover:border-[#e50914] px-5 py-2.5 rounded transition-all duration-300 hover:bg-[#e50914]/10"
          >
            Explore Titles
          </button>
        </div>
      );
    }

    return (
      <div id="watchlist-grid-view" className="px-4 md:px-12 py-8">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-8">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              My List
            </h2>
          </div>
          <button
            id="btn-clear-complete-watchlist"
            onClick={handleClearWatchlist}
            className="text-xs text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-805 px-3 py-1.5 rounded"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 justify-items-center">
          {watchlist.map((w) => {
            const dummyMedia: MediaItem = {
              id: w.mediaId,
              title: w.mediaType === "movie" ? w.title : undefined,
              name: w.mediaType === "tv" ? w.title : undefined,
              poster_path: w.posterPath,
              backdrop_path: w.backdropPath,
              media_type: w.mediaType,
              overview: "Your saved listing.",
              genre_ids: [],
              popularity: 1,
              vote_average: w.voteAverage,
              vote_count: 1,
              release_date: w.mediaType === "movie" ? w.releaseDate : undefined,
              first_air_date: w.mediaType === "tv" ? w.releaseDate : undefined
            };

            return (
              <MovieCard
                key={w.mediaId}
                item={dummyMedia}
                isInWatchlist={watchlistMediaIds.includes(w.mediaId)}
                onSelect={(i) => fetchFullDetails(i.id, i.media_type || "movie")}
                onPlay={startPlayback}
                onToggleWatchlist={handleToggleWatchlist}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Render History View
  const renderHistoryView = () => {
    if (watchHistory.length === 0) {
      return (
        <div className="px-4 md:px-12 py-24 text-center max-w-md mx-auto">
          <History className="w-14 h-14 mx-auto text-neutral-700 stroke-1 mb-4" />
          <h2 className="font-sans text-lg font-bold text-neutral-300 uppercase tracking-wider mb-2">
            No Watch History
          </h2>
          <p className="text-sm text-neutral-400">
            Start playing films or TV broadcasts to list your content log here.
          </p>
        </div>
      );
    }

    return (
      <div id="history-logs-terminal" className="px-4 md:px-12 py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-8">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Watch History
            </h2>
          </div>
          <button
            id="btn-clear-complete-history-full"
            onClick={handleClearHistory}
            className="text-xs text-neutral-400 hover:text-white bg-[#1a1a20] border border-neutral-800 px-3 py-1.5 rounded"
          >
            Clear History Logs
          </button>
        </div>

        <div className="space-y-4">
          {watchHistory.map((item) => {
            const dateStr = new Date(item.timestamp).toLocaleString();
            const dummyMedia: MediaItem = {
              id: item.mediaId,
              title: item.mediaType === "movie" ? item.title : undefined,
              name: item.mediaType === "tv" ? item.title : undefined,
              poster_path: item.posterPath,
              backdrop_path: null,
              media_type: item.mediaType,
              overview: "History reference coordinate logs",
              genre_ids: [],
              popularity: 1,
              vote_average: item.progressPercent / 10,
              vote_count: 1
            };

            return (
              <div
                key={item.mediaId}
                className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-neutral-800 bg-[#181818] hover:border-neutral-700 rounded-md transition-all duration-200 text-left"
              >
                <div className="w-14 shrink-0 aspect-[2/3] rounded overflow-hidden bg-neutral-900 border border-neutral-800">
                  <img
                    src={item.posterPath ? `https://image.tmdb.org/t/p/w185${item.posterPath}` : "https://images.unsplash.com/photo-1542204172-e7052809a86e?q=80&w=150"}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-green-500 mr-2">
                    {item.progressPercent}% Watched
                  </span>
                  
                  <span className="text-[10px] uppercase bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-bold">
                    {item.mediaType === "tv" ? "TV Show" : "Movie"}
                  </span>
                  
                  <h3 className="text-sm font-bold text-white mt-1.5 truncate">
                    {item.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-neutral-500">
                    {item.lastSeason && (
                      <span>Season {item.lastSeason}, Episode {item.lastEpisode}</span>
                    )}
                    <span>Last stream: {dateStr}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`btn-history-play-${item.mediaId}`}
                    onClick={() => startPlayback(dummyMedia)}
                    className="bg-[#e50914] text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-[#b80710] transition-colors"
                  >
                    Resume
                  </button>
                  
                  <button
                    id={`btn-history-delete-${item.mediaId}`}
                    onClick={() => {
                      const updated = watchHistory.filter((h) => h.mediaId !== item.mediaId);
                      setWatchHistory(updated);
                      localStorage.setItem("cinestream_history", JSON.stringify(updated));
                    }}
                    className="border border-[#32323c] text-neutral-400 hover:text-white hover:border-neutral-500 px-3 py-1.5 rounded text-xs transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#141414] text-white">
      
      {/* Upper Error Banner */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#b80710] py-2.5 px-4 text-center text-xs font-semibold text-white relative z-50 flex items-center justify-center gap-2 shadow"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Community & Support Header Bar */}
      <div className="bg-[#0b0b0d] border-b border-neutral-900 px-4 md:px-12 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-50">
        <div className="flex items-center gap-3">
          <a
            id="btn-support-dev"
            href="https://paypal.me/pepcolaa"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded transition-all duration-150 cursor-pointer text-[11px] shadow-sm rounded-sm"
          >
            Support developer Pepsi &lt;3
          </a>
        </div>

        <div className="flex items-center gap-2.5 relative">
          <a
            id="btn-discord-invite"
            href="https://discord.gg/pepflicks"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded transition-all duration-150 cursor-pointer text-[11px] shadow-sm rounded-sm"
          >
            <MessagesSquare className="w-3.5 h-3.5" />
            Discord
          </a>

          {/* Info dropdown launcher */}
          <div className="relative">
            <button
              id="btn-info-dropdown-toggle"
              onClick={() => setShowInfoDropdown(!showInfoDropdown)}
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 hover:text-white font-bold rounded transition-all duration-150 cursor-pointer text-[11px] border border-neutral-750 rounded-sm"
            >
              <Info className="w-3.5 h-3.5" />
              Info
            </button>

            {/* Absolute info dropdown panel */}
            <AnimatePresence>
              {showInfoDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 bg-neutral-950 border border-neutral-800 rounded shadow-2xl p-4 z-50 text-left cursor-default text-neutral-300"
                >
                  <h4 className="text-sm font-bold text-white mb-2 pb-1 border-b border-neutral-800">
                    How to Use Pep Flick
                  </h4>
                  <ul className="space-y-2 text-[11px] leading-relaxed">
                    <li>
                      <span className="font-bold text-white">🎬 Watch Content:</span> Hover over or click any movie/show card, then click <span className="text-[#e50914] font-semibold">Play</span> or <span className="text-[#e50914] font-semibold">Watch</span> to launch the high-quality inline player.
                    </li>
                    <li>
                      <span className="font-bold text-white">🔍 Instant Search:</span> Type in the search input to instantly discover movies or series in our database.
                    </li>
                    <li>
                      <span className="font-bold text-white">➕ My List:</span> Save the movies or TV series you want to track by clicking the bookmark/watchlist buttons.
                    </li>
                    <li>
                      <span className="font-bold text-white">📺 Series Episodes:</span> For TV shows, you can easily filter by season and select individual episodes inside the episode drawer.
                    </li>
                  </ul>
                  <button
                    id="btn-info-dropdown-close"
                    onClick={() => setShowInfoDropdown(false)}
                    className="mt-3.5 w-full bg-neutral-800 hover:bg-neutral-750 text-neutral-200 py-1 rounded text-xs transition-colors font-semibold"
                  >
                    Got it!
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Navigation Row */}
      <nav id="satellite-nav-node" className="sticky top-0 z-40 bg-[#141414]/95 border-b border-neutral-800/40 backdrop-blur-md py-4 px-4 md:px-12 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Brand */}
        <div
          onClick={() => {
            setActiveTab("home");
            setIsSearching(false);
            setSearchQuery("");
          }}
          className="flex items-center gap-2 cursor-pointer group shrink-0"
        >
          <span className="font-sans font-black text-2xl tracking-tighter text-[#e50914] uppercase">
            pepflick
          </span>
        </div>

        {/* Tab Controls */}
        <div id="nav-terminals" className="flex items-center gap-1 bg-black/40 p-1 rounded-md border border-neutral-800/60 max-w-full overflow-x-auto">
          {[
            { tag: "home", label: "Home" },
            { tag: "movies", label: "Movies" },
            { tag: "series", label: "TV Shows" },
            { tag: "watchlist", label: "My List" },
            { tag: "history", label: "History" },
          ].map((tab) => {
            const isTabActive = activeTab === tab.tag && !isSearching;
            return (
              <button
                key={tab.tag}
                id={`btn-nav-tab-${tab.tag}`}
                onClick={() => {
                  setActiveTab(tab.tag as any);
                  setIsSearching(false);
                  setSearchQuery("");
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all duration-150 shrink-0 ${
                  isTabActive
                    ? "bg-[#e50914] text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div className="flex items-center gap-4 w-full md:w-60 relative shrink-0">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-input-field"
              type="text"
              placeholder="Search movies, shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181814]/10 bg-neutral-900 border border-neutral-800 focus:border-[#e50914] focus:outline-none rounded py-1.5 pl-9 pr-8 text-xs text-white placeholder-neutral-500 transition-all focus:ring-1 focus:ring-[#e50914]/20"
            />
            {searchQuery && (
              <button
                id="btn-search-clear-input"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
              >
                ✖
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Embedded Theater Stream */}
      <div ref={theaterRef}>
        <AnimatePresence>
          {activePlayerItem && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <VideoPlayer
                item={activePlayerItem}
                onClose={() => setActivePlayerItem(null)}
                onUpdateHistory={handleUpdateHistory}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Featured Banner Display */}
      {!loading && !errorMsg && !isSearching && activeTab === "home" && spotlightItem && (
        <div
          id="spotlight-hero-banner"
          className="relative w-full aspect-[21/9] min-h-[380px] md:min-h-[460px] flex items-end p-6 md:p-14 overflow-hidden"
        >
          {/* Backdrop back-plate */}
          <div className="absolute inset-0 z-0">
            <img
              src={
                spotlightItem.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${spotlightItem.backdrop_path}`
                  : `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200`
              }
              alt={spotlightItem.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {/* Dark mask transitions */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#141414] via-[#141414]/30 to-transparent hidden md:block" />
          </div>

          <div className="max-w-2xl relative z-10 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1 text-[10px] font-bold bg-[#e50914] text-white px-2 py-0.5 rounded shadow">
                <Sparkles className="w-3 h-3 fill-white stroke-none shrink-0" />
                Featured Selection
              </span>
              <span className="text-[11px] text-neutral-300 font-medium">
                {(spotlightItem.release_date || spotlightItem.first_air_date || "2026").substring(0, 4)}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-5.5xl font-extrabold text-white tracking-tight leading-tight uppercase mb-3">
              {spotlightItem.title || spotlightItem.name}
            </h1>

            {spotlightItem.tagline && (
              <p className="text-sm text-neutral-200 mt-1 mb-3.5 italic">
                &ldquo;{spotlightItem.tagline}&rdquo;
              </p>
            )}

            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-sans mb-6 line-clamp-3 md:line-clamp-4 max-w-xl">
              {spotlightItem.overview}
            </p>

            {/* Quick Play & Details Actions */}
            <div id="spotlight-actions" className="flex flex-wrap items-center gap-3">
              <button
                id="btn-play-spotlight"
                onClick={() => startPlayback(spotlightItem)}
                className="flex items-center gap-1.5 bg-white text-black hover:bg-[#e50914] hover:text-white px-6 py-2.5 rounded font-bold text-xs tracking-wide transition-all duration-200 cursor-pointer shadow-lg"
              >
                <Play className="w-4.5 h-4.5 fill-current stroke-current" />
                Play
              </button>

              <button
                id="btn-info-spotlight"
                onClick={() => setSelectedDetailsItem(spotlightItem)}
                className="flex items-center gap-1.5 border border-neutral-700 bg-black/40 hover:bg-neutral-800 text-white px-5 py-2.5 rounded font-bold text-xs transition-all duration-200"
              >
                More Info
              </button>

              <button
                id="btn-watchlist-spotlight"
                onClick={() => handleToggleWatchlist(spotlightItem)}
                className={`p-2.5 rounded border transition-all duration-200 ${
                  watchlistMediaIds.includes(spotlightItem.id)
                    ? "bg-[#e50914] border-[#e50914] text-white"
                    : "border-neutral-700 bg-black/40 hover:border-white text-neutral-200"
                }`}
                title="Save to watchlist"
              >
                <Bookmark className={`w-4 h-4 ${watchlistMediaIds.includes(spotlightItem.id) ? "fill-white text-white" : "fill-transparent"}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Pages */}
      <main className="flex-1 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#e50914] border-t-transparent mb-4" />
            <p className="text-xs text-neutral-400">
              Loading recommendations...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <AlertCircle className="w-12 h-12 text-[#e50914] mb-3" />
            <h2 className="text-lg font-bold text-white text-center">
              Unable to Load Content
            </h2>
            <p className="text-sm text-neutral-400 mt-2 text-center max-w-sm leading-relaxed">
              {errorMsg}
            </p>
            <button
              id="btn-retry-feed"
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-[#1a1a20] border border-neutral-800 hover:border-neutral-500 rounded text-xs transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : activeTab === "watchlist" ? (
          renderWatchlistView()
        ) : activeTab === "history" ? (
          renderHistoryView()
        ) : (
          renderHomeFeeds()
        )}
      </main>

      {/* Detail Overlay modal */}
      <AnimatePresence>
        {selectedDetailsItem && (
          <DetailModal
            item={selectedDetailsItem}
            onClose={() => setSelectedDetailsItem(null)}
            onPlay={startPlayback}
            watchlist={watchlistMediaIds}
            onToggleWatchlist={handleToggleWatchlist}
            onSelectSimilar={(similarItem) => {
              const similarType = similarItem.media_type || (similarItem.first_air_date ? "tv" : "movie");
              fetchFullDetails(similarItem.id, similarType);
            }}
          />
        )}
      </AnimatePresence>

      <footer className="border-t border-neutral-900 bg-[#0c0c0e] py-10 px-4 md:px-12 text-center text-neutral-500 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs md:text-sm font-semibold text-neutral-450">Pep Flick</p>
            <p className="text-[11px] text-neutral-650 mt-1">This prototype uses TMDB catalog resources entirely frontend-side.</p>
          </div>
          <div className="text-right text-[11px]">
            <p>© 2026. All TMDB catalog items load securely client-side.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
