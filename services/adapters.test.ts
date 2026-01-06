/**
 * Tests for Service Adapters
 */

import { describe, it, expect } from 'vitest'
import { toUploadResult, fromLegacyResult } from './adapters'
import type { UploadResult } from '@/lib/messaging'

describe('service-adapters', () => {
	describe('toUploadResult()', () => {
		it('converts successful upload to Ok result', () => {
			const legacy: UploadResult = {
				success: true,
				url: 'https://example.com/image.png',
				deleteUrl: 'https://example.com/delete/123',
				size: 12345,
			}

			const result = toUploadResult(legacy)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value.url).toBe('https://example.com/image.png')
				expect(result.value.deleteUrl).toBe('https://example.com/delete/123')
				expect(result.value.size).toBe(12345)
			}
		})

		it('converts failed upload to Err result', () => {
			const legacy: UploadResult = {
				success: false,
				error: 'File too large',
			}

			const result = toUploadResult(legacy)

			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.message).toBe('File too large')
				expect(result.error.code).toBe('UPLOAD_FAILED')
			}
		})

		it('handles missing error message', () => {
			const legacy: UploadResult = {
				success: false,
			}

			const result = toUploadResult(legacy)

			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.message).toBe('Upload failed')
			}
		})

		it('treats success without url as error', () => {
			const legacy: UploadResult = {
				success: true,
				// Missing url
			}

			const result = toUploadResult(legacy)

			expect(result.ok).toBe(false)
		})
	})

	describe('fromLegacyResult()', () => {
		it('converts generic success to Ok', () => {
			const legacy = {
				success: true,
				data: { foo: 'bar' },
				count: 42,
			}

			const result = fromLegacyResult(legacy)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value).toEqual({ data: { foo: 'bar' }, count: 42 })
			}
		})

		it('converts generic failure to Err', () => {
			const legacy = {
				success: false,
				error: 'Something went wrong',
			}

			const result = fromLegacyResult(legacy)

			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.message).toBe('Something went wrong')
			}
		})

		it('handles missing error message', () => {
			const legacy = {
				success: false,
			}

			const result = fromLegacyResult(legacy)

			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.message).toBe('Operation failed')
			}
		})

		it('preserves all extra properties on success', () => {
			const legacy = {
				success: true,
				id: 123,
				name: 'Test',
				metadata: { created: '2025-01-01' },
			}

			const result = fromLegacyResult(legacy)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value).toEqual({
					id: 123,
					name: 'Test',
					metadata: { created: '2025-01-01' },
				})
			}
		})
	})
})
