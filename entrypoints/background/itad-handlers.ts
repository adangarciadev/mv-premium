/**
 * IsThereAnyDeal API handlers.
 *
 * Public price/search requests are proxied through background so content
 * scripts do not make external requests and the API key is not exposed to MV.
 */

import { logger } from '@/lib/logger'
import { onMessage } from '@/lib/messaging'
import { API_URLS } from '@/constants'
import type { ItadGamePriceOverview, ItadGamePrices, ItadGameSearchResult } from '@/services/api/itad'

const ITAD_API_KEY = import.meta.env.VITE_ITAD_API_KEY || ''
const ITAD_COUNTRY = 'ES'
const ITAD_CACHE_TTL_MS = 30 * 60 * 1000
const ITAD_SEARCH_LIMIT_MAX = 20

const cache = new Map<string, { data: unknown; timestamp: number }>()

function hasItadCredentials(): boolean {
	return ITAD_API_KEY.trim().length > 0
}

function getCached<T>(key: string): T | null {
	const entry = cache.get(key)
	if (!entry || Date.now() - entry.timestamp > ITAD_CACHE_TTL_MS) {
		cache.delete(key)
		return null
	}
	return entry.data as T
}

function setCached(key: string, data: unknown): void {
	cache.set(key, { data, timestamp: Date.now() })
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function normalizeSearchPayload(payload: unknown): ItadGameSearchResult[] {
	const payloadRecord = asRecord(payload)
	const payloadData = payloadRecord?.data
	const rawItems = Array.isArray(payload) ? payload : Array.isArray(payloadData) ? payloadData : []

	return rawItems
		.map(item => {
			const record = asRecord(item)
			if (!record) return null

			const id = typeof record.id === 'string' ? record.id : ''
			const title = typeof record.title === 'string' ? record.title : ''
			if (!id || !title) return null

			const assets = asRecord(record.assets) as ItadGameSearchResult['assets'] | null
			return {
				id,
				slug: typeof record.slug === 'string' ? record.slug : '',
				title,
				type: typeof record.type === 'string' ? record.type : 'game',
				mature: typeof record.mature === 'boolean' ? record.mature : false,
				...(assets ? { assets } : {}),
			}
		})
		.filter((item): item is ItadGameSearchResult => item !== null)
}

function normalizeOverviewPayload(payload: unknown): Record<string, ItadGamePriceOverview> {
	if (Array.isArray(payload)) {
		return Object.fromEntries(
			payload
				.map(item => asRecord(item))
				.filter((item): item is Record<string, unknown> => !!item && typeof item.id === 'string')
				.map(item => [item.id as string, item as unknown as ItadGamePriceOverview])
		)
	}

	const record = asRecord(payload)
	if (!record) return {}

	if (Array.isArray(record.prices)) {
		return Object.fromEntries(
			record.prices
				.map(item => asRecord(item))
				.filter((item): item is Record<string, unknown> => !!item && typeof item.id === 'string')
				.map(item => [item.id as string, item as unknown as ItadGamePriceOverview])
		)
	}

	return Object.fromEntries(Object.entries(record).filter(([, value]) => asRecord(value) !== null)) as Record<
		string,
		ItadGamePriceOverview
	>
}

function normalizePricesPayload(payload: unknown): Record<string, ItadGamePrices> {
	const items = Array.isArray(payload) ? payload : []
	return Object.fromEntries(
		items
			.map(item => asRecord(item))
			.filter((item): item is Record<string, unknown> => !!item && typeof item.id === 'string')
			.map(item => {
				const deals = Array.isArray(item.deals) ? item.deals : []
				return [
					item.id as string,
					{
						...(item as unknown as ItadGamePrices),
						deals,
					},
				]
			})
	)
}

async function fetchItadJson<T>(path: string, options: RequestInit = {}): Promise<T> {
	if (!hasItadCredentials()) {
		throw new Error('IsThereAnyDeal API key is not configured')
	}

	const url = new URL(path, API_URLS.ITAD)
	url.searchParams.set('key', ITAD_API_KEY)
	const headers = new Headers(options.headers)
	headers.set('Accept', 'application/json')
	if (options.body) {
		headers.set('Content-Type', 'application/json')
	}

	const response = await fetch(url.toString(), {
		...options,
		headers,
	})

	if (!response.ok) {
		throw new Error(`IsThereAnyDeal API error: ${response.status}`)
	}

	return await response.json()
}

export function setupItadHandlers(): void {
	onMessage('hasItadApiKey', () => hasItadCredentials())

	onMessage('itadSearchGames', async ({ data }) => {
		const query = data.query.trim()
		if (query.length < 2) return []

		const results = Math.min(Math.max(data.results ?? 8, 1), ITAD_SEARCH_LIMIT_MAX)
		const cacheKey = `search:${query.toLowerCase()}:${results}`
		const cached = getCached<ItadGameSearchResult[]>(cacheKey)
		if (cached) return cached

		try {
			const endpoint = new URL('/games/search/v1', API_URLS.ITAD)
			endpoint.searchParams.set('key', ITAD_API_KEY)
			endpoint.searchParams.set('title', query)
			endpoint.searchParams.set('results', String(results))

			const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } })
			if (!response.ok) {
				throw new Error(`IsThereAnyDeal search error: ${response.status}`)
			}

			const normalized = normalizeSearchPayload(await response.json())
			setCached(cacheKey, normalized)
			return normalized
		} catch (error) {
			logger.error('ITAD search error:', error)
			throw error
		}
	})

	onMessage('itadPriceOverview', async ({ data }) => {
		const gameIds = [...new Set(data.gameIds.map(id => id.trim()).filter(Boolean))].slice(0, ITAD_SEARCH_LIMIT_MAX)
		if (gameIds.length === 0) return {}

		const country = (data.country || ITAD_COUNTRY).toUpperCase()
		const cacheKey = `overview:${country}:${gameIds.sort().join(',')}`
		const cached = getCached<Record<string, ItadGamePriceOverview>>(cacheKey)
		if (cached) return cached

		try {
			const overview = await fetchItadJson<unknown>(`/games/overview/v2?country=${encodeURIComponent(country)}`, {
				method: 'POST',
				body: JSON.stringify(gameIds),
			})
			const normalized = normalizeOverviewPayload(overview)
			setCached(cacheKey, normalized)
			return normalized
		} catch (error) {
			logger.error('ITAD overview error:', error)
			throw error
		}
	})

	onMessage('itadGamePrices', async ({ data }) => {
		const gameIds = [...new Set(data.gameIds.map(id => id.trim()).filter(Boolean))].slice(0, ITAD_SEARCH_LIMIT_MAX)
		if (gameIds.length === 0) return {}

		const country = (data.country || ITAD_COUNTRY).toUpperCase()
		const capacity = Math.min(Math.max(data.capacity ?? 8, 1), 20)
		const cacheKey = `prices:${country}:${capacity}:${gameIds.sort().join(',')}`
		const cached = getCached<Record<string, ItadGamePrices>>(cacheKey)
		if (cached) return cached

		try {
			const params = new URLSearchParams({
				country,
				capacity: String(capacity),
				vouchers: 'true',
			})
			const prices = await fetchItadJson<unknown>(`/games/prices/v3?${params.toString()}`, {
				method: 'POST',
				body: JSON.stringify(gameIds),
			})
			const normalized = normalizePricesPayload(prices)
			setCached(cacheKey, normalized)
			return normalized
		} catch (error) {
			logger.error('ITAD prices error:', error)
			throw error
		}
	})
}
