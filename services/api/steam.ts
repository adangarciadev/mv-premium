/**
 * Steam API Service
 * Fetches game and bundle details from Steam Store API
 *
 * Uses in-memory cache only (no persistent storage)
 */
import { logger } from '@/lib/logger'
import { API_URLS } from '@/constants'

// =============================================================================
// Types
// =============================================================================

export interface SteamGameDetails {
	appId: number
	name: string
	headerImage: string
	/**
	 * Best Spanish description available from Steam.
	 * Priority: about_the_game text (stripped HTML) -> short_description fallback.
	 * May be empty if Steam has no text for this game.
	 */
	description: string
	isFree: boolean
	price: string | null
	originalPrice: string | null
	discountPercent: number
	releaseDate: string
	developers: string[]
	publishers: string[]
	genres: string[]
	metacriticScore: number | null
	metacriticUrl: string | null
	screenshots: string[]
	steamLibraryHeaderUrl: string
}

export interface SteamBundleDetails {
	bundleId: number
	name: string
	headerImage: string | null
	description: string
	price: string | null
	originalPrice: string | null
	baseDiscountPercent: number
	discountPercent: number
	supportsWindows: boolean
	supportsMac: boolean
	supportsLinux: boolean
	itemCount: number | null
	appIds: number[]
	bundleUrl: string
}

interface SteamPriceOverview {
	currency: string
	initial: number
	final: number
	discount_percent: number
	initial_formatted: string
	final_formatted: string
}

interface SteamApiResponse {
	[appId: string]: {
		success: boolean
		data?: {
			type: string
			name: string
			steam_appid: number
			required_age: number
			is_free: boolean
			short_description: string
			detailed_description?: string
			about_the_game?: string
			header_image: string
			website: string | null
			developers?: string[]
			publishers?: string[]
			price_overview?: SteamPriceOverview
			release_date?: {
				coming_soon: boolean
				date: string
			}
			genres?: Array<{ id: string; description: string }>
			metacritic?: {
				score: number
				url: string
			}
			screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>
		}
	}
}

type UnknownRecord = Record<string, unknown>

// =============================================================================
// Cache TTL (session only - no persistent storage)
// =============================================================================

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const STEAM_RETRY_DELAYS_MS = [300, 900, 1800]
const MAX_STEAM_BUNDLE_CONCURRENCY = 4

const gameMemoryCache = new Map<number, { data: SteamGameDetails; timestamp: number }>()
const bundleMemoryCache = new Map<number, { data: SteamBundleDetails; timestamp: number }>()
const bundleInFlightRequests = new Map<number, Promise<SteamBundleDetails | null>>()

const bundleTaskQueue: Array<() => void> = []
let activeBundleTasks = 0

// =============================================================================
// Helpers
// =============================================================================

/**
 * Strip HTML tags from Steam's detailed_description and convert to clean text.
 * Preserves paragraph structure with line breaks.
 */
function stripHtmlToPlainText(html: string): string {
	if (!html) return ''

	return (
		html
			// Replace block-level elements with newlines
			.replace(/<\/?(h[1-6]|p|div|br|li|ul|ol|tr)[^>]*>/gi, '\n')
			// Remove all remaining HTML tags
			.replace(/<[^>]+>/g, '')
			// Decode common HTML entities
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ')
			// Collapse multiple newlines
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	)
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
}

function asNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : null
	}
	return null
}

function asPercent(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Math.abs(Math.round(value))
	}

	if (typeof value === 'string' && value.trim()) {
		const match = value.match(/-?\d+(?:[.,]\d+)?/)
		if (!match) return null
		const parsed = Number.parseFloat(match[0].replace(',', '.'))
		return Number.isFinite(parsed) ? Math.abs(Math.round(parsed)) : null
	}

	return null
}

