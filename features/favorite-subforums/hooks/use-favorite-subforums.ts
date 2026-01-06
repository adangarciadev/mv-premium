/**
 * useFavoriteSubforums - Hook for managing favorite subforums
 */
import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import {
	getFavoriteSubforums,
	addFavoriteSubforum,
	removeFavoriteSubforum,
	toggleFavoriteSubforum,
	isSubforumFavorite,
} from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import type { FavoriteSubforum } from '@/types/storage'

export interface UseFavoriteSubforumsResult {
	/** List of favorite subforums */
	subforums: FavoriteSubforum[]
	/** Loading state */
	isLoading: boolean
	/** Error message if any */
	error: string | null
	/** Check if a specific subforum is favorited */
	isFavorite: (subforumId: string) => boolean
	/** Add a subforum to favorites */
	add: (subforum: Omit<FavoriteSubforum, 'addedAt'>) => Promise<void>
	/** Remove a subforum from favorites */
	remove: (subforumId: string) => Promise<void>
	/** Toggle a subforum's favorite status */
	toggle: (subforum: Omit<FavoriteSubforum, 'addedAt'>) => Promise<boolean>
	/** Refresh the list from storage */
	refetch: () => Promise<void>
}

/**
 * useFavoriteSubforums hook - Full manager for favorite subforums
 * Handles synchronization, loading states, and CRUD operations.
 */
export function useFavoriteSubforums(): UseFavoriteSubforumsResult {
	const [subforums, setSubforums] = useState<FavoriteSubforum[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchSubforums = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const data = await getFavoriteSubforums()
			setSubforums(data)
		} catch (err) {
			logger.error('Error fetching favorite subforums:', err)
			setError('Error al cargar los subforos favoritos')
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchSubforums()

		// Subscribe to changes using centralized listener system
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => {
			void fetchSubforums()
		})

		return unsubscribe
	}, [fetchSubforums])

	const isFavorite = useCallback((subforumId: string) => subforums.some(s => s.id === subforumId), [subforums])

	const add = useCallback(async (subforum: Omit<FavoriteSubforum, 'addedAt'>) => {
		try {
			const updated = await addFavoriteSubforum(subforum)
			setSubforums(updated)
		} catch (err) {
			logger.error('Error adding favorite subforum:', err)
			throw err
		}
	}, [])

	const remove = useCallback(async (subforumId: string) => {
		try {
			const updated = await removeFavoriteSubforum(subforumId)
			setSubforums(updated)
		} catch (err) {
			logger.error('Error removing favorite subforum:', err)
			throw err
		}
	}, [])

	const toggle = useCallback(async (subforum: Omit<FavoriteSubforum, 'addedAt'>): Promise<boolean> => {
		try {
			const result = await toggleFavoriteSubforum(subforum)
			setSubforums(result.subforums)
			return result.isFavorite
		} catch (err) {
			logger.error('Error toggling favorite subforum:', err)
			throw err
		}
	}, [])

	return {
		subforums,
		isLoading,
		error,
		isFavorite,
		add,
		remove,
		toggle,
		refetch: fetchSubforums,
	}
}

/**
 * Standalone hook to check if a single subforum is favorited
 * Useful for buttons that only need to know favorite state
 */
/**
 * useIsSubforumFavorite hook - Specialized lightweight hook for single-subforum checks
 * @param subforumId - The ID/slug to track
 */
export function useIsSubforumFavorite(subforumId: string): {
	isFavorite: boolean
	isLoading: boolean
	refetch: () => Promise<void>
} {
	const [isFavorite, setIsFavorite] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	const checkFavorite = useCallback(async () => {
		try {
			setIsLoading(true)
			const result = await isSubforumFavorite(subforumId)
			setIsFavorite(result)
		} catch (err) {
			logger.error('Error checking subforum favorite status:', err)
		} finally {
			setIsLoading(false)
		}
	}, [subforumId])

	useEffect(() => {
		void checkFavorite()

		// Subscribe to changes using centralized listener system
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => void checkFavorite())

		return unsubscribe
	}, [checkFavorite])

	return {
		isFavorite,
		isLoading,
		refetch: checkFavorite,
	}
}
