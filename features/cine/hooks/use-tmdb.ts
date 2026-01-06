/**
 * TMDB Hooks (Lite version - No TanStack Query)
 *
 * OPTIMIZATION: Uses native fetch + useState instead of TanStack Query
 * to eliminate the 60KB TanStack dependency from the content script.
 *
 * Only includes hooks needed for the movie template dialog.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
	searchMovies,
	getMovieTemplateData,
	searchTVShows,
	getTVShowTemplateData,
	getSeasonTemplateData,
} from '@/services/api/tmdb'
import type { TVShowTemplateData } from '@/services/api/tmdb'

// =============================================================================
// Simple in-memory cache
// =============================================================================

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getCached<T>(key: string): T | undefined {
	const cached = cache.get(key)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as T
	}
	return undefined
}

function setCache(key: string, data: unknown) {
	cache.set(key, { data, timestamp: Date.now() })
}

// =============================================================================
// Generic fetch hook
// =============================================================================

function useFetch<T>(key: string, fetchFn: () => Promise<T>, enabled: boolean) {
	const [data, setData] = useState<T | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const isMounted = useRef(true)
	const prevKeyRef = useRef<string | null>(null)

	useEffect(() => {
		isMounted.current = true
		return () => {
			isMounted.current = false
		}
	}, [])

	useEffect(() => {
		// Clear data when disabled or when key changes significantly
		if (!enabled) {
			setData(undefined)
			setError(null)
			return
		}

		// If key changed, clear old data first
		if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
			setData(undefined)
		}
		prevKeyRef.current = key

		// Check cache
		const cached = getCached<T>(key)
		if (cached !== undefined) {
			setData(cached)
			return
		}

		const doFetch = async () => {
			setIsLoading(true)
			setError(null)
			try {
				const result = await fetchFn()
				if (isMounted.current) {
					setData(result)
					setCache(key, result)
				}
			} catch (err) {
				if (isMounted.current) {
					setError(err instanceof Error ? err : new Error('Fetch failed'))
				}
			} finally {
				if (isMounted.current) {
					setIsLoading(false)
				}
			}
		}

		doFetch()
		// eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFn is inline and would cause infinite loops
	}, [key, enabled])

	return { data, isLoading, error, isError: !!error }
}

// =============================================================================
// Movie Queries (only what's needed for movie template dialog)
// =============================================================================

/**
 * useMovieSearch hook - Performs debounced searches against the TMDB API.
 * Implementation avoids TanStack Query for reduced bundle weight.
 */
export function useMovieSearch(query: string, enabled = true) {
	return useFetch(`tmdb:search:${query}`, () => searchMovies(query), enabled && query.length >= 2)
}

/**
 * useMovieTemplateData hook - Retrieves full details and credits for a specific movie.
 * Normalized for Mediavida template generation.
 */
export function useMovieTemplateData(movieId: number, enabled = true) {
	return useFetch(`tmdb:template:${movieId}`, () => getMovieTemplateData(movieId), enabled && movieId > 0)
}

// =============================================================================
// TV Show Queries
// =============================================================================

/**
 * useTVShowSearch hook - Performs debounced searches for TV series against TMDB API.
 */
export function useTVShowSearch(query: string, enabled = true) {
	return useFetch(`tmdb:search-tv:${query}`, () => searchTVShows(query), enabled && query.length >= 2)
}

/**
 * useTVShowTemplateData hook - Retrieves full details, credits, and seasons for a TV series.
 */
export function useTVShowTemplateData(tvId: number, enabled = true) {
	return useFetch(`tmdb:tv-template:${tvId}`, () => getTVShowTemplateData(tvId), enabled && tvId > 0)
}

/**
 * useSeasonTemplateData hook - Retrieves details for a specific season.
 * Requires the series template data to be passed in for context.
 */
export function useSeasonTemplateData(
	tvId: number,
	seasonNumber: number,
	seriesData: TVShowTemplateData | null,
	enabled = true
) {
	return useFetch(
		`tmdb:season-template:${tvId}:${seasonNumber}`,
		() => getSeasonTemplateData(tvId, seasonNumber, seriesData!),
		enabled && tvId > 0 && seasonNumber > 0 && seriesData !== null
	)
}