function asString(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function asBoolean(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value
	if (typeof value === 'number') {
		if (value === 1) return true
		if (value === 0) return false
		return null
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (['1', 'true', 'yes'].includes(normalized)) return true
		if (['0', 'false', 'no'].includes(normalized)) return false
	}
	return null
}

function formatCurrencyFromCents(cents: number, currency = 'EUR'): string | null {
	if (!Number.isFinite(cents) || cents <= 0) return null
	try {
		return new Intl.NumberFormat('es-ES', {
			style: 'currency',
			currency,
		}).format(cents / 100)
	} catch {
		return `${(cents / 100).toFixed(2)}`
	}
}

function extractIdsFromUnknown(value: unknown): number[] {
	if (!Array.isArray(value)) return []

	const ids = value
		.map(item => {
			if (typeof item === 'number') return item
			if (typeof item === 'string') return asNumber(item)
			if (item && typeof item === 'object') {
				const record = item as UnknownRecord
				return asNumber(record.id ?? record.appid ?? record.appID)
			}
			return null
		})
		.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))

	return Array.from(new Set(ids))
}

function pickBundlePayload(json: unknown, bundleId: number): UnknownRecord | null {
	if (!json || typeof json !== 'object') return null

	// Most common: { "<bundleId>": { ...bundle } }
	const direct = (json as UnknownRecord)[String(bundleId)]
	if (direct && typeof direct === 'object') {
		return direct as UnknownRecord
	}

	// Alternative: { bundles: [{ bundleid: ... }] }
	const bundlesArray = (json as UnknownRecord).bundles
	if (Array.isArray(bundlesArray)) {
		const match = bundlesArray.find(item => {
			if (!item || typeof item !== 'object') return false
			const record = item as UnknownRecord
			const id = asNumber(record.bundleid ?? record.bundleId ?? record.id)
			return id === bundleId
		})
		if (match && typeof match === 'object') {
			return match as UnknownRecord
		}
	}

	// Alternative: top-level array
	if (Array.isArray(json)) {
		const match = json.find(item => {
			if (!item || typeof item !== 'object') return false
			const record = item as UnknownRecord
			const id = asNumber(record.bundleid ?? record.bundleId ?? record.id)
			return id === bundleId
		})
		if (match && typeof match === 'object') {
			return match as UnknownRecord
		}
	}

	return null
}

function extractBundleDiscountPercent(payload: UnknownRecord): number {
	const directCandidates: unknown[] = [payload.discount_percent, payload.discount_pct]

	for (const candidate of directCandidates) {
		const parsed = asPercent(candidate)
		if (parsed !== null) return parsed
	}

	return 0
}

function extractBundleBaseDiscountPercent(payload: UnknownRecord): number {
	const directCandidates: unknown[] = [payload.bundle_base_discount, payload.base_discount_percent, payload.base_discount_pct]

	for (const candidate of directCandidates) {
		const parsed = asPercent(candidate)
		if (parsed !== null) return parsed
	}

	return 0
}

function extractBundlePlatformsFromPayload(payload: UnknownRecord): {
	supportsWindows: boolean
	supportsMac: boolean
	supportsLinux: boolean
} {
	const platformRecord =
		payload.platforms && typeof payload.platforms === 'object' ? (payload.platforms as UnknownRecord) : null

	let supportsWindows =
		asBoolean(
			payload.available_windows ??
				payload.supports_windows ??
				payload.windows ??
				payload.win ??
				platformRecord?.windows ??
				platformRecord?.win
		) ?? null
	let supportsMac =
		asBoolean(payload.available_mac ?? payload.supports_mac ?? payload.mac ?? platformRecord?.mac) ?? null
	let supportsLinux =
		asBoolean(
			payload.available_linux ?? payload.supports_linux ?? payload.linux ?? payload.steam_os ?? platformRecord?.linux
		) ?? null

	const parsePlatformTokens = (value: unknown) => {
		if (typeof value !== 'string') return
		const normalized = value.toLowerCase()
		if (
			supportsWindows === null &&
			(normalized.includes('platform_img win') || /\bwindows?\b/.test(normalized))
		) {
			supportsWindows = true
		}
		if (supportsMac === null && (normalized.includes('platform_img mac') || /\bmac(os)?\b/.test(normalized))) {
			supportsMac = true
		}
		if (
			supportsLinux === null &&
			(normalized.includes('platform_img linux') || /\blinux\b/.test(normalized) || normalized.includes('steam os'))
		) {
			supportsLinux = true
		}
	}

	parsePlatformTokens(payload.platform_icons)
	parsePlatformTokens(payload.platforms_html)
	parsePlatformTokens(payload.platform_text)

	const finalSupportsWindows = supportsWindows ?? true
	const finalSupportsMac = supportsMac ?? false
	const finalSupportsLinux = supportsLinux ?? false

	return {
		supportsWindows: finalSupportsWindows,
		supportsMac: finalSupportsMac,
		supportsLinux: finalSupportsLinux,
	}
}

