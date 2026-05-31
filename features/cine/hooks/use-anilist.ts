/**
 * AniList Hooks (Lite version - No TanStack Query)
 *
 * Mirrors the TMDB dialog hooks with native fetch + useState to keep
 * the injected content-script bundle lean.
 */

import { useEffect, useRef, useState } from 'react'
import { getAnimeTemplateData, getMangaTemplateData, searchAnime, searchManga } from '@/services/api/anilist'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000

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
		if (!enabled) {
			setData(undefined)
			setError(null)
			return
		}

		if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
			setData(undefined)
		}
		prevKeyRef.current = key

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

export function useAnimeSearch(query: string, enabled = true) {
	return useFetch(`anilist:anime-search:${query}`, () => searchAnime(query), enabled && query.length >= 2)
}

export function useMangaSearch(query: string, enabled = true) {
	return useFetch(`anilist:manga-search:${query}`, () => searchManga(query), enabled && query.length >= 2)
}

export function useAnimeTemplateData(mediaId: number, enabled = true) {
	return useFetch(`anilist:anime-template:${mediaId}`, () => getAnimeTemplateData(mediaId), enabled && mediaId > 0)
}

export function useMangaTemplateData(mediaId: number, enabled = true) {
	return useFetch(`anilist:manga-template:${mediaId}`, () => getMangaTemplateData(mediaId), enabled && mediaId > 0)
}
