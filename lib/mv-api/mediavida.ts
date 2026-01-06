/**
 * Mediavida API Core
 *
 * Token management and atomic operations for Mediavida's backend.
 * All operations are pure functions that accept a token and return discriminated results.
 */

import { MV_SELECTORS } from '@/constants/mediavida-selectors'
import { MV_URLS } from '@/constants'
import type { MutationResult, ToggleBookmarkParams, ToggleFavoriteParams } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_HEADERS = {
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'X-Requested-With': 'XMLHttpRequest',
} as const

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get the CSRF token from the current DOM.
 * Reads from the #token hidden input.
 */
export function getToken(): string | null {
	const tokenInput = document.getElementById(MV_SELECTORS.GLOBAL.TOKEN_INPUT_ID) as HTMLInputElement | null
	return tokenInput?.value || null
}

/**
 * Refresh the CSRF token by fetching a page and extracting it.
 * Also updates the token in the current DOM if present.
 *
 * @param fallbackPage - Page to fetch for token (default: /foro/marcadores)
 */
export async function refreshToken(fallbackPage = MV_URLS.BOOKMARKS_PAGE): Promise<string> {
	const response = await fetch(fallbackPage, {
		credentials: 'same-origin',
	})

	if (!response.ok) {
		throw new Error(`Failed to refresh token: HTTP ${response.status}`)
	}

	const html = await response.text()
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')
	const tokenInput = doc.getElementById(MV_SELECTORS.GLOBAL.TOKEN_INPUT_ID) as HTMLInputElement | null

	if (!tokenInput?.value) {
		throw new Error('Token not found in refreshed page')
	}

	// Update token in current DOM
	const currentTokenInput = document.getElementById(MV_SELECTORS.GLOBAL.TOKEN_INPUT_ID) as HTMLInputElement | null
	if (currentTokenInput) {
		currentTokenInput.value = tokenInput.value
	}

	return tokenInput.value
}

// ============================================================================
// ATOMIC OPERATIONS
// ============================================================================

/**
 * Toggle a bookmark (add or delete).
 * Returns a discriminated result for proper error handling.
 */
export async function toggleBookmark({
	threadId,
	postId,
	action,
	token,
}: ToggleBookmarkParams): Promise<MutationResult<string>> {
	try {
		const body = new URLSearchParams({
			tid: threadId,
			num: postId,
			undo: action === 'delete' ? 'true' : 'false',
			token,
		}).toString()

		const response = await fetch(MV_URLS.BOOKMARK_ACTION, {
			method: 'POST',
			headers: DEFAULT_HEADERS,
			credentials: 'same-origin',
			body,
		})

		// Check for auth/token errors
		if (response.status === 401 || response.status === 403) {
			return { status: 'token_expired' }
		}

		if (!response.ok) {
			return { status: 'error', message: `HTTP ${response.status}` }
		}

		// MV API returns {ok: true/false, data: 1/0} or just a number
		const result = await response.json()
		const success =
			typeof result === 'object' && result !== null ? result.ok === true || result.data === 1 : result === 1

		if (success) {
			return { status: 'success', data: `${threadId}-${postId}` }
		}

		return { status: 'error', message: 'API returned failure' }
	} catch (error) {
		return {
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}

/**
 * Toggle a favorite (add or delete).
 * Returns a discriminated result for proper error handling.
 */
export async function toggleFavorite({
	threadId,
	action,
	token,
}: ToggleFavoriteParams): Promise<MutationResult<string>> {
	try {
		const todo = action === 'delete' ? 'delfav' : 'newfav'
		const body = `todo=${todo}&tid=${threadId}&token=${token}`

		const response = await fetch(MV_URLS.FAVORITE_ACTION, {
			method: 'POST',
			headers: DEFAULT_HEADERS,
			credentials: 'same-origin',
			body,
		})

		// Check for auth/token errors
		if (response.status === 401 || response.status === 403) {
			return { status: 'token_expired' }
		}

		if (!response.ok) {
			return { status: 'error', message: `HTTP ${response.status}` }
		}

		// MV returns "1" on success
		const text = await response.text()
		if (text.trim() === '1') {
			return { status: 'success', data: threadId }
		}

		return { status: 'error', message: 'API returned failure' }
	} catch (error) {
		return {
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}
