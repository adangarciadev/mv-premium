/**
 * Tests for ID Generator utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateId, generateSimpleId } from './id-generator'

describe('id-generator', () => {
	describe('generateId', () => {
		it('should generate a string', () => {
			const id = generateId()
			expect(typeof id).toBe('string')
		})

		it('should generate unique IDs', () => {
			const ids = new Set<string>()
			for (let i = 0; i < 100; i++) {
				ids.add(generateId())
			}
			expect(ids.size).toBe(100)
		})

		it('should generate non-empty strings', () => {
			const id = generateId()
			expect(id.length).toBeGreaterThan(0)
		})

		describe('when crypto.randomUUID is available', () => {
			it('should return a UUID format', () => {
				const id = generateId()
				// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
				const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
				expect(id).toMatch(uuidRegex)
			})
		})

		describe('when crypto.randomUUID is not available', () => {
			const originalCrypto = global.crypto

			beforeEach(() => {
				// Mock crypto without randomUUID
				Object.defineProperty(global, 'crypto', {
					value: {},
					writable: true,
				})
			})

			afterEach(() => {
				Object.defineProperty(global, 'crypto', {
					value: originalCrypto,
					writable: true,
				})
			})

			it('should fallback to timestamp-based ID', () => {
				const id = generateId()
				// Fallback format: timestamp-random
				expect(id).toMatch(/^\d+-[a-z0-9]+$/)
			})
		})
	})

	describe('generateSimpleId', () => {
		it('should generate a string', () => {
			const id = generateSimpleId()
			expect(typeof id).toBe('string')
		})

		it('should generate timestamp-based IDs', () => {
			const id = generateSimpleId()
			// Format: timestamp-random
			expect(id).toMatch(/^\d+-[a-z0-9]+$/)
		})

		it('should generate unique IDs', () => {
			const ids = new Set<string>()
			for (let i = 0; i < 100; i++) {
				ids.add(generateSimpleId())
			}
			expect(ids.size).toBe(100)
		})

		it('should start with current timestamp', () => {
			const before = Date.now()
			const id = generateSimpleId()
			const after = Date.now()

			const timestamp = parseInt(id.split('-')[0], 10)
			expect(timestamp).toBeGreaterThanOrEqual(before)
			expect(timestamp).toBeLessThanOrEqual(after)
		})
	})
})
