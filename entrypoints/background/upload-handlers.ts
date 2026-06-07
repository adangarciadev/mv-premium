/**
 * Upload Handlers Module
 * Handles image uploads to ImgBB and freeimage.host services
 */

import { storage } from '#imports'
import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, API_URLS, FREEIMAGE_PUBLIC_KEY } from '@/constants'
import { onMessage, type UploadPayload, type UploadResult } from '@/lib/messaging'
import {
	classifyUploadError,
	getUploadErrorUserMessage,
	type UploadAttemptInfo,
	type UploadErrorCode,
	type UploadProvider,
} from '@/lib/upload-errors'

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
const MAX_FILE_SIZE_IMGBB = 32 * 1024 * 1024
const RAW_UPLOAD_MESSAGE_TYPES = {
	imgbb: 'mvp-upload-image-to-imgbb',
	freeimage: 'mvp-upload-image-to-freeimage',
} as const

interface RawUploadMessage {
	type?: unknown
	data?: unknown
}

function isUploadPayload(data: unknown): data is UploadPayload {
	if (!data || typeof data !== 'object') return false
	const payload = data as { base64?: unknown; fileName?: unknown; mimeType?: unknown; fileSize?: unknown }

	return (
		typeof payload.base64 === 'string' &&
		(payload.fileName === undefined || typeof payload.fileName === 'string') &&
		(payload.mimeType === undefined || typeof payload.mimeType === 'string') &&
		(payload.fileSize === undefined || typeof payload.fileSize === 'number')
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

function estimateBase64Size(base64: string): number {
	const normalized = base64.replace(/\s/g, '')
	const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
	return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
}

function getUploadSize(data: UploadPayload): number {
	return data.fileSize ?? estimateBase64Size(data.base64)
}

function getMimeTypeFromFileName(fileName?: string): string {
	const extension = fileName?.split('.').pop()?.toLowerCase()
	if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
	if (extension === 'png') return 'image/png'
	if (extension === 'gif') return 'image/gif'
	if (extension === 'webp') return 'image/webp'
	return 'image/jpeg'
}

function sanitizeUploadName(fileName?: string): string {
	const fallback = `image_${Date.now()}`
	const withoutExtension = (fileName || fallback).replace(/\.[^/.]+$/, '')
	const sanitized = withoutExtension.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
	return sanitized || fallback
}

async function readJsonResponse(response: Response): Promise<unknown> {
	try {
		return await response.json()
	} catch {
		return null
	}
}

function logUploadFailure(
	provider: UploadProvider,
	data: UploadPayload,
	details: { status?: number; message?: string; errorCode: UploadErrorCode; source?: string }
): void {
	logger.warn('Image upload failed', {
		provider,
		status: details.status,
		message: details.message,
		errorCode: details.errorCode,
		source: details.source,
		fileName: data.fileName,
		fileSize: getUploadSize(data),
		mimeType: data.mimeType || getMimeTypeFromFileName(data.fileName),
	})
}

function createFailureResult(
	provider: UploadProvider,
	data: UploadPayload,
	details: { status?: number; message?: string; source?: string }
): UploadResult {
	const errorCode = classifyUploadError({
		status: details.status,
		message: details.message,
		provider,
	})
	const attempt: UploadAttemptInfo = {
		provider,
		status: details.status,
		errorCode,
		message: details.message,
	}

	logUploadFailure(provider, data, { ...details, errorCode })

	return {
		success: false,
		error: getUploadErrorUserMessage(errorCode, provider),
		errorCode,
		provider,
		attempts: [attempt],
	}
}

function createNetworkFailure(provider: UploadProvider, data: UploadPayload, error: unknown): UploadResult {
	const message = error instanceof Error ? error.message : 'Network error'
	logUploadFailure(provider, data, { message, errorCode: 'network_error' })
	return {
		success: false,
		error: getUploadErrorUserMessage('network_error', provider),
		errorCode: 'network_error',
		provider,
		attempts: [{ provider, errorCode: 'network_error', message }],
	}
}

function mergeFailureAttempts(primary: UploadResult, fallback: UploadResult): UploadAttemptInfo[] {
	return [...(primary.attempts ?? []), ...(fallback.attempts ?? [])]
}

function base64ToBlob(base64: string, mimeType: string): Blob {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index)
	}
	return new Blob([bytes], { type: mimeType })
}

async function uploadBase64ToImgbb(data: UploadPayload, apiKey: string): Promise<UploadResult> {
	const formData = new FormData()
	formData.append('key', apiKey)
	formData.append('image', data.base64)

	if (data.fileName) {
		formData.append('name', sanitizeUploadName(data.fileName))
	}

	try {
		const response = await fetch(IMGBB_API_URL, {
			method: 'POST',
			body: formData,
		})

		const result = (await readJsonResponse(response)) as {
			success?: boolean
			data?: {
				url?: string
				display_url?: string
				delete_url?: string
				size?: number
			}
			error?: {
				message?: string
				code?: number
			}
		}

		if (response.ok && result?.success && result.data && (result.data.url || result.data.display_url)) {
			return {
				success: true,
				url: result.data.url || result.data.display_url,
				deleteUrl: result.data.delete_url,
				size: result.data.size,
				provider: 'imgbb',
			}
		}

		return createFailureResult('imgbb', data, {
			status: response.status,
			message: result?.error?.message || response.statusText || 'Upload failed',
		})
	} catch (error) {
		return createNetworkFailure('imgbb', data, error)
	}
}

