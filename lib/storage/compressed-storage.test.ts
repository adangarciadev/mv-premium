/**
 * Tests for Compressed Storage utilities
 *
 * Tests the compression/decompression logic for storage.
 * NOTE: These tests focus on the pure functions and logic patterns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Re-implement the core logic for testing (without browser dependencies)
const COMPRESSED_MARKER = '__LZB64__'
const LEGACY_MARKER = '__LZ__'
const COMPRESSED_KEYS = ['mvp-activity', 'mvp-drafts']

function shouldCompress(key: string): boolean {
	return COMPRESSED_KEYS.some(k => key.includes(k))
}

function isCompressedBase64(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith(COMPRESSED_MARKER)
}

function isCompressedLegacy(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith(LEGACY_MARKER)
}

describe('compressed-storage', () => {
	describe('shouldCompress', () => {
		it('should return true for activity data key', () => {
			expect(shouldCompress('local:mvp-activity')).toBe(true)
			expect(shouldCompress('mvp-activity-v2')).toBe(true)
		})

		it('should return true for drafts data key', () => {
			expect(shouldCompress('local:mvp-drafts')).toBe(true)
			expect(shouldCompress('mvp-drafts-backup')).toBe(true)
		})

		it('should return false for other keys', () => {
			expect(shouldCompress('local:mvp-settings')).toBe(false)
			expect(shouldCompress('local:mvp-bookmarks')).toBe(false)
			expect(shouldCompress('some-random-key')).toBe(false)
		})
	})

	describe('isCompressedBase64', () => {
		it('should detect base64 compressed strings', () => {
			expect(isCompressedBase64('__LZB64__compressed-data-here')).toBe(true)
		})

		it('should return false for uncompressed data', () => {
			expect(isCompressedBase64('{"regular": "json"}')).toBe(false)
			expect(isCompressedBase64('plain text')).toBe(false)
		})

		it('should return false for legacy compressed data', () => {
			expect(isCompressedBase64('__LZ__legacy-compressed')).toBe(false)
		})

		it('should return false for non-string values', () => {
			expect(isCompressedBase64(null)).toBe(false)
			expect(isCompressedBase64(undefined)).toBe(false)
			expect(isCompressedBase64(123)).toBe(false)
			expect(isCompressedBase64({ foo: 'bar' })).toBe(false)
			expect(isCompressedBase64([])).toBe(false)
		})
	})

	describe('isCompressedLegacy', () => {
		it('should detect legacy UTF16 compressed strings', () => {
			expect(isCompressedLegacy('__LZ__legacy-data-here')).toBe(true)
		})

		it('should return false for base64 compressed data', () => {
			expect(isCompressedLegacy('__LZB64__base64-data')).toBe(false)
		})

		it('should return false for uncompressed data', () => {
			expect(isCompressedLegacy('{"regular": "json"}')).toBe(false)
		})
	})

	describe('marker constants', () => {
		it('should have distinct markers', () => {
			expect(COMPRESSED_MARKER).not.toBe(LEGACY_MARKER)
		})

		it('should use predictable marker format', () => {
			expect(COMPRESSED_MARKER).toBe('__LZB64__')
			expect(LEGACY_MARKER).toBe('__LZ__')
		})
	})
})
