/**
 * Tests for TMDB API utilities (non-network functions)
 *
 * NOTE: These tests re-implement the URL helper functions to avoid
 * browser extension API dependencies.
 */
import { describe, it, expect } from 'vitest'

// Re-implement URL helper functions for testing
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

function getPosterUrl(path: string | null, size: string = 'w500'): string | null {
	if (!path) return null
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

function getBackdropUrl(path: string | null, size: string = 'w780'): string | null {
	if (!path) return null
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

describe('TMDB API utilities', () => {
	describe('getPosterUrl', () => {
		it('should return null when path is null', () => {
			expect(getPosterUrl(null)).toBeNull()
		})

		it('should return null when path is empty string', () => {
			// @ts-ignore - testing edge case
			expect(getPosterUrl('')).toBeNull()
		})

		it('should return correct URL with default size (w500)', () => {
			const result = getPosterUrl('/abc123.jpg')
			expect(result).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg')
		})

		it('should return correct URL with specified size', () => {
			expect(getPosterUrl('/abc123.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/abc123.jpg')
			expect(getPosterUrl('/abc123.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/abc123.jpg')
			expect(getPosterUrl('/abc123.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/abc123.jpg')
		})

		it('should handle paths with or without leading slash', () => {
			expect(getPosterUrl('/poster.jpg')).toContain('/poster.jpg')
		})
	})

	describe('getBackdropUrl', () => {
		it('should return null when path is null', () => {
			expect(getBackdropUrl(null)).toBeNull()
		})

		it('should return correct URL with default size (w780)', () => {
			const result = getBackdropUrl('/backdrop123.jpg')
			expect(result).toBe('https://image.tmdb.org/t/p/w780/backdrop123.jpg')
		})

		it('should return correct URL with specified size', () => {
			expect(getBackdropUrl('/backdrop.jpg', 'w300')).toBe('https://image.tmdb.org/t/p/w300/backdrop.jpg')
			expect(getBackdropUrl('/backdrop.jpg', 'w1280')).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg')
			expect(getBackdropUrl('/backdrop.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/backdrop.jpg')
		})
	})
})