function mapAjaxBundleToDetails(bundleId: number, payload: UnknownRecord): SteamBundleDetails | null {
	const name = asString(payload.name ?? payload.title ?? payload.bundle_name)
	if (!name) return null

	const currency = asString(payload.price_currency) || 'EUR'
	const finalCents = asNumber(payload.final_price)
	const initialCents = asNumber(payload.initial_price)

	const price =
		asString(payload.formatted_final_price ?? payload.final_price_formatted) ||
		(finalCents ? formatCurrencyFromCents(finalCents, currency) : null)
	const originalPrice =
		asString(payload.formatted_orig_price ?? payload.original_price_formatted) ||
		(initialCents ? formatCurrencyFromCents(initialCents, currency) : null)

	const appIds = extractIdsFromUnknown(payload.appids)
	const packageIds = extractIdsFromUnknown(payload.packageids)

	const itemCount =
		asNumber(payload.item_count ?? payload.app_count) ??
		(appIds.length + packageIds.length > 0 ? appIds.length + packageIds.length : null)
	const platforms = extractBundlePlatformsFromPayload(payload)

	return {
		bundleId,
		name,
		headerImage:
			asString(payload.header_image_url ?? payload.header_image ?? payload.main_capsule ?? payload.capsule) || null,
		description: asString(payload.short_description ?? payload.description ?? payload.desc) || '',
		price,
		originalPrice,
		baseDiscountPercent: extractBundleBaseDiscountPercent(payload),
		discountPercent: extractBundleDiscountPercent(payload),
		supportsWindows: platforms.supportsWindows,
		supportsMac: platforms.supportsMac,
		supportsLinux: platforms.supportsLinux,
		itemCount,
		appIds,
		bundleUrl: `${API_URLS.STEAM_STORE}/bundle/${bundleId}`,
	}
}

function extractFirstGroup(html: string, patterns: RegExp[]): string | null {
	for (const pattern of patterns) {
		const match = html.match(pattern)
		if (match?.[1]) {
			return decodeHtmlEntities(match[1]).trim()
		}
	}
	return null
}

function extractBundleDiscountFromHtml(html: string): number {
	const match = html.match(/discount_pct[^>]*>\s*-?\s*(\d{1,3})\s*%\s*</i)
	return match?.[1] ? Number(match[1]) : 0
}

function extractBundleBaseDiscountFromHtml(html: string): number {
	const match = html.match(/bundle_base_discount[^>]*>\s*-?\s*(\d{1,3})\s*%\s*</i)
	return match?.[1] ? Number(match[1]) : 0
}

interface BundlePurchaseData {
	price: string | null
	originalPrice: string | null
	baseDiscountPercent: number
	discountPercent: number
	supportsWindows: boolean
	supportsMac: boolean
	supportsLinux: boolean
}

function extractBundlePlatformsFromHtml(html: string): {
	supportsWindows: boolean
	supportsMac: boolean
	supportsLinux: boolean
} {
	const classContains = (token: string) =>
		new RegExp(`class=["'][^"']*platform_img[^"']*\\b${token}\\b[^"']*["']`, 'i').test(html)

	return {
		supportsWindows: classContains('win'),
		supportsMac: classContains('mac'),
		supportsLinux: classContains('linux'),
	}
}

