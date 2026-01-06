/**
 * GIPHY API Service
 * API layer for GIPHY GIF integration with pagination support
 */

import { API_URLS } from '@/constants'

// Constants
const GIPHY_BASE_URL = API_URLS.GIPHY
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''
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

interface GiphyApiImage {
	url: string
	width: string
	height: string
}

interface GiphyApiGif {
	id: string
	title: string
	images: {
		original: GiphyApiImage
		fixed_height_small: GiphyApiImage
	}
}

interface GiphyApiResponse {
	data: GiphyApiGif[]
	pagination: {
		total_count: number
		count: number
		offset: number
	}
	meta: {
		status: number
		msg: string
	}
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformGif(gif: GiphyApiGif): GiphyGif {
	return {
		id: gif.id,
		title: gif.title || 'GIF',
		url: gif.images.original.url,
		previewUrl: gif.images.fixed_height_small.url,
	}
}

// ============================================================================
// API Functions (for useInfiniteQuery)
// ============================================================================

/**
 * Get trending GIFs with pagination data
 */
export async function getTrendingGifs(offset = 0): Promise<GiphyPaginatedResponse> {
	const params = new URLSearchParams({
		api_key: GIPHY_API_KEY,
		limit: String(GIFS_PER_PAGE),
		offset: String(offset),
		rating: 'g',
	})

	const response = await fetch(`${GIPHY_BASE_URL}/trending?${params}`)

	if (!response.ok) {
		throw new Error(`GIPHY API error: ${response.status}`)
	}

	const data: GiphyApiResponse = await response.json()

	return {
		gifs: data.data.map(transformGif),
		pagination: {
			totalCount: data.pagination.total_count,
			count: data.pagination.count,
			offset: data.pagination.offset,
		},
	}
}

/**
 * Search GIFs by query with pagination data
 */
export async function searchGifs(query: string, offset = 0): Promise<GiphyPaginatedResponse> {
	if (!query.trim()) {
		return { gifs: [], pagination: { totalCount: 0, count: 0, offset: 0 } }
	}

	const params = new URLSearchParams({
		api_key: GIPHY_API_KEY,
		q: query.trim(),
		limit: String(GIFS_PER_PAGE),
		offset: String(offset),
		rating: 'g',
		lang: 'es',
	})

	const response = await fetch(`${GIPHY_BASE_URL}/search?${params}`)

	if (!response.ok) {
		throw new Error(`GIPHY API error: ${response.status}`)
	}

	const data: GiphyApiResponse = await response.json()

	return {
		gifs: data.data.map(transformGif),
		pagination: {
			totalCount: data.pagination.total_count,
			count: data.pagination.count,
			offset: data.pagination.offset,
		},
	}
}

export { GIFS_PER_PAGE }
