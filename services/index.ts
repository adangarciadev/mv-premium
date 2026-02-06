/**
 * Services Index
 * Central export for all API services
 * 
 * NOTE: All network requests go through the background script.
 * These services are pure RPC facades.
 */

// TMDB
export {
  // Image URLs (no API call needed)
  getPosterUrl,
  getBackdropUrl,
  // API Functions (via background)
  searchMovies,
  searchPeople,
  getUpcomingMovies,
  getNowPlayingMovies,
  getMovieDetails,
  getPersonDetails,
  getMovieCredits,
  getMovieVideos,
  getMovieReleaseDates,
  // Template
  getMovieTemplateData,
  generateTemplate,
} from './api/tmdb'

export type { 
  MovieTemplateData, 
  PosterSize, 
  BackdropSize 
} from './api/tmdb'

// ImgBB
export {
  // API Key (for UI management)
  getApiKey as getImgbbApiKey,
  // setApiKey and clearApiKey deprecated - useSettingsStore directly
  // Upload (via background)
  uploadImage,
  // Validation
  validateImageFile,
  formatBytes,
} from './api/imgbb'

export type { UploadResult } from '@/lib/messaging'

// Steam
export {
  extractSteamAppId,
  isSteamUrl,
  fetchSteamGameDetails,
  fetchSteamGameDetailsViaBackground,
} from './api/steam'

export type { SteamGameDetails } from './api/steam'

// AI Service
export {
  getAIService,
  testGeminiConnection,
  getAvailableModels,
} from './ai'

// Media Services
export {
  resolveUrl,
  parseUrl,
  isSupportedUrl,
  getCached,
  type MediaData,
} from './media'

// IGDB
export {
  hasIgdbCredentials,
  searchGames,
  getGameDetails,
  getGameTemplateData,
  generateGameTemplate,
  getGameTemplateString,
  getIGDBImageUrl,
} from './api/igdb'

export type { IGDBGame, IGDBCover, IGDBSearchResult, IGDBImageSize } from './api/igdb'

// NOTE: Mediavida DOM Scraper & API functions are in @/lib/mv-api
// Import directly from there instead of re-exporting here to avoid redundancy
