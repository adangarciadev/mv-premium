/**
 * Action Feedback Hook
 * Standardizes loading state and toast notifications for async actions
 *
 * NOTE: Removed Zod import to keep content script bundle small.
 * ZodError detection uses duck typing instead of instanceof.
 */
import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

// Duck typing for ZodError (avoids importing Zod just for type checking)
interface ZodLikeError extends Error {
	issues: Array<{ path: (string | number)[]; message: string }>
}

function isZodError(error: unknown): error is ZodLikeError {
	return error instanceof Error && 'issues' in error && Array.isArray((error as ZodLikeError).issues)
}

interface ActionOptions<T> {
	/** Message to show on success */
	successMessage?: string | ((data: T) => string)
	/** Message to show on error (defaults to error message) */
	errorMessage?: string | ((error: Error) => string)
	/** Whether to show detailed error in toast description */
	showErrorDetails?: boolean
	/** Callback on success */
	onSuccess?: (data: T) => void
	/** Callback on error */
	onError?: (error: Error) => void
}

export function useActionFeedback() {
	const [isLoading, setIsLoading] = useState(false)

	const execute = useCallback(
		async <T>(action: () => Promise<T>, options: ActionOptions<T> = {}): Promise<T | null> => {
			setIsLoading(true)
			try {
				const result = await action()

				// Success handling
				if (options.successMessage) {
					const msg =
						typeof options.successMessage === 'function' ? options.successMessage(result) : options.successMessage
					toast.success(msg)
				}

				options.onSuccess?.(result)
				return result
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))

				// Error handling
				let msg = 'Ha ocurrido un error inesperado'
				let description = undefined

				if (options.errorMessage) {
					msg = typeof options.errorMessage === 'function' ? options.errorMessage(err) : options.errorMessage
				} else {
					// Default error message logic
					msg = err.message
				}

				// Zod validation errors (duck typing to avoid Zod import)
				if (isZodError(err)) {
					msg = 'Error de validación'
					description = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
				}
				// Clean up "Exceeded quota" messages from browser storage
				else if (err.message?.includes('QUOTA_BYTES')) {
					msg = 'Espacio de almacenamiento lleno'
				}

				if (options.showErrorDetails) {
					description = err.message
				}

				toast.error(msg, { description })
				options.onError?.(err)
				logger.error('Action Error:', err)

				return null
			} finally {
				setIsLoading(false)
			}
		},
		[]
	)

	return { isLoading, execute }
}
