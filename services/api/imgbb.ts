/**
 * ImgBB Image Upload Service
 *
 * ARCHITECTURE: This is a pure RPC facade. All network requests
 * are made via the background script to avoid CORS issues and
 * keep API keys secure.
 *
 * PROVIDERS:
 * - Catbox.moe: Default, no API key required, 200MB limit
 * - ImgBB: Optional, requires user-configured API key, 32MB limit
 *
 * API Documentation: https://api.imgbb.com/
 */
import { logger } from '@/lib/logger'
import { sendMessage, type UploadResult } from '@/lib/messaging'
import { getSettings } from '@/store/settings-store'

// Re-export types for external use
export type { UploadResult } from '@/lib/messaging'

// =============================================================================
// Constants
// =============================================================================

const MAX_FILE_SIZE_IMGBB = 32 * 1024 * 1024 // 32MB (ImgBB limit)
const MAX_FILE_SIZE_CATBOX = 200 * 1024 * 1024 // 200MB (Catbox limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']

// =============================================================================
// API Key Management (reads from Settings store)
// =============================================================================

export async function getApiKey(): Promise<string> {
	const settings = await getSettings()
	return settings.imgbbApiKey || ''
}

// =============================================================================
// Utilities
// =============================================================================

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
	if (!ALLOWED_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Tipo de archivo no soportado. Usa JPG, PNG, GIF o WebP.',
		}
	}

	// Use Catbox limit as default (larger)
	if (file.size > MAX_FILE_SIZE_CATBOX) {
		return {
			valid: false,
			error: 'La imagen es demasiado grande. Máximo 200MB.',
		}
	}

	return { valid: true }
}

// =============================================================================
// Base64 Conversion
// =============================================================================

/**
 * Convert a File or Blob to Base64 string
 */
function fileToBase64(file: File | Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			// Remove data URL prefix (e.g., "data:image/png;base64,")
			const base64 = result.split(',')[1]
			resolve(base64)
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

// =============================================================================
// Upload Function (via Background Script)
// =============================================================================

/**
 * Upload an image to the best available provider
 *
 * STRATEGY:
 * - If user has configured ImgBB API key AND file is under 32MB → Use ImgBB
 * - Otherwise → Use Catbox (no config needed, 200MB limit)
 *
 * @param file - File or Blob to upload
 * @returns Upload result with URL or error
 */
export async function uploadImage(file: File | Blob): Promise<UploadResult> {
	try {
		// Convert to Base64
		const base64 = await fileToBase64(file)
		const fileName = file instanceof File ? file.name : `image_${Date.now()}.jpg`

		// Check if user has ImgBB API key configured (from Settings store)
		const imgbbKey = await getApiKey()
		const useImgBB = imgbbKey && file.size <= MAX_FILE_SIZE_IMGBB

		let result: UploadResult

		if (useImgBB) {
			// Use ImgBB (user-configured)
			result = await sendMessage('uploadImageToImgbb', { base64, fileName })
		} else {
			// Use Catbox (default, no config needed)
			result = await sendMessage('uploadImageToCatbox', { base64, fileName })
		}

		return result
	} catch (error) {
		logger.error('Upload error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Upload failed',
		}
	}
}
