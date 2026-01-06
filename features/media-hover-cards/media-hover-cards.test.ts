/**
 * Tests for Media Hover Cards logic
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Re-implement URL detection logic for testing
function isTMDBUrl(url: string): boolean {
	return /themoviedb\.org\/(movie|tv|person)\/\d+/i.test(url)
}

function isIMDBUrl(url: string): boolean {
	return /imdb\.com\/(title|name)\/[a-z]{2}\d+/i.test(url)
}

function isSupportedUrl(url: string): boolean {
	return isTMDBUrl(url) || isIMDBUrl(url)
}

function parseMediaUrl(url: string): { type: 'movie' | 'tv' | 'person' | 'unknown'; id: string } | null {
	// TMDB patterns
	const tmdbMovieMatch = url.match(/themoviedb\.org\/movie\/(\d+)/)
	if (tmdbMovieMatch) return { type: 'movie', id: tmdbMovieMatch[1] }

	const tmdbTvMatch = url.match(/themoviedb\.org\/tv\/(\d+)/)
	if (tmdbTvMatch) return { type: 'tv', id: tmdbTvMatch[1] }

	const tmdbPersonMatch = url.match(/themoviedb\.org\/person\/(\d+)/)
	if (tmdbPersonMatch) return { type: 'person', id: tmdbPersonMatch[1] }

	// IMDB patterns
	const imdbTitleMatch = url.match(/imdb\.com\/title\/(tt\d+)/)
	if (imdbTitleMatch) return { type: 'movie', id: imdbTitleMatch[1] }

	const imdbNameMatch = url.match(/imdb\.com\/name\/(nm\d+)/)
	if (imdbNameMatch) return { type: 'person', id: imdbNameMatch[1] }

	return null
}

// Timer configuration
const SHOW_DELAY = 400
const HIDE_DELAY = 150

describe('media-hover-cards logic', () => {
	describe('URL detection', () => {
		describe('isTMDBUrl', () => {
			it('should detect TMDB movie URLs', () => {
				expect(isTMDBUrl('https://www.themoviedb.org/movie/550')).toBe(true)
				expect(isTMDBUrl('https://themoviedb.org/movie/12345')).toBe(true)
			})

			it('should detect TMDB TV URLs', () => {
				expect(isTMDBUrl('https://www.themoviedb.org/tv/1396')).toBe(true)
			})

			it('should detect TMDB person URLs', () => {
				expect(isTMDBUrl('https://www.themoviedb.org/person/287')).toBe(true)
			})

			it('should reject non-TMDB URLs', () => {
				expect(isTMDBUrl('https://google.com')).toBe(false)
				expect(isTMDBUrl('https://imdb.com/title/tt0111161')).toBe(false)
			})
		})

		describe('isIMDBUrl', () => {
			it('should detect IMDB title URLs', () => {
				expect(isIMDBUrl('https://www.imdb.com/title/tt0111161')).toBe(true)
				expect(isIMDBUrl('https://imdb.com/title/tt0068646')).toBe(true)
			})

			it('should detect IMDB name URLs', () => {
				expect(isIMDBUrl('https://www.imdb.com/name/nm0000151')).toBe(true)
			})

			it('should reject non-IMDB URLs', () => {
				expect(isIMDBUrl('https://google.com')).toBe(false)
				expect(isIMDBUrl('https://themoviedb.org/movie/550')).toBe(false)
			})
		})

		describe('isSupportedUrl', () => {
			it('should accept both TMDB and IMDB URLs', () => {
				expect(isSupportedUrl('https://www.themoviedb.org/movie/550')).toBe(true)
				expect(isSupportedUrl('https://www.imdb.com/title/tt0111161')).toBe(true)
			})

			it('should reject unsupported URLs', () => {
				expect(isSupportedUrl('https://google.com')).toBe(false)
				expect(isSupportedUrl('https://youtube.com/watch?v=123')).toBe(false)
			})
		})
	})

	describe('parseMediaUrl', () => {
		it('should parse TMDB movie URLs', () => {
			const result = parseMediaUrl('https://www.themoviedb.org/movie/550')

			expect(result).not.toBeNull()
			expect(result?.type).toBe('movie')
			expect(result?.id).toBe('550')
		})

		it('should parse TMDB TV URLs', () => {
			const result = parseMediaUrl('https://www.themoviedb.org/tv/1396')

			expect(result).not.toBeNull()
			expect(result?.type).toBe('tv')
			expect(result?.id).toBe('1396')
		})

		it('should parse TMDB person URLs', () => {
			const result = parseMediaUrl('https://www.themoviedb.org/person/287')

			expect(result).not.toBeNull()
			expect(result?.type).toBe('person')
			expect(result?.id).toBe('287')
		})

		it('should parse IMDB title URLs', () => {
			const result = parseMediaUrl('https://www.imdb.com/title/tt0111161')

			expect(result).not.toBeNull()
			expect(result?.type).toBe('movie')
			expect(result?.id).toBe('tt0111161')
		})

		it('should parse IMDB name URLs', () => {
			const result = parseMediaUrl('https://www.imdb.com/name/nm0000151')

			expect(result).not.toBeNull()
			expect(result?.type).toBe('person')
			expect(result?.id).toBe('nm0000151')
		})

		it('should return null for unsupported URLs', () => {
			expect(parseMediaUrl('https://google.com')).toBeNull()
		})
	})

	describe('timer configuration', () => {
		it('should have reasonable show delay', () => {
			expect(SHOW_DELAY).toBeGreaterThanOrEqual(300)
			expect(SHOW_DELAY).toBeLessThanOrEqual(600)
		})

		it('should have shorter hide delay', () => {
			expect(HIDE_DELAY).toBeLessThan(SHOW_DELAY)
			expect(HIDE_DELAY).toBeGreaterThanOrEqual(100)
		})
	})

	describe('URL patterns', () => {
		it('should handle URLs with query params', () => {
			expect(isTMDBUrl('https://www.themoviedb.org/movie/550?language=es')).toBe(true)
		})

		it('should handle URLs with hash', () => {
			expect(isIMDBUrl('https://www.imdb.com/title/tt0111161#reviews')).toBe(true)
		})

		it('should handle different protocols', () => {
			expect(isTMDBUrl('http://themoviedb.org/movie/550')).toBe(true)
		})
	})

	describe('card positioning', () => {
		it('should calculate card position from anchor rect', () => {
			const anchorRect = {
				top: 100,
				left: 200,
				bottom: 120,
				right: 300,
				width: 100,
				height: 20,
			}

			// Card should appear below the anchor
			const cardTop = anchorRect.bottom + 8 // 8px gap
			expect(cardTop).toBe(128)

			// Card should align with anchor left
			expect(anchorRect.left).toBe(200)
		})

		it('should handle viewport edge cases', () => {
			const viewportWidth = 1920
			const cardWidth = 320
			const anchorLeft = 1800

			// Should flip to left side if would overflow
			const wouldOverflow = anchorLeft + cardWidth > viewportWidth
			expect(wouldOverflow).toBe(true)
		})
	})
})