function parseBundlePurchaseData(html: string): BundlePurchaseData {
	const actionMarkers = [...html.matchAll(/game_purchase_action_bg/gi)]

	let best: (BundlePurchaseData & { score: number }) | null = null

	for (const marker of actionMarkers) {
		if (typeof marker.index !== 'number') continue

		const block = html.slice(marker.index, marker.index + 4500)
		const price = extractFirstGroup(block, [
			/discount_final_price[^>]*>\s*([^<]+)\s*</i,
			/bundle_final_price[^>]*>\s*([^<]+)\s*</i,
			/game_purchase_price[^>]*>\s*([^<]+)\s*</i,
			/your_price[^>]*>\s*([^<]+)\s*</i,
		])
		const originalPrice = extractFirstGroup(block, [
			/discount_original_price[^>]*>\s*([^<]+)\s*</i,
			/bundle_original_price[^>]*>\s*([^<]+)\s*</i,
		])
		const discountPercent = extractBundleDiscountFromHtml(block)
		const baseDiscountPercent = extractBundleBaseDiscountFromHtml(block)
		const platforms = extractBundlePlatformsFromHtml(block)

		const score = (price ? 2 : 0) + (discountPercent > 0 || baseDiscountPercent > 0 ? 2 : 0) + (originalPrice ? 1 : 0)
		if (score === 0) continue

		if (!best || score > best.score) {
			best = {
				price,
				originalPrice,
				baseDiscountPercent,
				discountPercent,
				supportsWindows: platforms.supportsWindows,
				supportsMac: platforms.supportsMac,
				supportsLinux: platforms.supportsLinux,
				score,
			}
		}
	}

	if (best) {
		return {
			price: best.price,
			originalPrice: best.originalPrice,
			baseDiscountPercent: best.baseDiscountPercent,
			discountPercent: best.discountPercent,
			supportsWindows: best.supportsWindows,
			supportsMac: best.supportsMac,
			supportsLinux: best.supportsLinux,
		}
	}

	// Fallback when action blocks are not found
	const fullPlatforms = extractBundlePlatformsFromHtml(html)
	return {
		price: extractFirstGroup(html, [
			/discount_final_price[^>]*>\s*([^<]+)\s*</i,
			/bundle_final_price[^>]*>\s*([^<]+)\s*</i,
			/game_purchase_price[^>]*>\s*([^<]+)\s*</i,
			/your_price[^>]*>\s*([^<]+)\s*</i,
		]),
		originalPrice: extractFirstGroup(html, [
			/discount_original_price[^>]*>\s*([^<]+)\s*</i,
			/bundle_original_price[^>]*>\s*([^<]+)\s*</i,
		]),
		baseDiscountPercent: extractBundleBaseDiscountFromHtml(html),
		discountPercent: extractBundleDiscountFromHtml(html),
		supportsWindows: fullPlatforms.supportsWindows,
		supportsMac: fullPlatforms.supportsMac,
		supportsLinux: fullPlatforms.supportsLinux,
	}
}

function parseBundlePageFallback(bundleId: number, html: string): SteamBundleDetails | null {
	const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
	const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
	const descriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
	const purchaseData = parseBundlePurchaseData(html)

	const name = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null
	if (!name) return null

	return {
		bundleId,
		name,
		headerImage: imageMatch ? decodeHtmlEntities(imageMatch[1]).trim() : null,
		description: descriptionMatch ? decodeHtmlEntities(descriptionMatch[1]).trim() : '',
		price: purchaseData.price,
		originalPrice: purchaseData.originalPrice,
		baseDiscountPercent: purchaseData.baseDiscountPercent,
		discountPercent: purchaseData.discountPercent,
		supportsWindows: purchaseData.supportsWindows,
		supportsMac: purchaseData.supportsMac,
		supportsLinux: purchaseData.supportsLinux,
		itemCount: null,
		appIds: [],
		bundleUrl: `${API_URLS.STEAM_STORE}/bundle/${bundleId}`,
	}
}

// =============================================================================
// URL helpers
// =============================================================================

