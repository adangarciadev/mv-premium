/**
 * GOG catalog facade used by game-card previews.
 *
 * Content scripts use the typed background wrapper; extension pages may fetch
 * directly because their CSP and host permissions include catalog.gog.com.
 */
import { API_URLS } from '@/constants'
import { logger } from '@/lib/logger'

export interface GogGameDetails {
	slug: string
	title: string
	storeUrl: string
	coverHorizontal: string
	releaseDate: string
	developers: string[]
	genres: string[]
	operatingSystems: string[]
	price: string | null
	originalPrice: string | null
	discountPercent: number
	reviewsRating: number | null
	reviewsCount: number
}

interface GogCatalogProduct {
	slug?: string
	title?: string
	storeLink?: string
	coverHorizontal?: string
	releaseDate?: string
	developers?: string[]
	genres?: Array<{ name?: string }>
	operatingSystems?: string[]
	price?: {
		final?: string
		base?: string
		discount?: string | null
	}
	reviewsRating?: number
	reviewsCount?: number
}

interface GogCatalogResponse {
	products?: GogCatalogProduct[]
}

const CACHE_TTL = 30 * 60 * 1000
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/
const memoryCache = new Map<string, { data: GogGameDetails; timestamp: number }>()

function getCached(slug: string): GogGameDetails | null {
	const cached = memoryCache.get(slug)
	if (!cached) return null
	if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data
	memoryCache.delete(slug)
	return null
}

function parseDiscountPercent(value: string | null | undefined): number {
	const match = value?.match(/-?(\d{1,3})%/)
	return match ? Number(match[1]) : 0
}

function mapProduct(product: GogCatalogProduct, slug: string): GogGameDetails | null {
	if (!product.title || !product.coverHorizontal) return null

	return {
		slug,
		title: product.title,
		storeUrl: product.storeLink || `https://www.gog.com/game/${slug}`,
		coverHorizontal: product.coverHorizontal,
		releaseDate: product.releaseDate || '',
		developers: product.developers?.filter(Boolean) || [],
		genres: product.genres?.flatMap(genre => (genre.name ? [genre.name] : [])) || [],
		operatingSystems: product.operatingSystems?.filter(Boolean) || [],
		price: product.price?.final || null,
		originalPrice: product.price?.base || null,
		discountPercent: parseDiscountPercent(product.price?.discount),
		reviewsRating: typeof product.reviewsRating === 'number' ? Math.round(product.reviewsRating) / 10 : null,
		reviewsCount: typeof product.reviewsCount === 'number' ? product.reviewsCount : 0,
	}
}

export async function fetchGogGameDetails(slug: string): Promise<GogGameDetails | null> {
	const normalizedSlug = slug.trim().toLowerCase()
	if (!SLUG_PATTERN.test(normalizedSlug)) return null

	const cached = getCached(normalizedSlug)
	if (cached) return cached

	const params = new URLSearchParams({
		query: `like:${normalizedSlug.replace(/[_-]+/g, ' ')}`,
		limit: '10',
		countryCode: 'ES',
		locale: 'es-ES',
		currencyCode: 'EUR',
	})

	try {
		const response = await fetch(`${API_URLS.GOG_CATALOG}/v1/catalog?${params.toString()}`)
		if (!response.ok) return null

		const payload = (await response.json()) as GogCatalogResponse
		const exactProduct = payload.products?.find(product => product.slug?.toLowerCase() === normalizedSlug)
		if (!exactProduct) return null

		const details = mapProduct(exactProduct, normalizedSlug)
		if (details) memoryCache.set(normalizedSlug, { data: details, timestamp: Date.now() })
		return details
	} catch (error) {
		logger.error('[GOG] Failed to fetch catalog game:', error)
		return null
	}
}

export async function fetchGogGameDetailsViaBackground(slug: string): Promise<GogGameDetails | null> {
	try {
		const { sendMessage } = await import('@/lib/messaging')
		return await sendMessage('fetchGogGame', slug)
	} catch (error) {
		logger.error('[GOG] Failed to fetch game via background:', error)
		return null
	}
}
