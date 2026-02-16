/**
 * Upload Handlers Module
 * Handles image uploads to ImgBB and freeimage.host services
 */

import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, API_URLS, FREEIMAGE_PUBLIC_KEY } from '@/constants'
import { onMessage, type UploadResult } from '@/lib/messaging'

// =============================================================================
// Storage Definitions
// =============================================================================

const settingsStorageItem = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
	defaultValue: null,
})

// =============================================================================
// Constants
// =============================================================================

const IMGBB_API_URL = API_URLS.IMGBB

// =============================================================================
// Upload Handlers
// =============================================================================

/**
 * Setup ImgBB upload message handler
 * Reads API key from storage and makes POST request
 */
export function setupImgbbHandler(): void {
	onMessage('uploadImageToImgbb', async ({ data }): Promise<UploadResult> => {
		try {
			// Read API key from Settings Store (Zustand persisted state)
			const rawSettings = await settingsStorageItem.getValue()
			let apiKey = ''

			if (rawSettings) {
				try {
					const parsed = JSON.parse(rawSettings)
					apiKey = parsed.state?.imgbbApiKey || ''
				} catch (e) {
					logger.error('Failed to parse settings in background', e)
				}
			}

			if (!apiKey) {
				return {
					success: false,
					error: 'API_KEY_REQUIRED',
				}
			}

			const formData = new FormData()
			formData.append('key', apiKey)
			formData.append('image', data.base64)

			if (data.fileName) {
				const name = data.fileName.replace(/\.[^/.]+$/, '')
				formData.append('name', name)
			}

			const response = await fetch(IMGBB_API_URL, {
				method: 'POST',
				body: formData,
			})

			const result = (await response.json()) as {
				success: boolean
				data?: {
					url: string
					display_url: string
					delete_url: string
					size: number
				}
				error?: {
					message: string
				}
			}

			if (result.success && result.data) {
				return {
					success: true,
					url: result.data.url || result.data.display_url,
					deleteUrl: result.data.delete_url,
					size: result.data.size,
				}
			} else {
				return {
					success: false,
					error: result.error?.message || 'Upload failed',
				}
			}
		} catch (error) {
			logger.error('ImgBB upload error:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			}
		}
	})
}

/**
 * Setup freeimage.host upload message handler
 * Uses public API key - permanent storage for free
 */
export function setupFreeimageHandler(): void {
	onMessage('uploadImageToFreeimage', async ({ data }): Promise<UploadResult> => {
		const fileName = data.fileName || `image_${Date.now()}.png`
		logger.debug(`Freeimage upload starting: ${fileName}`)
		const startTime = Date.now()

		try {
			const formData = new FormData()
			formData.append('key', FREEIMAGE_PUBLIC_KEY)
			formData.append('source', data.base64)
			formData.append('format', 'json')

			if (data.fileName) {
				const name = data.fileName.replace(/\.[^/.]+$/, '')
				formData.append('name', name)
			}

			logger.debug(`Sending to freeimage.host...`)
			const response = await fetch(API_URLS.FREEIMAGE, {
				method: 'POST',
				body: formData,
			})
			const elapsed = Date.now() - startTime
			logger.debug(`Freeimage response received in ${elapsed}ms, status: ${response.status}`)

			const result = (await response.json()) as {
				status_code: number
				success?: {
					message: string
					code: number
				}
				image?: {
					url: string
					display_url: string
					size: number
					delete_url?: string
				}
				error?: {
					message: string
					code: number
				}
			}

			if (result.status_code === 200 && result.image) {
				logger.debug(`Upload successful: ${result.image.display_url}`)
				return {
					success: true,
					url: result.image.url || result.image.display_url,
					deleteUrl: result.image.delete_url,
					size: result.image.size,
				}
			} else {
				logger.error(`Freeimage returned error:`, result.error)
				return {
					success: false,
					error: result.error?.message || 'Upload failed',
				}
			}
		} catch (error) {
			const elapsed = Date.now() - startTime
			logger.error(`Freeimage upload error after ${elapsed}ms:`, error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			}
		}
	})
}

/**
 * Setup all upload handlers
 */
export function setupUploadHandlers(): void {
	setupImgbbHandler()
	setupFreeimageHandler()
}
