/**
 * Upload Handlers Module
 * Handles image uploads to ImgBB and freeimage.host services
 */

import { storage } from '#imports'
import { browser } from 'wxt/browser'
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
const RAW_UPLOAD_MESSAGE_TYPES = {
	imgbb: 'mvp-upload-image-to-imgbb',
	freeimage: 'mvp-upload-image-to-freeimage',
} as const

interface RawUploadMessage {
	type?: unknown
	data?: unknown
}

function isUploadPayload(data: unknown): data is { base64: string; fileName?: string } {
	if (!data || typeof data !== 'object') return false
	const payload = data as { base64?: unknown; fileName?: unknown }

	return (
		typeof payload.base64 === 'string' &&
		(payload.fileName === undefined || typeof payload.fileName === 'string')
	)
}

// =============================================================================
// Upload Handlers
// =============================================================================

async function getConfiguredImgbbApiKey(): Promise<string> {
	const rawSettings = await settingsStorageItem.getValue()
	if (!rawSettings) return ''

	try {
		const parsed = JSON.parse(rawSettings)
		return typeof parsed.state?.imgbbApiKey === 'string' ? parsed.state.imgbbApiKey : ''
	} catch (error) {
		logger.error('Failed to parse settings in background', error)
		return ''
	}
}

async function uploadBase64ToImgbb(data: { base64: string; fileName?: string }, apiKey: string): Promise<UploadResult> {
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
	}

	return {
		success: false,
		error: result.error?.message || 'Upload failed',
	}
}

async function uploadBase64ToFreeimage(data: { base64: string; fileName?: string }): Promise<UploadResult> {
	const fileName = data.fileName || `image_${Date.now()}.png`
	logger.debug(`Freeimage upload starting: ${fileName}`)
	const startTime = Date.now()

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
	}

	logger.error(`Freeimage returned error:`, result.error)
	return {
		success: false,
		error: result.error?.message || 'Upload failed',
	}
}

export async function uploadBase64ImageToBestProvider(data: { base64: string; fileName?: string }): Promise<UploadResult> {
	const apiKey = await getConfiguredImgbbApiKey()
	if (apiKey) {
		try {
			const imgbbResult = await uploadBase64ToImgbb(data, apiKey)
			if (imgbbResult.success) return imgbbResult
			logger.warn('ImgBB upload failed, trying freeimage.host fallback', imgbbResult.error)
		} catch (error) {
			logger.warn('ImgBB upload request failed, falling back to freeimage.host', error)
		}
	}

	return uploadBase64ToFreeimage(data)
}

/**
 * Setup ImgBB upload message handler
 * Reads API key from storage and makes POST request
 */
export function setupImgbbHandler(): void {
	onMessage('uploadImageToImgbb', async ({ data }): Promise<UploadResult> => {
		try {
			const apiKey = await getConfiguredImgbbApiKey()

			if (!apiKey) {
				return {
					success: false,
					error: 'API_KEY_REQUIRED',
				}
			}

			return uploadBase64ToImgbb(data, apiKey)
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
		try {
			return uploadBase64ToFreeimage(data)
		} catch (error) {
			logger.error(`Freeimage upload error:`, error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			}
		}
	})
}

function setupRawUploadHandlers(): void {
	browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: UploadResult) => void) => {
		const request = message as RawUploadMessage
		if (!isUploadPayload(request.data)) return false
		const payload = request.data

		if (request.type === RAW_UPLOAD_MESSAGE_TYPES.imgbb) {
			void (async () => {
				const apiKey = await getConfiguredImgbbApiKey()
				if (!apiKey) {
					sendResponse({ success: false, error: 'API_KEY_REQUIRED' })
					return
				}

				sendResponse(await uploadBase64ToImgbb(payload, apiKey))
			})()
			return true
		}

		if (request.type === RAW_UPLOAD_MESSAGE_TYPES.freeimage) {
			void uploadBase64ToFreeimage(payload).then(sendResponse).catch(error => {
				logger.error('Raw freeimage upload error:', error)
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : 'Network error',
				})
			})
			return true
		}

		return false
	})
}

/**
 * Setup all upload handlers
 */
export function setupUploadHandlers(): void {
	setupImgbbHandler()
	setupFreeimageHandler()
	setupRawUploadHandlers()
}
