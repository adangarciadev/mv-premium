/**
 * Tests for Thread Media Scraper utilities
 *
 * Tests the helper functions for media extraction logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Re-implement helper functions for testing
const MIN_IMAGE_SIZE = 50

const EXCLUDED_URL_PATTERNS = ['/smileys/', '/smilies/', '/emoticons/', '/f/', '/style/img/', 'pix.gif']

function isExcludedUrl(url: string): boolean {
	if (!url) return true
	const lowerUrl = url.toLowerCase()
	return EXCLUDED_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern))
}

function isImageTooSmall(dimensions: { width: number; height: number }): boolean {
	if (dimensions.width > 0 && dimensions.width < MIN_IMAGE_SIZE) return true
	if (dimensions.height > 0 && dimensions.height < MIN_IMAGE_SIZE) return true
	return false
}

function extractYoutubeVideoId(url: string): string | null {
	// youtube.com/watch?v=
	const watchMatch = url.match(/youtube\.com\/watch\?v=([\w-]+)/)
	if (watchMatch) return watchMatch[1]

	// youtu.be/
	const shortMatch = url.match(/youtu\.be\/([\w-]+)/)
	if (shortMatch) return shortMatch[1]

	// youtube.com/embed/
	const embedMatch = url.match(/youtube\.com\/embed\/([\w-]+)/)
	if (embedMatch) return embedMatch[1]

	// ytimg.com/vi/
	const imgMatch = url.match(/ytimg\.com\/vi\/([\w-]+)/)
	if (imgMatch) return imgMatch[1]

	return null
}

describe('thread-scraper utilities', () => {
	describe('isExcludedUrl', () => {
		it('should exclude smiley URLs', () => {
			expect(isExcludedUrl('https://mediavida.com/smileys/happy.gif')).toBe(true)
			expect(isExcludedUrl('https://site.com/smilies/sad.png')).toBe(true)
			expect(isExcludedUrl('https://cdn.com/emoticons/laugh.gif')).toBe(true)
		})

		it('should exclude forum icon URLs', () => {
			expect(isExcludedUrl('https://mediavida.com/f/icon.png')).toBe(true)
		})

		it('should exclude site UI images', () => {
			expect(isExcludedUrl('https://mediavida.com/style/img/logo.png')).toBe(true)
		})

		it('should exclude placeholder pixels', () => {
			expect(isExcludedUrl('https://site.com/pix.gif')).toBe(true)
		})

		it('should allow normal image URLs', () => {
			expect(isExcludedUrl('https://i.imgur.com/abc123.jpg')).toBe(false)
			expect(isExcludedUrl('https://media.mediavida.com/imagenes/foto.png')).toBe(false)
		})

		it('should return true for empty URL', () => {
			expect(isExcludedUrl('')).toBe(true)
		})

		it('should be case-insensitive', () => {
			expect(isExcludedUrl('https://site.com/SMILEYS/happy.gif')).toBe(true)
		})
	})

	describe('isImageTooSmall', () => {
		it('should return true for images smaller than minimum size', () => {
			expect(isImageTooSmall({ width: 40, height: 100 })).toBe(true)
			expect(isImageTooSmall({ width: 100, height: 40 })).toBe(true)
		})

		it('should return false for images at or above minimum size', () => {
			expect(isImageTooSmall({ width: 50, height: 50 })).toBe(false)
			expect(isImageTooSmall({ width: 100, height: 100 })).toBe(false)
			expect(isImageTooSmall({ width: 1920, height: 1080 })).toBe(false)
		})

		it('should handle zero dimensions', () => {
			expect(isImageTooSmall({ width: 0, height: 0 })).toBe(false)
		})
	})

	describe('extractYoutubeVideoId', () => {
		it('should extract ID from youtube.com/watch URLs', () => {
			expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
			expect(extractYoutubeVideoId('https://youtube.com/watch?v=abc123')).toBe('abc123')
		})

		it('should extract ID from youtu.be URLs', () => {
			expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
		})

		it('should extract ID from embed URLs', () => {
			expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
		})

		it('should extract ID from thumbnail URLs', () => {
			expect(extractYoutubeVideoId('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe('dQw4w9WgXcQ')
		})

		it('should return null for non-YouTube URLs', () => {
			expect(extractYoutubeVideoId('https://vimeo.com/123456')).toBeNull()
			expect(extractYoutubeVideoId('https://google.com')).toBeNull()
		})

		it('should return null for empty URL', () => {
			expect(extractYoutubeVideoId('')).toBeNull()
		})

		it('should handle URLs with additional parameters', () => {
			expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=abc123&t=120')).toBe('abc123')
		})
	})
})
