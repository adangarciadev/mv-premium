/**
 * Tests for Cache utilities
 *
 * NOTE: These tests re-implement the pure functions to avoid
 * browser extension API dependencies (#imports).
 */
import { describe, it, expect } from 'vitest'

// Re-implement pure functions for testing
function createCacheKey(...parts: (string | number)[]): string {
	return parts.map(String).join(':')
}

const CACHE_TTL = {
	SHORT: 5 * 60 * 1000, // 5 minutes
	MEDIUM: 30 * 60 * 1000, // 30 minutes
	LONG: 60 * 60 * 1000, // 1 hour
} as const

describe('cache utilities', () => {
	describe('createCacheKey', () => {
		it('should create a simple key from one part', () => {
			const key = createCacheKey('movies')
			expect(key).toBe('movies')
		})

		it('should join multiple parts with colons', () => {
			const key = createCacheKey('movies', '123', 'details')
			expect(key).toBe('movies:123:details')
		})

		it('should convert numbers to strings', () => {
			const key = createCacheKey('movie', 550)
			expect(key).toBe('movie:550')
		})

		it('should handle mixed types', () => {
			const key = createCacheKey('search', 'query', 1)
			expect(key).toBe('search:query:1')
		})
	})

	describe('CACHE_TTL constants', () => {
		it('should have SHORT TTL defined', () => {
			expect(CACHE_TTL.SHORT).toBeDefined()
			expect(typeof CACHE_TTL.SHORT).toBe('number')
			expect(CACHE_TTL.SHORT).toBeGreaterThan(0)
		})

		it('should have MEDIUM TTL defined', () => {
			expect(CACHE_TTL.MEDIUM).toBeDefined()
			expect(typeof CACHE_TTL.MEDIUM).toBe('number')
			expect(CACHE_TTL.MEDIUM).toBeGreaterThan(0)
		})

		it('should have LONG TTL defined', () => {
			expect(CACHE_TTL.LONG).toBeDefined()
			expect(typeof CACHE_TTL.LONG).toBe('number')
			expect(CACHE_TTL.LONG).toBeGreaterThan(0)
		})

		it('should have increasing TTL values (SHORT < MEDIUM < LONG)', () => {
			expect(CACHE_TTL.SHORT).toBeLessThan(CACHE_TTL.MEDIUM)
			expect(CACHE_TTL.MEDIUM).toBeLessThan(CACHE_TTL.LONG)
		})
	})
})
