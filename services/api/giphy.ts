/**
 * GIPHY API Service
 * API facade for GIPHY integration.
 * All external requests are proxied through background handlers.
 */

import { sendMessage } from '@/lib/messaging'

// Constants
const GIFS_PER_PAGE = 18

// ============================================================================
// Types
// ============================================================================

export interface GiphyGif {
	id: string
	title: string
	url: string // Original size URL for insertion
	previewUrl: string // Small preview for grid display
}

export interface GiphyPaginatedResponse {
	gifs: GiphyGif[]
	pagination: {
		totalCount: number
		count: number
		offset: number
	}
}

// ============================================================================
// API Functions (for useInfiniteQuery)
// ============================================================================

/**
 * Get trending GIFs with pagination data
 */
export async function getTrendingGifs(offset = 0): Promise<GiphyPaginatedResponse> {
	return await sendMessage('giphyTrending', { offset: Math.max(0, offset) })
}

/**
 * Search GIFs by query with pagination data
 */
export async function searchGifs(query: string, offset = 0): Promise<GiphyPaginatedResponse> {
	const trimmedQuery = query.trim()
	if (!trimmedQuery) {
		return { gifs: [], pagination: { totalCount: 0, count: 0, offset: 0 } }
	}

	return await sendMessage('giphySearch', {
		query: trimmedQuery,
		offset: Math.max(0, offset),
	})
}

export { GIFS_PER_PAGE }