/**
 * Extract Steam App ID from various URL formats
 * Supports:
 * - https://store.steampowered.com/app/1091500/Cyberpunk_2077/
 * - https://store.steampowered.com/app/1091500
 * - store.steampowered.com/app/1091500
 */
export function extractSteamAppId(url: string): number | null {
	const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i)
	return match ? parseInt(match[1], 10) : null
}

/**
 * Check if a URL is a Steam app store link
 */
export function isSteamUrl(url: string): boolean {
	return /store\.steampowered\.com\/app\/\d+/i.test(url)
}

/**
 * Extract Steam Bundle ID from URL
 * Supports:
 * - https://store.steampowered.com/bundle/33369/Borderlands_Collection/
 * - https://store.steampowered.com/bundle/33369
 */
export function extractSteamBundleId(url: string): number | null {
	const match = url.match(/store\.steampowered\.com\/bundle\/(\d+)/i)
	return match ? parseInt(match[1], 10) : null
}

/**
 * Check if a URL is a Steam bundle link
 */
export function isSteamBundleUrl(url: string): boolean {
	return /store\.steampowered\.com\/bundle\/\d+/i.test(url)
}

// =============================================================================
// Cache helpers (memory-only, no persistent storage)
// =============================================================================

function getCachedGame(appId: number): SteamGameDetails | null {
	const cached = gameMemoryCache.get(appId)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data
	}
	if (cached) {
		gameMemoryCache.delete(appId)
	}
	return null
}

function setCachedGame(appId: number, data: SteamGameDetails): void {
	gameMemoryCache.set(appId, {
		data,
		timestamp: Date.now(),
	})
}

function getCachedBundle(bundleId: number): SteamBundleDetails | null {
	const cached = bundleMemoryCache.get(bundleId)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data
	}
	if (cached) {
		bundleMemoryCache.delete(bundleId)
	}
	return null
}

function setCachedBundle(bundleId: number, data: SteamBundleDetails): void {
	bundleMemoryCache.set(bundleId, {
		data,
		timestamp: Date.now(),
	})
}

function wait(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

function shouldRetrySteamStatus(status: number): boolean {
	return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 504)
}

async function fetchWithRetry(url: string, label: string): Promise<Response> {
	let lastNetworkError: unknown = null

	for (let attempt = 0; attempt <= STEAM_RETRY_DELAYS_MS.length; attempt += 1) {
		const attemptNumber = attempt + 1
		try {
			const response = await fetch(url)
			if (response.ok) {
				return response
			}

			const shouldRetry = shouldRetrySteamStatus(response.status) && attempt < STEAM_RETRY_DELAYS_MS.length
			if (!shouldRetry) {
				return response
			}

			const delay = STEAM_RETRY_DELAYS_MS[attempt]
			logger.warn(`[Steam] ${label} HTTP ${response.status}; retry ${attemptNumber} in ${delay}ms`)
			await wait(delay)
		} catch (error) {
			lastNetworkError = error
			if (attempt >= STEAM_RETRY_DELAYS_MS.length) {
				break
			}

			const delay = STEAM_RETRY_DELAYS_MS[attempt]
			logger.warn(`[Steam] ${label} network error; retry ${attemptNumber} in ${delay}ms`, error)
			await wait(delay)
		}
	}

	if (lastNetworkError) {
		throw lastNetworkError
	}

	throw new Error(`Steam fetch failed for ${label}`)
}

function queueBundleTask<T>(task: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const run = () => {
			activeBundleTasks += 1
			void task()
				.then(resolve)
				.catch(reject)
				.finally(() => {
					activeBundleTasks = Math.max(0, activeBundleTasks - 1)
					const next = bundleTaskQueue.shift()
					if (next) next()
				})
		}

		if (activeBundleTasks < MAX_STEAM_BUNDLE_CONCURRENCY) {
			run()
			return
		}

		bundleTaskQueue.push(run)
	})
}

function hasEnoughAjaxBundleData(details: SteamBundleDetails | null): details is SteamBundleDetails {
	if (!details) return false

	// If ajax already has pricing/discount data, the inline card can be rendered
	// without doing an extra HTML fetch for this bundle.
	return Boolean(
		details.name &&
			(details.price !== null ||
				details.originalPrice !== null ||
				details.discountPercent > 0 ||
				details.baseDiscountPercent > 0)
	)
}

