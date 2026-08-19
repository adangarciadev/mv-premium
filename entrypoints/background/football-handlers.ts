/**
 * Football Data API Handlers Module
 *
 * Reads the user's football-data.org API key from persisted settings and
 * proxies raw match requests through the background context.
 */

import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { onMessage, type FootballDataResult } from '@/lib/messaging'

// =============================================================================
// Storage Definitions
// =============================================================================

const settingsStorageItem = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
	defaultValue: null,
})

// =============================================================================
// Constants and Types
// =============================================================================

const FOOTBALL_DATA_API_URL = 'https://api.football-data.org/v4/competitions'
const REQUESTS_REMAINING_HEADER = 'x-requests-available-minute'

type FootballCompetition = 'PD' | 'CL'

interface PersistedSettings {
	state?: {
		footballDataApiKey?: unknown
	}
}

// =============================================================================
// Helpers
// =============================================================================

async function getConfiguredFootballDataApiKey(): Promise<string> {
	const rawSettings = await settingsStorageItem.getValue()
	if (!rawSettings) return ''

	try {
		const parsed = JSON.parse(rawSettings) as PersistedSettings
		return typeof parsed.state?.footballDataApiKey === 'string' ? parsed.state.footballDataApiKey : ''
	} catch (error) {
		logger.error('Failed to parse settings in background', error)
		return ''
	}
}

function isFootballCompetition(value: unknown): value is FootballCompetition {
	return value === 'PD' || value === 'CL'
}

function getRequestsRemaining(response: Response): number | null {
	const headerValue = response.headers.get(REQUESTS_REMAINING_HEADER)
	if (headerValue === null || headerValue.trim() === '') return null

	const requestsRemaining = Number(headerValue)
	return Number.isFinite(requestsRemaining) ? requestsRemaining : null
}

function createFailureResult(reason: Extract<FootballDataResult, { ok: false }>['reason']): FootballDataResult {
	return { ok: false, reason }
}

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Setup the football-data.org API request handler.
 *
 * The handler returns the API's raw JSON payload. Normalization and caching
 * belong to the content-script layer in a later phase of the feature.
 */
export function setupFootballHandlers(): void {
	onMessage('footballDataRequest', async ({ data }) => {
		try {
			const apiKey = await getConfiguredFootballDataApiKey()
			if (!apiKey) {
				return createFailureResult('no-key')
			}

			if (!isFootballCompetition(data.competition)) {
				logger.warn('Rejected football data request with invalid competition', data.competition)
				return createFailureResult('network')
			}

			const url = new URL(`${FOOTBALL_DATA_API_URL}/${data.competition}/matches`)
			url.searchParams.set('dateFrom', data.dateFrom)
			url.searchParams.set('dateTo', data.dateTo)

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'X-Auth-Token': apiKey,
				},
			})

			if (response.status === 403) {
				return createFailureResult('invalid-key')
			}

			if (response.status === 429) {
				return createFailureResult('quota-exceeded')
			}

			if (!response.ok) {
				return createFailureResult('network')
			}

			const payload: unknown = await response.json()
			return {
				ok: true as const,
				payload,
				requestsRemaining: getRequestsRemaining(response),
			}
		} catch (error) {
			logger.error('Football data request failed', error)
			return createFailureResult('network')
		}
	})
}
