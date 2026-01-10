/**
 * Tests for Image URL Detector
 *
 * Tests image URL detection via extensions, domains, and query params.
 */
import { describe, it, expect } from 'vitest'
import { isValidUrl, isImageUrl } from './image-detector'

describe('image-detector', () => {
	describe('isValidUrl', () => {
		it('should return true for valid http URLs', () => {
			expect(isValidUrl('http://example.com')).toBe(true)
			expect(isValidUrl('https://example.com')).toBe(true)
		})

		it('should return false for invalid URLs', () => {
			expect(isValidUrl('not-a-url')).toBe(false)
			expect(isValidUrl('ftp://example.com')).toBe(false)
			expect(isValidUrl('')).toBe(false)
		})

		it('should handle URLs with spaces', () => {
			expect(isValidUrl('  https://example.com  ')).toBe(true)
		})
	})

	describe('isImageUrl', () => {
		describe('extension detection', () => {
			it('should detect .jpg images', () => {
				expect(isImageUrl('https://example.com/image.jpg')).toBe(true)
				expect(isImageUrl('https://example.com/image.JPG')).toBe(true)
			})

			it('should detect .jpeg images', () => {
				expect(isImageUrl('https://example.com/image.jpeg')).toBe(true)
			})

			it('should detect .png images', () => {
				expect(isImageUrl('https://example.com/image.png')).toBe(true)
			})

			it('should detect .gif images', () => {
				expect(isImageUrl('https://example.com/image.gif')).toBe(true)
			})

			it('should NOT detect unsupported extensions', () => {
				expect(isImageUrl('https://example.com/image.webp')).toBe(false)
				expect(isImageUrl('https://example.com/image.svg')).toBe(false)
				expect(isImageUrl('https://example.com/image.bmp')).toBe(false)
			})

			it('should handle URLs with query strings', () => {
				expect(isImageUrl('https://example.com/image.jpg?size=large')).toBe(true)
			})
		})

		describe('domain detection', () => {
			it('should detect Imgur URLs', () => {
				expect(isImageUrl('https://i.imgur.com/abc123')).toBe(true)
			})

			it('should detect Reddit image URLs', () => {
				expect(isImageUrl('https://i.redd.it/abc123')).toBe(true)
				expect(isImageUrl('https://preview.redd.it/abc123')).toBe(true)
			})

			it('should detect Twitter/X image URLs', () => {
				expect(isImageUrl('https://pbs.twimg.com/media/abc123')).toBe(true)
			})

			it('should detect ImgBB URLs', () => {
				expect(isImageUrl('https://i.ibb.co/abc123/image')).toBe(true)
			})

			it('should detect Unsplash URLs', () => {
				expect(isImageUrl('https://images.unsplash.com/photo-123')).toBe(true)
			})

			it('should detect Discord CDN URLs', () => {
				expect(isImageUrl('https://cdn.discordapp.com/attachments/123/456/image')).toBe(true)
			})

			it('should detect TMDB URLs', () => {
				expect(isImageUrl('https://image.tmdb.org/t/p/w500/abc123')).toBe(true)
			})

			it('should detect Giphy URLs', () => {
				expect(isImageUrl('https://media.giphy.com/media/abc123/giphy.gif')).toBe(true)
				expect(isImageUrl('https://media1.giphy.com/media/abc123/giphy.gif')).toBe(true)
			})
		})

		describe('query param detection', () => {
			it('should detect fm=jpg param', () => {
				expect(isImageUrl('https://example.com/image?fm=jpg')).toBe(true)
			})

			it('should detect format=png param', () => {
				expect(isImageUrl('https://example.com/image?format=png')).toBe(true)
			})
		})

		describe('edge cases', () => {
			it('should return false for non-image URLs', () => {
				expect(isImageUrl('https://example.com/page.html')).toBe(false)
				expect(isImageUrl('https://youtube.com/watch?v=abc')).toBe(false)
			})

			it('should return false for invalid URLs', () => {
				expect(isImageUrl('not-a-url')).toBe(false)
				expect(isImageUrl('')).toBe(false)
			})
		})
	})
})
