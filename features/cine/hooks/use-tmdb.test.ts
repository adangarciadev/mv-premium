/**
 * Tests for TMDB cache utilities
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Re-implement cache utilities for testing
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CacheEntry<T> {
	data: T
	timestamp: number
}

class SimpleCache {
	private cache = new Map<string, CacheEntry<unknown>>()

	get<T>(key: string): T | undefined {
		const cached = this.cache.get(key)
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as T
		}
		// Expired or not found
		if (cached) {
			this.cache.delete(key)
		}
		return undefined
	}

	set<T>(key: string, data: T): void {
		this.cache.set(key, { data, timestamp: Date.now() })
	}

	has(key: string): boolean {
		return this.get(key) !== undefined
	}

	clear(): void {
		this.cache.clear()
	}

	size(): number {
		return this.cache.size
	}
}

// Search result types
interface TMDBMovie {
	id: number
	title: string
	release_date: string
	poster_path: string | null
}

interface TMDBSearchResult {
	results: TMDBMovie[]
	total_results: number
	page: number
}

function buildSearchKey(type: 'movie' | 'tv', query: string, page: number): string {
	return `search:${type}:${query.toLowerCase().trim()}:${page}`
}

function buildDetailKey(type: 'movie' | 'tv', id: number): string {
	return `detail:${type}:${id}`
}

describe('cine TMDB cache', () => {
	let cache: SimpleCache

	beforeEach(() => {
		cache = new SimpleCache()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('CACHE_TTL', () => {
		it('should be 30 minutes in milliseconds', () => {
			expect(CACHE_TTL).toBe(30 * 60 * 1000)
		})
	})

	describe('SimpleCache', () => {
		it('should store and retrieve values', () => {
			cache.set('key1', { data: 'test' })
			expect(cache.get('key1')).toEqual({ data: 'test' })
		})

		it('should return undefined for missing keys', () => {
			expect(cache.get('nonexistent')).toBeUndefined()
		})

		it('should expire entries after TTL', () => {
			cache.set('key1', 'value1')

			// Advance time past TTL
			vi.advanceTimersByTime(CACHE_TTL + 1000)

			expect(cache.get('key1')).toBeUndefined()
		})

		it('should not expire entries before TTL', () => {
			cache.set('key1', 'value1')

			// Advance time but stay within TTL
			vi.advanceTimersByTime(CACHE_TTL - 1000)

			expect(cache.get('key1')).toBe('value1')
		})

		it('should clear all entries', () => {
			cache.set('key1', 'value1')
			cache.set('key2', 'value2')

			cache.clear()

			expect(cache.size()).toBe(0)
		})

		it('should check if key exists and is valid', () => {
			cache.set('key1', 'value1')

			expect(cache.has('key1')).toBe(true)
			expect(cache.has('nonexistent')).toBe(false)
		})

		it('should handle complex objects', () => {
			const movie: TMDBMovie = {
				id: 123,
				title: 'Test Movie',
				release_date: '2024-01-15',
				poster_path: '/path/to/poster.jpg',
			}

			cache.set('movie:123', movie)
			const retrieved = cache.get<TMDBMovie>('movie:123')

			expect(retrieved?.title).toBe('Test Movie')
			expect(retrieved?.id).toBe(123)
		})
	})

	describe('buildSearchKey', () => {
		it('should build consistent search keys', () => {
			const key1 = buildSearchKey('movie', 'Inception', 1)
			const key2 = buildSearchKey('movie', 'inception', 1)
			const key3 = buildSearchKey('movie', '  inception  ', 1)

			expect(key1).toBe(key2)
			expect(key2).toBe(key3)
		})

		it('should differentiate between movie and tv', () => {
			const movieKey = buildSearchKey('movie', 'test', 1)
			const tvKey = buildSearchKey('tv', 'test', 1)

			expect(movieKey).not.toBe(tvKey)
			expect(movieKey).toContain('movie')
			expect(tvKey).toContain('tv')
		})

		it('should include page number', () => {
			const page1 = buildSearchKey('movie', 'test', 1)
			const page2 = buildSearchKey('movie', 'test', 2)

			expect(page1).not.toBe(page2)
		})
	})

	describe('buildDetailKey', () => {
		it('should build detail keys with type and id', () => {
			const key = buildDetailKey('movie', 123)

			expect(key).toBe('detail:movie:123')
		})

		it('should differentiate between types', () => {
			const movieKey = buildDetailKey('movie', 100)
			const tvKey = buildDetailKey('tv', 100)

			expect(movieKey).not.toBe(tvKey)
		})
	})

	describe('search result caching', () => {
		it('should cache search results', () => {
			const results: TMDBSearchResult = {
				results: [
					{ id: 1, title: 'Movie 1', release_date: '2024-01-01', poster_path: null },
					{ id: 2, title: 'Movie 2', release_date: '2024-02-01', poster_path: '/poster.jpg' },
				],
				total_results: 2,
				page: 1,
			}

			const key = buildSearchKey('movie', 'test', 1)
			cache.set(key, results)

			const cached = cache.get<TMDBSearchResult>(key)
			expect(cached?.results).toHaveLength(2)
			expect(cached?.total_results).toBe(2)
		})
	})

	describe('cache key patterns', () => {
		it('should normalize search queries', () => {
			const queries = ['Test', 'TEST', ' test ', 'test']
			const keys = queries.map(q => buildSearchKey('movie', q, 1))

			// All should be the same
			expect(new Set(keys).size).toBe(1)
		})
	})
})
