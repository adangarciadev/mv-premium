/**
 * Mobile Store Search Service (Google Play / Apple App Store)
 *
 * Title-based fallback used when IGDB has no store links for a mobile game.
 * - App Store: iTunes Search API (official, free, JSON)
 * - Google Play: no official API; the store search page is fetched and the
 *   first app result is extracted from the HTML
 *
 * Uses in-memory cache only (no persistent storage).
 */
import { logger } from '@/lib/logger'

// =============================================================================
// Types
// =============================================================================

export interface MobileStoreSearchResult {
	/** Full store URL, ready for Mediavida [media] embeds */
	url: string
	/** Google Play package name or App Store numeric id */
	storeId: string
	/** App title as reported by the store (when available) */
	name: string | null
}

interface ItunesSearchResponse {
	results?: Array<{
		trackId?: number
		trackName?: string
		trackViewUrl?: string
	}>
}

// =============================================================================
// Cache (memory-only)
// =============================================================================

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const searchCache = new Map<string, { data: MobileStoreSearchResult | null; timestamp: number }>()

function getCachedSearch(key: string): MobileStoreSearchResult | null | undefined {
	const cached = searchCache.get(key)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data
	}
	if (cached) {
		searchCache.delete(key)
	}
	return undefined
}

function setCachedSearch(key: string, data: MobileStoreSearchResult | null): void {
	searchCache.set(key, { data, timestamp: Date.now() })
}

// =============================================================================
// Title matching
// =============================================================================

function normalizeStoreSearchName(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function isStrongTitleMatch(candidate: string, query: string): boolean {
	const normalizedCandidate = normalizeStoreSearchName(candidate)
	const normalizedQuery = normalizeStoreSearchName(query)
	if (!normalizedCandidate || !normalizedQuery) return false

	return (
		normalizedCandidate === normalizedQuery ||
		normalizedCandidate.startsWith(`${normalizedQuery} `) ||
		normalizedQuery.startsWith(`${normalizedCandidate} `)
	)
}

// =============================================================================
// App Store (iTunes Search API)
// =============================================================================

/**
 * Search the Apple App Store by title.
 *
 * @internal
 * USE ONLY IN BACKGROUND SCRIPT.
 * Do not import directly in UI components. Use searchItunesAppViaBackground.
 */
export async function searchItunesApp(query: string): Promise<MobileStoreSearchResult | null> {
	const trimmedQuery = query.trim()
	if (trimmedQuery.length < 3) return null

	const cacheKey = `itunes:${normalizeStoreSearchName(trimmedQuery)}`
	const cached = getCachedSearch(cacheKey)
	if (cached !== undefined) return cached

	try {
		const params = new URLSearchParams({
			term: trimmedQuery,
			entity: 'software',
			country: 'es',
			limit: '8',
		})
		const response = await fetch(`https://itunes.apple.com/search?${params}`)
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const json = (await response.json()) as ItunesSearchResponse
		const apps = (json.results || []).filter(item => item.trackId && item.trackViewUrl && item.trackName)

		// Only accept confident title matches to avoid attaching the wrong app.
		const match = apps.find(item => isStrongTitleMatch(item.trackName!, trimmedQuery))
		const result: MobileStoreSearchResult | null = match
			? { url: match.trackViewUrl!, storeId: String(match.trackId), name: match.trackName ?? null }
			: null

		setCachedSearch(cacheKey, result)
		return result
	} catch (error) {
		logger.error('[MobileStores] iTunes search failed:', error)
		return null
	}
}

// =============================================================================
// Google Play (store search page scraping)
// =============================================================================

const PLAY_PACKAGE_ID_REGEX = /\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g

/**
 * Search Google Play by title. There is no official API, so this fetches the
 * public search page and takes the first app result.
 *
 * @internal
 * USE ONLY IN BACKGROUND SCRIPT.
 * Do not import directly in UI components. Use searchGooglePlayAppViaBackground.
 */
export async function searchGooglePlayApp(query: string): Promise<MobileStoreSearchResult | null> {
	const trimmedQuery = query.trim()
	if (trimmedQuery.length < 3) return null

	const cacheKey = `googleplay:${normalizeStoreSearchName(trimmedQuery)}`
	const cached = getCachedSearch(cacheKey)
	if (cached !== undefined) return cached

	try {
		const params = new URLSearchParams({ q: trimmedQuery, c: 'apps', hl: 'es', gl: 'es' })
		const response = await fetch(`https://play.google.com/store/search?${params}`)
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const html = await response.text()
		const match = PLAY_PACKAGE_ID_REGEX.exec(html)
		PLAY_PACKAGE_ID_REGEX.lastIndex = 0

		const packageId = match?.[1] ?? null
		const result: MobileStoreSearchResult | null = packageId
			? {
					url: `https://play.google.com/store/apps/details?id=${packageId}`,
					storeId: packageId,
					name: null,
				}
			: null

		setCachedSearch(cacheKey, result)
		return result
	} catch (error) {
		logger.error('[MobileStores] Google Play search failed:', error)
		return null
	}
}

// =============================================================================
// Frontend wrappers (via background)
// =============================================================================

/**
 * Search the Apple App Store via background script (for content scripts).
 */
export async function searchItunesAppViaBackground(query: string): Promise<MobileStoreSearchResult | null> {
	try {
		const { sendMessage } = await import('@/lib/messaging')
		return await sendMessage('searchItunesApp', { query })
	} catch (error) {
		logger.error('[MobileStores] iTunes search via background failed:', error)
		return null
	}
}

/**
 * Search Google Play via background script (for content scripts).
 */
export async function searchGooglePlayAppViaBackground(query: string): Promise<MobileStoreSearchResult | null> {
	try {
		const { sendMessage } = await import('@/lib/messaging')
		return await sendMessage('searchGooglePlayApp', { query })
	} catch (error) {
		logger.error('[MobileStores] Google Play search via background failed:', error)
		return null
	}
}