async function postToFreeimage(data: UploadPayload, source: string | Blob, sourceLabel: string): Promise<UploadResult> {
	const fileName = data.fileName || `image_${Date.now()}.png`
	const startTime = Date.now()

	const formData = new FormData()
	formData.append('key', FREEIMAGE_PUBLIC_KEY)
	if (source instanceof Blob) {
		formData.append('source', source, fileName)
	} else {
		formData.append('source', source)
	}
	formData.append('format', 'json')
	formData.append('name', sanitizeUploadName(fileName))

	try {
		const response = await fetch(API_URLS.FREEIMAGE, {
			method: 'POST',
			body: formData,
		})
		const elapsed = Date.now() - startTime
		logger.debug(`Freeimage response received in ${elapsed}ms`, {
			status: response.status,
			source: sourceLabel,
			fileName,
			fileSize: getUploadSize(data),
			mimeType: data.mimeType || getMimeTypeFromFileName(fileName),
		})

		const result = (await readJsonResponse(response)) as {
			status_code?: number
			success?: {
				message?: string
				code?: number
			}
			image?: {
				url?: string
				display_url?: string
				size?: number
				delete_url?: string
			}
			error?: {
				message?: string
				code?: number
			}
		}

		if (response.ok && result?.status_code === 200 && result.image && (result.image.url || result.image.display_url)) {
			logger.debug(`Upload successful: ${result.image.display_url || result.image.url}`)
			return {
				success: true,
				url: result.image.url || result.image.display_url,
				deleteUrl: result.image.delete_url,
				size: result.image.size,
				provider: 'freeimage',
			}
		}

		return createFailureResult('freeimage', data, {
			status: response.status,
			message: result?.error?.message || response.statusText || 'Upload failed',
			source: sourceLabel,
		})
	} catch (error) {
		return createNetworkFailure('freeimage', data, error)
	}
}

async function uploadBase64ToFreeimage(data: UploadPayload): Promise<UploadResult> {
	const fileName = data.fileName || `image_${Date.now()}.png`
	logger.debug(`Freeimage upload starting: ${fileName}`)

	const base64Result = await postToFreeimage(data, data.base64, 'base64')
	if (base64Result.success || base64Result.errorCode !== 'internal_error') return base64Result

	logger.warn('Freeimage returned an internal upload error, retrying as binary multipart', {
		fileName,
		fileSize: getUploadSize(data),
		mimeType: data.mimeType || getMimeTypeFromFileName(fileName),
	})

	const blob = base64ToBlob(data.base64, data.mimeType || getMimeTypeFromFileName(fileName))
	const binaryResult = await postToFreeimage(data, blob, 'binary')
	if (binaryResult.success) return binaryResult

	return {
		...binaryResult,
		attempts: mergeFailureAttempts(base64Result, binaryResult),
	}
}

export async function uploadBase64ImageToBestProvider(data: UploadPayload): Promise<UploadResult> {
	const apiKey = await getConfiguredImgbbApiKey()
	if (apiKey) {
		if (getUploadSize(data) > MAX_FILE_SIZE_IMGBB) {
			return createFailureResult('imgbb', data, {
				status: 413,
				message: 'ImgBB max file size is 32MB',
			})
		}

		logger.debug('Uploading image with configured ImgBB API key', {
			fileName: data.fileName,
			fileSize: getUploadSize(data),
			mimeType: data.mimeType || getMimeTypeFromFileName(data.fileName),
		})
		return uploadBase64ToImgbb(data, apiKey)
	}

	logger.debug('Uploading image with freeimage.host because ImgBB is not configured', {
		fileName: data.fileName,
		fileSize: getUploadSize(data),
		mimeType: data.mimeType || getMimeTypeFromFileName(data.fileName),
	})
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
					error: getUploadErrorUserMessage('invalid_api_key', 'imgbb'),
					errorCode: 'invalid_api_key',
					provider: 'imgbb',
				}
			}

			return uploadBase64ToImgbb(data, apiKey)
		} catch (error) {
			logger.error('ImgBB upload error:', error)
			return createNetworkFailure('imgbb', data, error)
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
			return createNetworkFailure('freeimage', data, error)
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
					sendResponse({
						success: false,
						error: getUploadErrorUserMessage('invalid_api_key', 'imgbb'),
						errorCode: 'invalid_api_key',
						provider: 'imgbb',
					})
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
					error: getUploadErrorUserMessage('network_error', 'freeimage'),
					errorCode: 'network_error',
					provider: 'freeimage',
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
