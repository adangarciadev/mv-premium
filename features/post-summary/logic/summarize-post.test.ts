/**
 * Tests for Post Summary logic
 */
import { describe, it, expect } from 'vitest'

// Re-define types and functions for testing
interface PostSummary {
	author: string
	postNumber: number
	content: string
	timestamp?: string
	links: string[]
	images: string[]
	quotes: number
}

const MAX_SUMMARY_LENGTH = 200

function extractLinks(content: string): string[] {
	const urlPattern = /https?:\/\/[^\s<>"]+/g
	return content.match(urlPattern) || []
}

function extractImages(content: string): string[] {
	const imgPattern = /<img[^>]+src="([^"]+)"/gi
	const matches: string[] = []
	let match

	while ((match = imgPattern.exec(content)) !== null) {
		matches.push(match[1])
	}

	return matches
}

function countQuotes(content: string): number {
	const quotePattern = /\[QUOTE[^\]]*\]/gi
	const matches = content.match(quotePattern)
	return matches ? matches.length : 0
}

function truncateSummary(content: string, maxLength: number): string {
	if (content.length <= maxLength) return content

	// Find word boundary
	const truncated = content.slice(0, maxLength)
	const lastSpace = truncated.lastIndexOf(' ')

	if (lastSpace > maxLength * 0.8) {
		return truncated.slice(0, lastSpace) + '...'
	}

	return truncated + '...'
}

function cleanForSummary(html: string): string {
	return html
		.replace(/<[^>]+>/g, '') // Remove HTML tags
		.replace(/\[QUOTE[^\]]*\][\s\S]*?\[\/QUOTE\]/gi, '') // Remove quotes
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

describe('post-summary', () => {
	describe('PostSummary interface', () => {
		it('should contain post metadata', () => {
			const summary: PostSummary = {
				author: 'usuario',
				postNumber: 42,
				content: 'Resumen del contenido...',
				links: [],
				images: [],
				quotes: 0,
			}

			expect(summary.author).toBe('usuario')
			expect(summary.postNumber).toBe(42)
		})

		it('should track extracted media', () => {
			const summary: PostSummary = {
				author: 'user',
				postNumber: 1,
				content: 'Post con media',
				links: ['https://example.com', 'https://mediavida.com'],
				images: ['https://i.imgur.com/abc.jpg'],
				quotes: 2,
			}

			expect(summary.links).toHaveLength(2)
			expect(summary.images).toHaveLength(1)
			expect(summary.quotes).toBe(2)
		})
	})

	describe('extractLinks', () => {
		it('should extract URLs from content', () => {
			const content = 'Mira este enlace https://example.com y este otro http://test.org'
			const links = extractLinks(content)

			expect(links).toHaveLength(2)
			expect(links).toContain('https://example.com')
			expect(links).toContain('http://test.org')
		})

		it('should return empty array when no links', () => {
			const content = 'Sin enlaces'
			expect(extractLinks(content)).toEqual([])
		})

		it('should handle complex URLs', () => {
			const content = 'Link: https://example.com/path?param=value&other=123'
			const links = extractLinks(content)

			expect(links[0]).toContain('param=value')
		})
	})

	describe('extractImages', () => {
		it('should extract image sources', () => {
			const content = '<img src="https://i.imgur.com/abc.jpg" alt="test">'
			const images = extractImages(content)

			expect(images).toHaveLength(1)
			expect(images[0]).toBe('https://i.imgur.com/abc.jpg')
		})

		it('should extract multiple images', () => {
			const content = `
				<img src="img1.jpg">
				<img src="img2.png">
			`
			const images = extractImages(content)

			expect(images).toHaveLength(2)
		})

		it('should return empty array when no images', () => {
			const content = '<p>No images here</p>'
			expect(extractImages(content)).toEqual([])
		})
	})

	describe('countQuotes', () => {
		it('should count BBCode quotes', () => {
			const content = '[QUOTE]First[/QUOTE] text [QUOTE=user]Second[/QUOTE]'
			expect(countQuotes(content)).toBe(2)
		})

		it('should return 0 when no quotes', () => {
			const content = 'No quotes here'
			expect(countQuotes(content)).toBe(0)
		})

		it('should handle nested quotes', () => {
			const content = '[QUOTE]Outer [QUOTE]Inner[/QUOTE][/QUOTE]'
			expect(countQuotes(content)).toBe(2)
		})
	})

	describe('truncateSummary', () => {
		it('should not truncate short content', () => {
			const content = 'Short text'
			expect(truncateSummary(content, 100)).toBe('Short text')
		})

		it('should truncate at word boundary', () => {
			const content = 'This is a longer text that needs to be truncated'
			const result = truncateSummary(content, 20)

			expect(result.endsWith('...')).toBe(true)
			expect(result.length).toBeLessThanOrEqual(23) // 20 + '...'
		})

		it('should add ellipsis when truncating', () => {
			const content = 'A'.repeat(300)
			const result = truncateSummary(content, MAX_SUMMARY_LENGTH)

			expect(result.endsWith('...')).toBe(true)
		})
	})

	describe('cleanForSummary', () => {
		it('should remove HTML tags', () => {
			const html = '<p>Hello <strong>world</strong></p>'
			expect(cleanForSummary(html)).toBe('Hello world')
		})

		it('should remove BBCode quotes', () => {
			const content = '[QUOTE=user]Quoted text[/QUOTE]My response'
			expect(cleanForSummary(content)).toBe('My response')
		})

		it('should normalize whitespace', () => {
			const content = 'Too   much    space'
			expect(cleanForSummary(content)).toBe('Too much space')
		})

		it('should handle empty input', () => {
			expect(cleanForSummary('')).toBe('')
		})
	})
})
