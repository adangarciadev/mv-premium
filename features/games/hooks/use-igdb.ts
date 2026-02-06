/**
 * IGDB Hooks (Lite version - No TanStack Query)
 *
 * OPTIMIZATION: Uses native fetch + useState instead of TanStack Query
 * to eliminate the 60KB TanStack dependency from the content script.
 *
 * Only includes hooks needed for the game template dialog.
 */

import { useState, useEffect, useRef } from 'react'
import { searchGames, getGameTemplateData, hasIgdbCredentials } from '@/services/api/igdb'
import type { IGDBGame, GameFetchStep } from '@/services/api/igdb'
import type { GameTemplateDataInput } from '@/types/templates'

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
// IGDB Hooks
// =============================================================================

/**
 * Hook to check if IGDB credentials are configured
 */
export function useIgdbCredentials() {
	return useFetch('igdb:credentials', () => hasIgdbCredentials(), true)
}

/**
 * Hook to search for games
 */
export function useGameSearch(query: string, enabled = true) {
	return useFetch<IGDBGame[]>(`igdb:search:${query}`, () => searchGames(query), enabled && query.length >= 2)
}

/**
 * Hook to get game template data
 */
export function useGameTemplateData(gameId: number, enabled = true) {
	return useFetch<GameTemplateDataInput | null>(
		`igdb:template:${gameId}`,
		() => getGameTemplateData(gameId),
		enabled && gameId > 0
	)
}

/**
 * Hook to get game template data with step-by-step loading progress.
 * Reports which phase the fetch is in (IGDB → Steam → done).
 */
export function useGameTemplateDataWithProgress(gameId: number, enabled = true) {
	const [data, setData] = useState<GameTemplateDataInput | null | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [loadingStep, setLoadingStep] = useState<GameFetchStep | null>(null)
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
		const key = `igdb:template:${gameId}`

		if (!enabled || gameId <= 0) {
			setData(undefined)
			setLoadingStep(null)
			setError(null)
			return
		}

		// If key changed, clear old data first
		if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
			setData(undefined)
		}
		prevKeyRef.current = key

		// Check cache — if hit, no loading state at all
		const cached = getCached<GameTemplateDataInput | null>(key)
		if (cached !== undefined) {
			setData(cached)
			setLoadingStep(null)
			return
		}

		const doFetch = async () => {
			setIsLoading(true)
			setError(null)
			try {
				const result = await getGameTemplateData(gameId, step => {
					if (isMounted.current) setLoadingStep(step)
				})
				if (isMounted.current) {
					setData(result)
					setCache(key, result)
					setLoadingStep(null)
				}
			} catch (err) {
				if (isMounted.current) {
					setError(err instanceof Error ? err : new Error('Fetch failed'))
					setLoadingStep(null)
				}
			} finally {
				if (isMounted.current) {
					setIsLoading(false)
				}
			}
		}

		doFetch()
		// eslint-disable-next-line react-hooks/exhaustive-deps -- gameId and enabled are the only deps
	}, [gameId, enabled])

	return { data, isLoading, loadingStep, error, isError: !!error }
}
