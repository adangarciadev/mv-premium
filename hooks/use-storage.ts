/**
 * useStorage Hook
 *
 * Generic reactive hook for WXT storage items.
 * Provides automatic subscription to storage changes with proper cleanup.
 *
 * @example
 * ```tsx
 * import { favoriteSubforumsStorage } from '@/features/favorite-subforums/storage'
 *
 * function MyComponent() {
 *   const { value, loading, setValue } = useStorage(favoriteSubforumsStorage, [])
 *
 *   if (loading) return <Spinner />
 *   return <div>{value.length} favorites</div>
 * }
 * ```
 */
import { useState, useEffect, useCallback } from 'react'

// WXT storage item interface (simplified for our needs)
interface StorageItem<T> {
	getValue(): Promise<T>
	setValue(value: T): Promise<void>
	watch(callback: (newValue: T | null, oldValue: T | null) => void): () => void
}

export interface UseStorageResult<T> {
	/** Current value from storage */
	value: T
	/** True during initial load */
	loading: boolean
	/** Update the storage value */
	setValue: (newValue: T) => Promise<void>
	/** Refresh the value from storage */
	refresh: () => Promise<void>
}

/**
 * Generic hook for reactive WXT storage access.
 * Automatically subscribes to changes and handles cleanup.
 *
 * @param item - WXT storage item created with `storage.defineItem()`
 * @param initialValue - Initial value to use before storage loads
 * @returns Object with value, loading state, and setValue function
 */
export function useStorage<T>(item: StorageItem<T>, initialValue: T): UseStorageResult<T> {
	// Initialize with provided initial value
	const [value, setValueState] = useState<T>(initialValue)
	const [loading, setLoading] = useState(true)

	// Memoized refresh function
	const refresh = useCallback(async () => {
		const storedValue = await item.getValue()
		setValueState(storedValue)
		setLoading(false)
	}, [item])

	// Memoized setValue function
	const setValue = useCallback(
		async (newValue: T) => {
			await item.setValue(newValue)
			// State will be updated by the watcher
		},
		[item]
	)

	useEffect(() => {
		// Load initial value
		void refresh()

		// Subscribe to storage changes
		const unwatch = item.watch(newValue => {
			if (newValue !== null && newValue !== undefined) {
				setValueState(newValue)
			}
		})

		// Cleanup subscription on unmount
		return unwatch
	}, [item, refresh])

	return { value, loading, setValue, refresh }
}

/**
 * Hook variant that includes a transform function for computed values
 *
 * @example
 * ```tsx
 * const { value: sortedFavorites } = useStorageTransform(
 *   favoriteSubforumsStorage,
 *   [],
 *   (favs) => favs.sort((a, b) => b.addedAt - a.addedAt)
 * )
 * ```
 */
export function useStorageTransform<T, R>(
	item: StorageItem<T>,
	initialValue: T,
	transform: (value: T) => R
): Omit<UseStorageResult<R>, 'setValue'> & { rawValue: T; setRawValue: (value: T) => Promise<void> } {
	const { value: rawValue, loading, setValue: setRawValue, refresh } = useStorage(item, initialValue)

	const transformedValue = transform(rawValue)

	return {
		value: transformedValue,
		rawValue,
		loading,
		setRawValue,
		refresh,
	}
}
