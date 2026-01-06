/**
 * Media Services Index
 * Unified resolver for TMDB/IMDb and caching utilities
 */

// Unified Resolver
export { 
  resolveUrl, 
  parseUrl, 
  isSupportedUrl,
  type MediaData 
} from './unified-resolver'

// Cache utilities
export { 
  getCached, 
  setCache, 
  removeCache, 
  clearCache,
  pruneCache,
  cachedFetch, 
  createCacheKey,
  CACHE_TTL 
} from './cache'
