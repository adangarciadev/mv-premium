/**
 * API Handlers Module
 * Handles external API requests (Steam, TMDB, GIPHY)
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { fetchSteamGameDetails } from '@/services/api/steam'
import { onMessage } from '@/lib/messaging'
import { API_URLS } from '@/constants'
import type { GiphyPaginatedResponse } from '@/services/api/giphy'

// =============================================================================
// Constants
// =============================================================================

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = API_URLS.TMDB_BASE
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''
const GIPHY_BASE_URL = API_URLS.GIPHY
const GIPHY_PAGE_SIZE = 18

interface GiphyApiResponse {
	data: Array<{
		id: string
		title: string
		images: {
			original: { url: string }
			fixed_height_small: { url: string }
		}
	}>
	pagination: {
		total_count: number
		count: number
		offset: number
	}
}

function toGiphyPaginatedResponse(data: GiphyApiResponse): GiphyPaginatedResponse {
	return {
		gifs: data.data.map(gif => ({
			id: gif.id,
			title: gif.title || 'GIF',
			url: gif.images.original.url,
			previewUrl: gif.images.fixed_height_small.url,
		})),
		pagination: {
			totalCount: data.pagination.total_count,
			count: data.pagination.count,
			offset: data.pagination.offset,
		},
	}
}

async function requestGiphy(
	endpoint: 'trending' | 'search',
	params: URLSearchParams
): Promise<GiphyPaginatedResponse> {
	if (!GIPHY_API_KEY) {
		throw new Error('GIPHY API key not configured in environment')
	}

	params.set('api_key', GIPHY_API_KEY)
	params.set('limit', String(GIPHY_PAGE_SIZE))
	params.set('rating', 'g')

	const response = await fetch(`${GIPHY_BASE_URL}/${endpoint}?${params.toString()}`)

	if (!response.ok) {
		throw new Error(`GIPHY API error: ${response.status}`)
	}

	const data = (await response.json()) as GiphyApiResponse
	return toGiphyPaginatedResponse(data)
}

// =============================================================================
// API Handlers
// =============================================================================

/**
 * Setup options page opener handler
 */
export function setupOptionsHandler(): void {
	onMessage('openOptionsPage', async ({ data: view }) => {
		let url = browser.runtime.getURL('/options.html')
		if (view) {
			// Support query params in view: "settings?tab=ai" -> "#/settings?tab=ai"
			url += `#/${view}`
		}

		const baseOptionsUrl = browser.runtime.getURL('/options.html')
		const existingTabs = await browser.tabs.query({ url: `${baseOptionsUrl}*` })
		const existingTab = existingTabs[0]

		if (existingTab?.id) {
			if (existingTab.url !== url) {
				await browser.tabs.update(existingTab.id, { url })
			}

			await browser.tabs.update(existingTab.id, { active: true })

			if (typeof existingTab.windowId === 'number') {
				await browser.windows.update(existingTab.windowId, { focused: true })
			}

			return
		}

		await browser.tabs.create({ url })
	})
}

/**
 * Setup Steam API handler (CORS proxy)
 */
export function setupSteamHandler(): void {
	onMessage('fetchSteamGame', async ({ data: appId }) => {
		try {
			return await fetchSteamGameDetails(appId)
		} catch (error) {
			logger.error('Steam fetch error:', error)
			return null
		}
	})
}

/**
 * Setup TMDB API key check handler
 */
export function setupTmdbKeyCheckHandler(): void {
	onMessage('hasTmdbApiKey', () => {
		return !!TMDB_API_KEY
	})
}

/**
 * Setup TMDB API request handler
 * Reads API key from env and proxies requests
 */
export function setupTmdbRequestHandler(): void {
	onMessage('tmdbRequest', async ({ data }) => {
		try {
			if (!TMDB_API_KEY) {
				throw new Error('TMDB API key not configured in environment')
			}

			const url = new URL(`${TMDB_BASE_URL}${data.endpoint}`)
			url.searchParams.set('api_key', TMDB_API_KEY)
			url.searchParams.set('language', 'es-ES')

			if (data.params) {
				for (const [key, value] of Object.entries(data.params)) {
					url.searchParams.set(key, value)
				}
			}

			const response = await fetch(url.toString())

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('API key inválida')
				}
				throw new Error(`TMDB API error: ${response.status}`)
			}

			return await response.json()
		} catch (error) {
			logger.error('TMDB request error:', error)
			throw error // Re-throw so the caller can handle it
		}
	})
}

/**
 * Setup GIPHY API handlers
 * Reads API key from env and proxies requests
 */
export function setupGiphyHandlers(): void {
	onMessage('giphyTrending', async ({ data }) => {
		try {
			const offset = Math.max(0, data.offset ?? 0)
			return await requestGiphy('trending', new URLSearchParams({ offset: String(offset) }))
		} catch (error) {
			logger.error('GIPHY trending request error:', error)
			throw error
		}
	})

	onMessage('giphySearch', async ({ data }) => {
		try {
			const query = data.query.trim()
			if (!query) {
				return { gifs: [], pagination: { totalCount: 0, count: 0, offset: 0 } }
			}

			const offset = Math.max(0, data.offset ?? 0)
			return await requestGiphy(
				'search',
				new URLSearchParams({
					q: query,
					offset: String(offset),
					lang: 'es',
				})
			)
		} catch (error) {
			logger.error('GIPHY search request error:', error)
			throw error
		}
	})
}

/**
 * Setup all API handlers
 */
export function setupApiHandlers(): void {
	setupOptionsHandler()
	setupSteamHandler()
	setupTmdbKeyCheckHandler()
	setupTmdbRequestHandler()
	setupGiphyHandlers()
}
