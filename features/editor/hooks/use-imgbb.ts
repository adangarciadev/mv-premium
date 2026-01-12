/**
 * Image Upload Hooks (Lite version - No TanStack Query)
 *
 * OPTIMIZATION: Uses native async functions instead of useMutation
 * to eliminate TanStack Query from the content script bundle.
 */
import { useState, useCallback } from 'react'
import { uploadImage } from '@/services/api/imgbb'
import { useSettingsStore } from '@/store/settings-store'

// =============================================================================
// Upload Hook
// =============================================================================

/**
 * useUploadImage hook - Provides a lightweight interface for single image uploads.
 */
export function useUploadImage() {
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const mutateAsync = useCallback(async (file: File | Blob) => {
		setIsPending(true)
		setError(null)
		try {
			const result = await uploadImage(file)
			return result
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Upload failed')
			setError(error)
			throw error
		} finally {
			setIsPending(false)
		}
	}, [])

	const mutate = useCallback(
		(file: File | Blob, options?: { onSuccess?: () => void; onError?: (err: Error) => void }) => {
			mutateAsync(file)
				.then(() => options?.onSuccess?.())
				.catch(err => options?.onError?.(err))
		},
		[mutateAsync]
	)

	return { mutate, mutateAsync, isPending, error, isError: !!error }
}

// =============================================================================
// API Key Management
// =============================================================================

/**
 * useSetImgbbApiKey hook - Persistence for the ImgBB authentication token.
 */
export function useSetImgbbApiKey() {
	const [isPending, setIsPending] = useState(false)
	const setImgbbApiKey = useSettingsStore(state => state.setImgbbApiKey)

	const mutateAsync = useCallback(async (key: string) => {
		setIsPending(true)
		try {
			setImgbbApiKey(key)
		} finally {
			setIsPending(false)
		}
	}, [setImgbbApiKey])

	const mutate = useCallback(
		(key: string, options?: { onSuccess?: () => void }) => {
			mutateAsync(key).then(() => options?.onSuccess?.())
		},
		[mutateAsync]
	)

	return { mutate, mutateAsync, isPending }
}

/**
 * useClearImgbbApiKey hook - Removal of the ImgBB authentication token.
 */
export function useClearImgbbApiKey() {
	const [isPending, setIsPending] = useState(false)
	const setImgbbApiKey = useSettingsStore(state => state.setImgbbApiKey)

	const mutateAsync = useCallback(async () => {
		setIsPending(true)
		try {
			setImgbbApiKey('')
		} finally {
			setIsPending(false)
		}
	}, [setImgbbApiKey])

	const mutate = useCallback(
		(options?: { onSuccess?: () => void }) => {
			mutateAsync().then(() => options?.onSuccess?.())
		},
		[mutateAsync]
	)

	return { mutate, mutateAsync, isPending }
}

// =============================================================================
// Query Keys (for backwards compatibility)
// =============================================================================

export const imgbbKeys = {
	all: ['imgbb'] as const,
	stats: () => [...imgbbKeys.all, 'stats'] as const,
}
