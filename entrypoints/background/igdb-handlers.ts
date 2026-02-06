/**
 * IGDB API Handlers Module
 *
 * Handles IGDB API requests with Twitch OAuth authentication.
 * The IGDB API requires Twitch OAuth credentials (Client ID + Secret)
 * which are configured via environment variables (like TMDB).
 *
 * OAuth Flow:
 * 1. Use Client Credentials Grant to get access token from Twitch
 * 2. Cache the token (valid for ~60 days)
 * 3. Use token for all IGDB API requests
 */

import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { onMessage } from '@/lib/messaging'

// =============================================================================
// Constants
// =============================================================================

const IGDB_BASE_URL = 'https://api.igdb.com/v4'
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token'

// Credentials from environment (baked into extension at build time)
const IGDB_CLIENT_ID = import.meta.env.VITE_IGDB_CLIENT_ID || ''
const IGDB_CLIENT_SECRET = import.meta.env.VITE_IGDB_CLIENT_SECRET || ''

// Storage keys for token caching only
const STORAGE_KEY_ACCESS_TOKEN = 'local:mvp-igdb-access-token'
const STORAGE_KEY_TOKEN_EXPIRY = 'local:mvp-igdb-token-expiry'

// =============================================================================
// Token Management
// =============================================================================

interface TwitchTokenResponse {
	access_token: string
	expires_in: number
	token_type: string
}

/**
 * Check if IGDB credentials are configured in environment
 */
function hasCredentials(): boolean {
	return !!(IGDB_CLIENT_ID && IGDB_CLIENT_SECRET)
}

/**
 * Get cached access token if still valid
 */
async function getCachedToken(): Promise<string | null> {
	const token = await storage.getItem<string>(STORAGE_KEY_ACCESS_TOKEN)
	const expiry = await storage.getItem<number>(STORAGE_KEY_TOKEN_EXPIRY)

	if (!token || !expiry) {
		return null
	}

	// Check if token is still valid (with 5 minute buffer)
	const now = Date.now()
	const bufferMs = 5 * 60 * 1000 // 5 minutes
	if (expiry - bufferMs <= now) {
		logger.debug('IGDB token expired, will refresh')
		return null
	}

	return token
}

/**
 * Fetch new access token from Twitch
 */
async function fetchAccessToken(): Promise<string> {
	const params = new URLSearchParams({
		client_id: IGDB_CLIENT_ID,
		client_secret: IGDB_CLIENT_SECRET,
		grant_type: 'client_credentials',
	})

	const response = await fetch(TWITCH_AUTH_URL, {
		method: 'POST',
		body: params,
	})

	if (!response.ok) {
		const error = await response.text()
		logger.error('Twitch OAuth error:', error)
		throw new Error('Error de autenticación con Twitch')
	}

	const data: TwitchTokenResponse = await response.json()

	// Cache the token
	const expiryTime = Date.now() + data.expires_in * 1000
	await storage.setItem(STORAGE_KEY_ACCESS_TOKEN, data.access_token)
	await storage.setItem(STORAGE_KEY_TOKEN_EXPIRY, expiryTime)

	logger.debug('IGDB token refreshed, expires in:', data.expires_in, 'seconds')
	return data.access_token
}

/**
 * Get valid access token (from cache or fetch new)
 */
async function getAccessToken(): Promise<string> {
	if (!hasCredentials()) {
		throw new Error('IGDB API credentials not configured in environment')
	}

	// Try cached token first
	const cached = await getCachedToken()
	if (cached) {
		return cached
	}

	// Need to fetch new token
	return fetchAccessToken()
}

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Setup handler to check if IGDB credentials are configured
 */
export function setupIgdbCredentialsCheckHandler(): void {
	onMessage('hasIgdbCredentials', () => {
		return hasCredentials()
	})
}

/**
 * Setup handler for IGDB API requests
 */
export function setupIgdbRequestHandler(): void {
	onMessage('igdbRequest', async ({ data }) => {
		try {
			if (!hasCredentials()) {
				throw new Error('IGDB API credentials not configured in environment')
			}

			const token = await getAccessToken()

			const url = `${IGDB_BASE_URL}${data.endpoint}`
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Client-ID': IGDB_CLIENT_ID,
					Authorization: `Bearer ${token}`,
					'Content-Type': 'text/plain',
				},
				body: data.body,
			})

			if (!response.ok) {
				if (response.status === 401) {
					// Token might have been invalidated, clear cache and retry once
					await storage.removeItem(STORAGE_KEY_ACCESS_TOKEN)
					await storage.removeItem(STORAGE_KEY_TOKEN_EXPIRY)

					const newToken = await getAccessToken()
					const retryResponse = await fetch(url, {
						method: 'POST',
						headers: {
							'Client-ID': IGDB_CLIENT_ID,
							Authorization: `Bearer ${newToken}`,
							'Content-Type': 'text/plain',
						},
						body: data.body,
					})

					if (!retryResponse.ok) {
						throw new Error(`IGDB API error: ${retryResponse.status}`)
					}

					return await retryResponse.json()
				}

				throw new Error(`IGDB API error: ${response.status}`)
			}

			return await response.json()
		} catch (error) {
			logger.error('IGDB request error:', error)
			throw error
		}
	})
}

// =============================================================================
// Setup All IGDB Handlers
// =============================================================================

/**
 * Setup all IGDB-related message handlers
 */
export function setupIgdbHandlers(): void {
	setupIgdbCredentialsCheckHandler()
	setupIgdbRequestHandler()
}
