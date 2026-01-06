/**
 * Simple cache system with TTL (Time-To-Live)
 * Used primarily for TMDB API responses to reduce network requests
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 */
import { storage } from '#imports'

interface CacheEntry<T> {
	data: T
	timestamp: number
	expiresAt: number
}

interface CacheOptions {
	/** Time to live in milliseconds (default: 5 minutes) */
	ttl?: number
	/** Storage key prefix (default: 'mv-cache') */
	prefix?: string
	/** Whether to persist to disk storage (default: true). Set to false for transient data like searches. */
	persist?: boolean
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
const DEFAULT_PREFIX = 'mv-cache'

// In-memory cache for session
const memoryCache = new Map<string, CacheEntry<unknown>>()

/**
 * Get item from cache (memory first, then storage fallback)
 */
export async function getCached<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
	const prefix = options.prefix ?? DEFAULT_PREFIX
	const fullKey = `${prefix}:${key}`
	const now = Date.now()

	// Check memory cache first (faster)
	const memEntry = memoryCache.get(fullKey) as CacheEntry<T> | undefined
	if (memEntry && memEntry.expiresAt > now) {
		return memEntry.data
	}

	// Fall back to storage for persistence across sessions
	try {
		const snapshot = await storage.snapshot('local')
		const stored = snapshot[fullKey]
		if (stored) {
			const entry = stored as CacheEntry<T>
			if (entry.expiresAt > now) {
				memoryCache.set(fullKey, entry)
				return entry.data
			}
			await storage.removeItem(`local:${fullKey}` as `local:${string}`)
		}
	} catch {
		// Ignore errors
	}

	// Clean up expired memory entry
	if (memEntry) {
		memoryCache.delete(fullKey)
	}

	return null
}

/**
 * Set item in cache (both memory and storage, unless persist=false)
 */
export async function setCache<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
	const prefix = options.prefix ?? DEFAULT_PREFIX
	const ttl = options.ttl ?? DEFAULT_TTL
	const persist = options.persist ?? true
	const fullKey = `${prefix}:${key}`
	const now = Date.now()

	const entry: CacheEntry<T> = {
		data,
		timestamp: now,
		expiresAt: now + ttl,
	}

	// Always write to memory cache
	memoryCache.set(fullKey, entry)

	// Only persist to storage if persist=true (default)
	if (persist) {
		try {
			await storage.setItem(`local:${fullKey}` as `local:${string}`, entry)
		} catch {
			// storage might be full or disabled, ignore
		}
	}
}

/**
 * Remove item from cache
 */
export async function removeCache(key: string, options: CacheOptions = {}): Promise<void> {
	const prefix = options.prefix ?? DEFAULT_PREFIX
	const fullKey = `${prefix}:${key}`

	memoryCache.delete(fullKey)
	try {
		await storage.removeItem(`local:${fullKey}` as `local:${string}`)
	} catch {
		// Ignore errors
	}
}

/**
 * Clear all cache entries with the given prefix
 */
export async function clearCache(options: CacheOptions = {}): Promise<void> {
	const prefix = options.prefix ?? DEFAULT_PREFIX

	for (const key of memoryCache.keys()) {
		if (key.startsWith(`${prefix}:`)) {
			memoryCache.delete(key)
		}
	}

	try {
		const snapshot = await storage.snapshot('local')
		const keysToRemove = Object.keys(snapshot).filter(key => key.startsWith(`${prefix}:`))
		if (keysToRemove.length > 0) {
			await Promise.all(keysToRemove.map(k => storage.removeItem(`local:${k}` as `local:${string}`)))
		}
	} catch {
		// Ignore errors
	}
}

/**
 * Prune expired cache entries with the given prefix (batch delete for efficiency)
 * Returns the number of entries pruned.
 */
export async function pruneCache(prefix: string): Promise<number> {
	const now = Date.now()
	let prunedCount = 0

	// Clean memory cache
	for (const [key, entry] of memoryCache.entries()) {
		if (key.startsWith(`${prefix}:`) && (entry as CacheEntry<unknown>).expiresAt < now) {
			memoryCache.delete(key)
			prunedCount++
		}
	}

	// Clean storage with batch delete
	try {
		const snapshot = await storage.snapshot('local')
		const expiredKeys: string[] = []

		for (const [key, value] of Object.entries(snapshot)) {
			if (key.startsWith(`${prefix}:`) && (value as CacheEntry<unknown>)?.expiresAt < now) {
				expiredKeys.push(key)
			}
		}

		if (expiredKeys.length > 0) {
			// Batch delete - all removals in parallel
			await Promise.all(expiredKeys.map(k => storage.removeItem(`local:${k}` as `local:${string}`)))
			prunedCount += expiredKeys.length
		}
	} catch {
		// Ignore errors
	}

	return prunedCount
}

/**
 * Fetch with caching - wrapper that caches the result of an async function
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
	const cached = await getCached<T>(key, options)
	if (cached !== null) {
		return cached
	}

	const data = await fetcher()
	await setCache(key, data, options)
	return data
}

/**
 * Create a cache key from multiple parts
 */
export function createCacheKey(...parts: (string | number)[]): string {
	return parts.join(':')
}

// Cache TTL presets
export const CACHE_TTL = {
	SHORT: 1 * 60 * 1000, // 1 minute
	MEDIUM: 5 * 60 * 1000, // 5 minutes
	LONG: 30 * 60 * 1000, // 30 minutes
	HOUR: 60 * 60 * 1000, // 1 hour
	DAY: 24 * 60 * 60 * 1000, // 24 hours
} as const
