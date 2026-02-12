/**
 * Compressed Storage Service
 *
 * Provides transparent compression for high-growth storage keys using lz-string.
 * Only specific keys are compressed; others are stored as normal JSON.
 *
 * Uses Base64 encoding (1 byte per char) instead of UTF16 (2 bytes per char)
 * for better actual storage savings in browser.storage.local.
 */
import LZString from 'lz-string'
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS } from '@/constants'

// Keys that should be compressed (high-growth data)
const COMPRESSED_KEYS = [STORAGE_KEYS.ACTIVITY, STORAGE_KEYS.DRAFTS]

// Marker prefix to detect compressed data
const COMPRESSED_MARKER = '__LZB64__'

/**
 * Check if a key should use compression
 */
function shouldCompress(key: string): boolean {
	return COMPRESSED_KEYS.some(k => key.includes(k))
}

/**
 * Check if data is compressed (has our marker)
 */
function isCompressed(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith(COMPRESSED_MARKER)
}

/**
 * Compress value to Base64 string with marker
 * Base64 uses ASCII (1 byte per char) which is more efficient than UTF16 (2 bytes per char)
 */
function compress<T>(value: T): string {
	const json = JSON.stringify(value)
	const compressed = LZString.compressToBase64(json)
	return COMPRESSED_MARKER + compressed
}

/**
 * Decompress value from Base64 string (strips marker)
 */
function decompress<T>(compressedValue: string): T {
	const withoutMarker = compressedValue.slice(COMPRESSED_MARKER.length)
	const json = LZString.decompressFromBase64(withoutMarker)
	if (!json) {
		throw new Error('Failed to decompress data')
	}
	return JSON.parse(json) as T
}

/**
 * Get a value from storage, automatically decompressing if needed.
 * Works for both compressed and uncompressed data (transparent migration).
 * Supports both old UTF16 format (__LZ__) and new Base64 format (__LZB64__).
 */
export async function getCompressed<T>(key: `local:${string}`): Promise<T | null> {
	const rawValue = await storage.getItem<T | string>(key)

	if (rawValue === null || rawValue === undefined) {
		return null
	}

	// Check for new Base64 format
	if (typeof rawValue === 'string' && rawValue.startsWith(COMPRESSED_MARKER)) {
		try {
			return decompress<T>(rawValue)
		} catch (error) {
			logger.error(`Failed to decompress ${key}:`, error)
			return null
		}
	}

	// Check for old UTF16 format (backwards compatibility)
	if (typeof rawValue === 'string' && rawValue.startsWith('__LZ__')) {
		try {
			const withoutMarker = rawValue.slice(6) // '__LZ__'.length
			const json = LZString.decompressFromUTF16(withoutMarker)
			if (json) {
				return JSON.parse(json) as T
			}
		} catch (error) {
			logger.error(`Failed to decompress legacy UTF16 ${key}:`, error)
			return null
		}
	}

	// Otherwise return as-is (uncompressed data)
	return rawValue as T
}

/**
 * Set a value to storage, automatically compressing if the key is in COMPRESSED_KEYS.
 */
export async function setCompressed<T>(key: `local:${string}`, value: T): Promise<void> {
	if (shouldCompress(key)) {
		const compressedValue = compress(value)
		await storage.setItem(key, compressedValue)
	} else {
		await storage.setItem(key, value)
	}
}

/**
 * Remove a value from storage
 */
export async function removeCompressed(key: `local:${string}`): Promise<void> {
	await storage.removeItem(key)
}

/**
 * Get a full snapshot of storage with all compressed values decompressed.
 * Used by export function to produce human-readable JSON.
 */
export async function getDecompressedSnapshot(): Promise<Record<string, unknown>> {
	const snapshot = await storage.snapshot('local')
	const result: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(snapshot)) {
		if (isCompressed(value)) {
			try {
				result[key] = decompress(value as string)
			} catch {
				// If decompression fails, include raw value
				result[key] = value
			}
		} else {
			result[key] = value
		}
	}

	return result
}

/**
 * Import data, automatically compressing keys that need it.
 * Used by import function to restore from human-readable JSON.
 */
export async function setFromImport(key: string, value: unknown): Promise<void> {
	const fullKey = key.startsWith('local:') ? key : `local:${key}`
	await setCompressed(fullKey as `local:${string}`, value)
}

// Re-export watch functionality for convenience (no compression needed for watching)
export { storage }
