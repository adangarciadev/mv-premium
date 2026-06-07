/**
 * Image Upload Service
 *
 * ARCHITECTURE: This is a pure RPC facade. All network requests
 * are made via the background script to avoid CORS issues and
 * keep API keys secure.
 *
 * PROVIDERS:
 * - freeimage.host: Default, uses public API key, permanent storage, 64MB limit
 * - ImgBB: Optional, requires user-configured API key, 32MB limit
 *
 * API Documentation: https://api.imgbb.com/
 */
import { logger } from '@/lib/logger'
import { sendMessage, type UploadPayload, type UploadResult } from '@/lib/messaging'
import { getSettings } from '@/store/settings-store'
import { browser } from 'wxt/browser'

// Re-export types for external use
export type { UploadResult } from '@/lib/messaging'

// =============================================================================
// Constants
// =============================================================================

const MAX_FILE_SIZE_IMGBB = 32 * 1024 * 1024 // 32MB (ImgBB limit)
const MAX_FILE_SIZE_FREEIMAGE = 64 * 1024 * 1024 // 64MB (freeimage.host limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const RAW_UPLOAD_MESSAGE_TYPES = {
	imgbb: 'mvp-upload-image-to-imgbb',
	freeimage: 'mvp-upload-image-to-freeimage',
} as const

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

	// Use freeimage.host limit as default
	if (file.size > MAX_FILE_SIZE_FREEIMAGE) {
		return {
			valid: false,
			error: 'La imagen es demasiado grande. Máximo 64MB.',
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

async function sendUploadMessage(
	provider: keyof typeof RAW_UPLOAD_MESSAGE_TYPES,
	data: UploadPayload
): Promise<UploadResult> {
	try {
		return await sendMessage(provider === 'imgbb' ? 'uploadImageToImgbb' : 'uploadImageToFreeimage', data)
	} catch (error) {
		logger.warn('Typed upload messaging failed, trying raw runtime message fallback', error)
		return await browser.runtime.sendMessage({
			type: RAW_UPLOAD_MESSAGE_TYPES[provider],
			data,
		}) as UploadResult
	}
}

// =============================================================================
// Upload Function (via Background Script)
// =============================================================================

/**
 * Upload an image to the best available provider
 *
 * STRATEGY:
 * - If the user has configured ImgBB under 32MB → use ImgBB
 * - Otherwise → use freeimage.host (permanent storage, 64MB limit)
 *
 * @param file - File or Blob to upload
 * @returns Upload result with URL or error
 */
export async function uploadImage(file: File | Blob): Promise<UploadResult> {
	try {
		// Convert to Base64
		const base64 = await fileToBase64(file)
		const fileName = file instanceof File ? file.name : `image_${Date.now()}.jpg`
		const mimeType = file.type || 'image/jpeg'
		const payload: UploadPayload = {
			base64,
			fileName,
			mimeType,
			fileSize: file.size,
		}

		const imgbbKey = await getApiKey()
		if (imgbbKey) {
			if (file.size > MAX_FILE_SIZE_IMGBB) {
				return {
					success: false,
					error: 'La imagen es demasiado grande para ImgBB. Máximo 32MB.',
					errorCode: 'payload_too_large',
					provider: 'imgbb',
				}
			}

			logger.debug('Uploading image with configured ImgBB API key')
			return await sendUploadMessage('imgbb', payload)
		}

		logger.debug('Uploading image with freeimage.host because ImgBB is not configured')
		return await sendUploadMessage('freeimage', payload)
	} catch (error) {
		logger.error('Upload error:', error)
		return {
			success: false,
			error: 'No se pudo preparar o subir la imagen. Revisa la conexión e inténtalo de nuevo.',
			errorCode: 'network_error',
		}
	}
}
