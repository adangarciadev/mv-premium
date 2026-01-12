/**
 * Upload Handlers Module
 * Handles image uploads to ImgBB and Catbox services
 */

import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, API_URLS } from '@/constants'
import { onMessage, type UploadResult } from '@/lib/messaging'

// =============================================================================
// Storage Definitions
// =============================================================================

const imgbbApiKeyStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.IMGBB_KEY}`, {
	defaultValue: null,
})

// =============================================================================
// Constants
// =============================================================================

const IMGBB_API_URL = API_URLS.IMGBB
const CATBOX_API_URL = 'https://catbox.moe/user/api.php'

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
			const settingsStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
				defaultValue: null,
			})
			const rawSettings = await settingsStorage.getValue()
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
					url: result.data.display_url,
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
 * Setup Catbox upload message handler
 * No API key required - anonymous uploads
 */
export function setupCatboxHandler(): void {
	onMessage('uploadImageToCatbox', async ({ data }): Promise<UploadResult> => {
		const fileName = data.fileName || `image_${Date.now()}.png`
		logger.debug(`Catbox upload starting: ${fileName}`)
		const startTime = Date.now()

		try {
			// Convert base64 to Blob
			logger.debug(`Converting base64 to blob...`)
			const byteCharacters = atob(data.base64)
			const byteNumbers = new Array(byteCharacters.length)
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i)
			}
			const byteArray = new Uint8Array(byteNumbers)

			// Determine MIME type from filename or default to image/png
			let mimeType = 'image/png'
			if (data.fileName) {
				const ext = data.fileName.split('.').pop()?.toLowerCase()
				if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
				else if (ext === 'png') mimeType = 'image/png'
				else if (ext === 'gif') mimeType = 'image/gif'
			}

			const blob = new Blob([byteArray], { type: mimeType })
			logger.debug(`Blob created: ${(blob.size / 1024).toFixed(1)}KB, type: ${mimeType}`)

			// Create FormData for Catbox API
			const formData = new FormData()
			formData.append('reqtype', 'fileupload')
			formData.append('fileToUpload', blob, fileName)

			logger.debug(`Sending to Catbox...`)
			const response = await fetch(CATBOX_API_URL, {
				method: 'POST',
				body: formData,
			})
			const elapsed = Date.now() - startTime
			logger.debug(`Catbox response received in ${elapsed}ms, status: ${response.status}`)

			if (!response.ok) {
				throw new Error(`Catbox error: ${response.status}`)
			}

			// Catbox returns the URL as plain text
			const url = await response.text()
			logger.debug(`Catbox response body:`, url.substring(0, 100))

			if (url.startsWith('https://')) {
				logger.debug(`Upload successful: ${url.trim()}`)
				return {
					success: true,
					url: url.trim(),
					size: blob.size,
				}
			} else {
				logger.error(`Catbox returned error:`, url)
				return {
					success: false,
					error: url || 'Upload failed',
				}
			}
		} catch (error) {
			const elapsed = Date.now() - startTime
			logger.error(`Catbox upload error after ${elapsed}ms:`, error)
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
	setupCatboxHandler()
}
