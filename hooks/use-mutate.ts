/**
 * useMutate Hook - Simplified mutations with optimistic updates
 *
 * Inspired by MVTools pattern. Provides:
 * - Optimistic cache updates
 * - Partial state mutations
 * - Built-in loading/error states
 * - Optional toast notifications
 *
 * @example
 * ```tsx
 * const { mutate, mutatePartial, isPending } = useMutate(
 *   ['user-settings'],
 *   async (data) => await saveSettings(data),
 *   { showToast: true }
 * )
 *
 * // Update single field
 * mutatePartial({ theme: 'dark' })
 *
 * // Update with callback (access previous state)
 * mutatePartial(prev => ({ counter: prev.counter + 1 }))
 * ```
 */
import { useCallback } from 'react'
import { logger } from '@/lib/logger'
import { type MutationFunction, type QueryKey, useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// =============================================================================
// TYPES
// =============================================================================

export interface UseMutateOptions {
	/** Show toast notification on success */
	showToast?: boolean
	/** Custom success message for toast */
	successMessage?: string
	/** Custom error message for toast */
	errorMessage?: string
	/** Callback after successful mutation */
	onSuccess?: () => void
	/** Callback on mutation error */
	onError?: (error: Error) => void
}

export interface UseMutateResult<T> {
	/** Execute mutation with full data */
	mutate: (data: T) => void
	/** Execute mutation with partial data (merges with existing) */
	mutatePartial: (partial: Partial<T> | ((prev: T) => Partial<T>)) => void
	/** Async version of mutate */
	mutateAsync: (data: T) => Promise<void>
	/** Whether a mutation is in progress */
	isPending: boolean
	/** Whether any mutation with this key is in progress */
	isMutating: boolean
	/** Last error from mutation */
	error: Error | null
	/** Reset mutation state */
	reset: () => void
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for simplified mutations with optimistic updates.
 *
 * @param queryKey - TanStack Query key for cache management
 * @param mutationFn - Function that performs the actual mutation (e.g., API call, storage write)
 * @param options - Configuration options
 */
export function useMutate<T>(
	queryKey: QueryKey,
	mutationFn: MutationFunction<void, T>,
	options: UseMutateOptions = {}
): UseMutateResult<T> {
	const {
		showToast = false,
		successMessage = 'Guardado correctamente',
		errorMessage = 'Error al guardar',
		onSuccess,
		onError,
	} = options

	const queryClient = useQueryClient()
	const isMutating = useIsMutating({ mutationKey: queryKey }) > 0

	const mutation = useMutation({
		mutationKey: queryKey,
		mutationFn,
		onMutate: async (newData: T) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey })

			// Snapshot previous value
			const previousData = queryClient.getQueryData<T>(queryKey)

			// Optimistically update cache
			queryClient.setQueryData(queryKey, newData)

			// Return context for rollback
			return { previousData }
		},
		onSuccess: (_data, variables) => {
			// Ensure cache is updated with final data
			queryClient.setQueryData(queryKey, variables)

			if (showToast) {
				toast.success(successMessage)
			}

			onSuccess?.()
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousData !== undefined) {
				queryClient.setQueryData(queryKey, context.previousData)
			}

			if (showToast) {
				toast.error(errorMessage)
			}

			onError?.(error as Error)
		},
	})

	/**
	 * Mutate with partial data - merges with existing cache data
	 */
	const mutatePartial = useCallback(
		(partial: Partial<T> | ((prev: T) => Partial<T>)) => {
			const currentData = queryClient.getQueryData<T>(queryKey)

			if (!currentData) {
				logger.warn('No existing data in cache for key:', queryKey)
				return
			}

			// Resolve partial (function or object)
			const resolvedPartial = typeof partial === 'function' ? partial(currentData) : partial

			// Merge with existing data
			const newData = { ...currentData, ...resolvedPartial }

			mutation.mutate(newData)
		},
		[mutation.mutate, queryClient, queryKey]
	)

	return {
		mutate: mutation.mutate,
		mutatePartial,
		mutateAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		isMutating,
		error: mutation.error as Error | null,
		reset: mutation.reset,
	}
}

// =============================================================================
// SPECIALIZED VARIANTS
// =============================================================================

/**
 * useMutate variant for storage-backed data.
 * Automatically shows toast and handles common storage patterns.
 */
export function useStorageMutate<T>(storageKey: string, saveFn: (data: T) => Promise<void>): UseMutateResult<T> {
	return useMutate<T>(['storage', storageKey], saveFn, {
		showToast: true,
		successMessage: 'Configuración guardada',
		errorMessage: 'Error al guardar configuración',
	})
}