function mergeBundleDetails(
	ajaxDetails: SteamBundleDetails | null,
	fallbackDetails: SteamBundleDetails
): SteamBundleDetails {
	if (!ajaxDetails) {
		return fallbackDetails
	}

	const merged: SteamBundleDetails = {
		...ajaxDetails,
		name: ajaxDetails.name || fallbackDetails.name,
		headerImage: ajaxDetails.headerImage || fallbackDetails.headerImage,
		description: ajaxDetails.description || fallbackDetails.description,
		price: ajaxDetails.price || fallbackDetails.price,
		originalPrice: ajaxDetails.originalPrice || fallbackDetails.originalPrice,
		baseDiscountPercent:
			ajaxDetails.baseDiscountPercent > 0 ? ajaxDetails.baseDiscountPercent : fallbackDetails.baseDiscountPercent,
		discountPercent: ajaxDetails.discountPercent > 0 ? ajaxDetails.discountPercent : fallbackDetails.discountPercent,
		supportsWindows: ajaxDetails.supportsWindows || fallbackDetails.supportsWindows,
		supportsMac: ajaxDetails.supportsMac || fallbackDetails.supportsMac,
		supportsLinux: ajaxDetails.supportsLinux || fallbackDetails.supportsLinux,
		itemCount: ajaxDetails.itemCount ?? fallbackDetails.itemCount,
		appIds: ajaxDetails.appIds.length > 0 ? ajaxDetails.appIds : fallbackDetails.appIds,
		bundleUrl: ajaxDetails.bundleUrl || fallbackDetails.bundleUrl,
	}

	// Steam may report both "base bundle discount" and "extra discount" in the HTML block.
	// If fallback parsing found a discount, we prioritize that value.
	if (fallbackDetails.baseDiscountPercent > 0) {
		merged.baseDiscountPercent = fallbackDetails.baseDiscountPercent
	}
	if (fallbackDetails.discountPercent > 0) {
		merged.discountPercent = fallbackDetails.discountPercent
	}

	return merged
}

// =============================================================================
// API functions
// =============================================================================

/**
 * Fetch game details from Steam API
 *
 * @internal
 * USE ONLY IN BACKGROUND SCRIPT.
 * Do not import directly in UI components. Use fetchSteamGameDetailsViaBackground.
 */
