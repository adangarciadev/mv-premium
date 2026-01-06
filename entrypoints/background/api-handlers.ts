/**
 * API Handlers Module
 * Handles external API requests (Steam, TMDB)
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { fetchSteamGameDetails } from '@/services/api/steam'
import { onMessage } from '@/lib/messaging'
import { API_URLS } from '@/constants'

// =============================================================================
// Constants
// =============================================================================

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = API_URLS.TMDB_BASE

// =============================================================================
// API Handlers
// =============================================================================

/**
 * Setup options page opener handler
 */
export function setupOptionsHandler(): void {
	onMessage('openOptionsPage', ({ data: view }) => {
		let url = browser.runtime.getURL('/options.html')
		if (view) {
			// Support query params in view: "settings?tab=ai" -> "#/settings?tab=ai"
			url += `#/${view}`
		}
		browser.tabs.create({ url })
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
 * Setup all API handlers
 */
export function setupApiHandlers(): void {
	setupOptionsHandler()
	setupSteamHandler()
	setupTmdbKeyCheckHandler()
	setupTmdbRequestHandler()
}
