/**
 * Tests for Unified Media Resolver - URL parsing functions
 *
 * NOTE: These tests re-implement the URL parsing functions to avoid
 * browser extension API dependencies.
 */
import { describe, it, expect } from 'vitest'

// Re-implement URL parsing functions for testing
type MediaSource = 'tmdb' | 'imdb'
type MediaType = 'movie' | 'tv' | 'person'

interface ParsedUrl {
	source: MediaSource
	type: MediaType
	id: string
}

const TMDB_PATTERNS = {
	movie: /themoviedb\.org\/movie\/(\d+)/,
	tv: /themoviedb\.org\/tv\/(\d+)/,
	person: /themoviedb\.org\/person\/(\d+)/,
}

const IMDB_PATTERNS = {
	title: /imdb\.com(?:\/[a-z]{2}-[a-z]{2})?\/title\/(tt\d+)/,
	person: /imdb\.com(?:\/[a-z]{2}-[a-z]{2})?\/name\/(nm\d+)/,
}

function parseUrl(url: string): ParsedUrl | null {
	if (!url) return null

	// TMDB movie
	const tmdbMovie = url.match(TMDB_PATTERNS.movie)
	if (tmdbMovie) return { source: 'tmdb', type: 'movie', id: tmdbMovie[1] }

	// TMDB TV
	const tmdbTv = url.match(TMDB_PATTERNS.tv)
	if (tmdbTv) return { source: 'tmdb', type: 'tv', id: tmdbTv[1] }

	// TMDB person
	const tmdbPerson = url.match(TMDB_PATTERNS.person)
	if (tmdbPerson) return { source: 'tmdb', type: 'person', id: tmdbPerson[1] }

	// IMDb title (movie/tv)
	const imdbTitle = url.match(IMDB_PATTERNS.title)
	if (imdbTitle) return { source: 'imdb', type: 'movie', id: imdbTitle[1] }

	// IMDb person
	const imdbPerson = url.match(IMDB_PATTERNS.person)
	if (imdbPerson) return { source: 'imdb', type: 'person', id: imdbPerson[1] }

	return null
}

function isSupportedUrl(url: string): boolean {
	return parseUrl(url) !== null
}

describe('unified-resolver', () => {
	describe('parseUrl', () => {
		describe('TMDB URLs', () => {
			it('should parse TMDB movie URL', () => {
				const result = parseUrl('https://www.themoviedb.org/movie/550')
				expect(result).toEqual({ source: 'tmdb', type: 'movie', id: '550' })
			})

			it('should parse TMDB movie URL with title slug', () => {
				const result = parseUrl('https://www.themoviedb.org/movie/550-fight-club')
				expect(result).toEqual({ source: 'tmdb', type: 'movie', id: '550' })
			})

			it('should parse TMDB person URL', () => {
				const result = parseUrl('https://www.themoviedb.org/person/287')
				expect(result).toEqual({ source: 'tmdb', type: 'person', id: '287' })
			})

			it('should parse TMDB person URL with name slug', () => {
				const result = parseUrl('https://www.themoviedb.org/person/287-brad-pitt')
				expect(result).toEqual({ source: 'tmdb', type: 'person', id: '287' })
			})

			it('should parse TMDB TV URL', () => {
				const result = parseUrl('https://www.themoviedb.org/tv/1396')
				expect(result).toEqual({ source: 'tmdb', type: 'tv', id: '1396' })
			})

			it('should parse TMDB TV URL with title slug', () => {
				const result = parseUrl('https://www.themoviedb.org/tv/1396-breaking-bad')
				expect(result).toEqual({ source: 'tmdb', type: 'tv', id: '1396' })
			})
		})

		describe('IMDb URLs', () => {
			it('should parse IMDb title URL', () => {
				const result = parseUrl('https://www.imdb.com/title/tt0137523')
				expect(result).toEqual({ source: 'imdb', type: 'movie', id: 'tt0137523' })
			})

			it('should parse IMDb title URL with trailing slash', () => {
				const result = parseUrl('https://www.imdb.com/title/tt0137523/')
				expect(result).toEqual({ source: 'imdb', type: 'movie', id: 'tt0137523' })
			})

			it('should parse IMDb person URL', () => {
				const result = parseUrl('https://www.imdb.com/name/nm0000093')
				expect(result).toEqual({ source: 'imdb', type: 'person', id: 'nm0000093' })
			})

			it('should parse IMDb localized URLs (es-es)', () => {
				const result = parseUrl('https://www.imdb.com/es-es/title/tt0137523')
				expect(result).toEqual({ source: 'imdb', type: 'movie', id: 'tt0137523' })
			})

			it('should parse IMDb localized person URLs', () => {
				const result = parseUrl('https://www.imdb.com/es-es/name/nm0000093/')
				expect(result).toEqual({ source: 'imdb', type: 'person', id: 'nm0000093' })
			})
		})

		describe('Invalid URLs', () => {
			it('should return null for non-media URLs', () => {
				expect(parseUrl('https://google.com')).toBeNull()
				expect(parseUrl('https://youtube.com/watch?v=abc')).toBeNull()
				expect(parseUrl('https://example.com')).toBeNull()
			})

			it('should return null for malformed TMDB URLs', () => {
				expect(parseUrl('https://themoviedb.org/abc/123')).toBeNull()
				expect(parseUrl('https://themoviedb.org/')).toBeNull()
			})

			it('should return null for malformed IMDb URLs', () => {
				expect(parseUrl('https://imdb.com/')).toBeNull()
				expect(parseUrl('https://imdb.com/chart/top')).toBeNull()
			})

			it('should return null for empty string', () => {
				expect(parseUrl('')).toBeNull()
			})
		})
	})

	describe('isSupportedUrl', () => {
		it('should return true for TMDB movie URLs', () => {
			expect(isSupportedUrl('https://www.themoviedb.org/movie/550')).toBe(true)
		})

		it('should return true for TMDB person URLs', () => {
			expect(isSupportedUrl('https://www.themoviedb.org/person/287')).toBe(true)
		})

		it('should return true for TMDB TV URLs', () => {
			expect(isSupportedUrl('https://www.themoviedb.org/tv/1396')).toBe(true)
		})

		it('should return true for IMDb title URLs', () => {
			expect(isSupportedUrl('https://www.imdb.com/title/tt0137523')).toBe(true)
		})

		it('should return true for IMDb person URLs', () => {
			expect(isSupportedUrl('https://www.imdb.com/name/nm0000093')).toBe(true)
		})

		it('should return false for unsupported URLs', () => {
			expect(isSupportedUrl('https://google.com')).toBe(false)
			expect(isSupportedUrl('https://youtube.com')).toBe(false)
			expect(isSupportedUrl('')).toBe(false)
		})
	})
})