export async function fetchSteamGameDetails(appId: number): Promise<SteamGameDetails | null> {
	const cached = getCachedGame(appId)
	if (cached) {
		logger.debug('[Steam] Using cached data for app:', appId)
		return cached
	}

	try {
		const url = `${API_URLS.STEAM_STORE}/api/appdetails?appids=${appId}&l=spanish&cc=es`
		const response = await fetchWithRetry(url, `appdetails:${appId}`)

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const json = (await response.json()) as SteamApiResponse
		const appData = json[appId.toString()]

		if (!appData?.success || !appData.data) {
			logger.warn('[Steam] No data found for app:', appId)
			return null
		}

		const data = appData.data
		const aboutText = stripHtmlToPlainText(data.about_the_game || '')

		const gameDetails: SteamGameDetails = {
			appId,
			name: data.name,
			headerImage: data.header_image,
			// Use about_the_game text if available, otherwise fall back to short_description
			description: aboutText || data.short_description || '',
			isFree: data.is_free,
			price: data.price_overview?.final_formatted || null,
			originalPrice: data.price_overview?.initial_formatted || null,
			discountPercent: data.price_overview?.discount_percent || 0,
			releaseDate: data.release_date?.date || 'Por anunciar',
			developers: data.developers || [],
			publishers: data.publishers || [],
			genres: data.genres?.map(g => g.description) || [],
			metacriticScore: data.metacritic?.score || null,
			metacriticUrl: data.metacritic?.url || null,
			screenshots: data.screenshots?.map(s => s.path_full) || [],
			steamLibraryHeaderUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_header_2x.jpg`,
		}

		setCachedGame(appId, gameDetails)
		return gameDetails
	} catch (error) {
		logger.error('[Steam] Failed to fetch game details:', error)
		return null
	}
}

/**
 * Fetch Steam bundle details.
 *
 * @internal
 * USE ONLY IN BACKGROUND SCRIPT.
 * Do not import directly in UI components. Use fetchSteamBundleDetailsViaBackground.
 */
export async function fetchSteamBundleDetails(bundleId: number): Promise<SteamBundleDetails | null> {
	const cached = getCachedBundle(bundleId)
	if (cached) {
		logger.debug('[Steam] Using cached data for bundle:', bundleId)
		return cached
	}

	const inFlight = bundleInFlightRequests.get(bundleId)
	if (inFlight) {
		return inFlight
	}

	const requestPromise = queueBundleTask(async () => {
		const refreshedCache = getCachedBundle(bundleId)
		if (refreshedCache) {
			return refreshedCache
		}

		return await fetchSteamBundleDetailsInternal(bundleId)
	}).finally(() => {
		bundleInFlightRequests.delete(bundleId)
	})

	bundleInFlightRequests.set(bundleId, requestPromise)
	return requestPromise
}

async function fetchSteamBundleDetailsInternal(bundleId: number): Promise<SteamBundleDetails | null> {
	let ajaxDetails: SteamBundleDetails | null = null

	try {
		const resolveUrl = `${API_URLS.STEAM_STORE}/actions/ajaxresolvebundles?bundleids=${bundleId}&l=spanish&cc=es`
		const resolveResponse = await fetchWithRetry(resolveUrl, `ajaxresolvebundles:${bundleId}`)
		if (resolveResponse.ok) {
			const resolveJson = (await resolveResponse.json()) as unknown
			const payload = pickBundlePayload(resolveJson, bundleId)
			if (payload) {
				const details = mapAjaxBundleToDetails(bundleId, payload)
				if (details) {
					ajaxDetails = details
				}
			}
		}
	} catch (error) {
		logger.warn('[Steam] ajaxresolvebundles failed, fallback to page parsing', error)
	}

	if (hasEnoughAjaxBundleData(ajaxDetails)) {
		setCachedBundle(bundleId, ajaxDetails)
		return ajaxDetails
	}

	try {
		const pageUrl = `${API_URLS.STEAM_STORE}/bundle/${bundleId}/?l=spanish&cc=es`
		const pageResponse = await fetchWithRetry(pageUrl, `bundle-page:${bundleId}`)
		if (!pageResponse.ok) {
			throw new Error(`HTTP ${pageResponse.status}`)
		}

		const html = await pageResponse.text()
		const fallbackDetails = parseBundlePageFallback(bundleId, html)
		if (fallbackDetails) {
			const mergedDetails = mergeBundleDetails(ajaxDetails, fallbackDetails)

			setCachedBundle(bundleId, mergedDetails)
			return mergedDetails
		}
	} catch (error) {
		logger.error('[Steam] Failed to fetch bundle details:', error)
	}

	if (ajaxDetails) {
		setCachedBundle(bundleId, ajaxDetails)
		return ajaxDetails
	}

	return null
}

/**
 * Fetch game details via background script (for content scripts).
 */
export async function fetchSteamGameDetailsViaBackground(appId: number): Promise<SteamGameDetails | null> {
	try {
		const { sendMessage } = await import('@/lib/messaging')
		return await sendMessage('fetchSteamGame', appId)
	} catch (error) {
		logger.error('[Steam] Failed to fetch game via background:', error)
		return null
	}
}

/**
 * Fetch bundle details via background script (for content scripts).
 */
export async function fetchSteamBundleDetailsViaBackground(bundleId: number): Promise<SteamBundleDetails | null> {
	try {
		const { sendMessage } = await import('@/lib/messaging')
		return await sendMessage('fetchSteamBundle', bundleId)
	} catch (error) {
		logger.error('[Steam] Failed to fetch bundle via background:', error)
		return null
	}
}
