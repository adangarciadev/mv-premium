/**
 * Service Adapters - Convert legacy service responses to Result Pattern
 *
 * These adapters provide a migration path from the legacy { success, error }
 * pattern to the type-safe Result pattern without breaking existing code.
 *
 * @example
 * ```typescript
 * // Legacy way (still works):
 * const result = await uploadImage(file)
 * if (result.success) {
 *   console.log(result.url)
 * }
 *
 * // New Result way:
 * const result = await uploadImageResult(file)
 * if (result.ok) {
 *   console.log(result.value.url)
 * }
 * ```
 */

import { ok, err, type Result } from '@/lib/result'
import type { UploadResult } from '@/lib/messaging'

// =============================================================================
// Types
// =============================================================================

/** Successful upload data */
export interface UploadSuccess {
	url: string
	deleteUrl?: string
	size?: number
}

/** Upload error data */
export interface UploadError {
	message: string
	code?: string
}

// =============================================================================
// Adapters
// =============================================================================

/**
 * Convert legacy UploadResult to Result pattern
 */
export function toUploadResult(legacy: UploadResult): Result<UploadSuccess, UploadError> {
	if (legacy.success && legacy.url) {
		return ok({
			url: legacy.url,
			deleteUrl: legacy.deleteUrl,
			size: legacy.size,
		})
	}

	return err({
		message: legacy.error || 'Upload failed',
		code: 'UPLOAD_FAILED',
	})
}

/**
 * Generic adapter for any { success, error } pattern
 */
export function fromLegacyResult<T extends { success: boolean; error?: string }>(
	legacy: T
): Result<Omit<T, 'success' | 'error'>, Error> {
	if (legacy.success) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { success, error, ...data } = legacy
		return ok(data as Omit<T, 'success' | 'error'>)
	}

	return err(new Error(legacy.error || 'Operation failed'))
}

// =============================================================================
// Wrapped Service Functions
// =============================================================================

/**
 * Upload an image and return Result
 * This wraps the legacy uploadImage function
 */
export async function uploadImageResult(file: File | Blob): Promise<Result<UploadSuccess, UploadError>> {
	const { uploadImage } = await import('@/services/api/imgbb')
	const legacy = await uploadImage(file)
	return toUploadResult(legacy)
}

/**
 * Validate and upload an image in one step
 */
export async function validateAndUpload(file: File): Promise<Result<UploadSuccess, UploadError>> {
	const { validateImageFile, uploadImage } = await import('@/services/api/imgbb')

	// Validate first
	const validation = validateImageFile(file)
	if (!validation.valid) {
		return err({
			message: validation.error || 'Validation failed',
			code: 'VALIDATION_ERROR',
		})
	}

	// Then upload
	const legacy = await uploadImage(file)
	return toUploadResult(legacy)
}
