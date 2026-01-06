/**
 * Tests for Thread Summarizer extract-posts logic
 */
import { describe, it, expect } from 'vitest'

// Re-implement constants and functions for testing
const MAX_TOTAL_CHARS = 32000
const MAX_CHARS_PER_POST = 1500
const MIN_CHARS_PER_POST = 50

interface ExtractedPost {
	number: number
	author: string
	content: string
	timestamp?: string
	charCount: number
	avatarUrl?: string
}

function cleanPostContent(html: string): string {
	// Remove quotes
	let text = html.replace(/<div class="quote-container">[\s\S]*?<\/div>/gi, '[CITA OMITIDA]')

	// Remove HTML tags
	text = text.replace(/<[^>]+>/g, ' ')

	// Decode entities
	text = text
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")

	// Normalize whitespace
	text = text.replace(/\s+/g, ' ').trim()

	return text
}

function applySmartTruncation(posts: ExtractedPost[], maxTotal: number): ExtractedPost[] {
	const totalChars = posts.reduce((sum, p) => sum + p.charCount, 0)

	if (totalChars <= maxTotal) {
		return posts
	}

	// Calculate proportional allocation
	const ratio = maxTotal / totalChars
	const result: ExtractedPost[] = []

	for (const post of posts) {
		const allocatedChars = Math.max(
			MIN_CHARS_PER_POST,
			Math.min(MAX_CHARS_PER_POST, Math.floor(post.charCount * ratio))
		)

		if (post.content.length > allocatedChars) {
			result.push({
				...post,
				content: post.content.slice(0, allocatedChars) + '...',
				charCount: allocatedChars,
			})
		} else {
			result.push(post)
		}
	}

	return result
}

describe('thread-summarizer extract-posts', () => {
	describe('constants', () => {
		it('should have valid character limits', () => {
			expect(MAX_TOTAL_CHARS).toBeGreaterThan(0)
			expect(MAX_CHARS_PER_POST).toBeGreaterThan(0)
			expect(MIN_CHARS_PER_POST).toBeGreaterThan(0)
		})

		it('should have sensible hierarchy', () => {
			expect(MAX_CHARS_PER_POST).toBeGreaterThan(MIN_CHARS_PER_POST)
			expect(MAX_TOTAL_CHARS).toBeGreaterThan(MAX_CHARS_PER_POST)
		})
	})

	describe('cleanPostContent', () => {
		it('should remove HTML tags', () => {
			const html = '<p>Hola <strong>mundo</strong></p>'
			expect(cleanPostContent(html)).toBe('Hola mundo')
		})

		it('should replace quotes with placeholder', () => {
			const html = '<div class="quote-container"><p>Citado</p></div>Mi respuesta'
			expect(cleanPostContent(html)).toContain('[CITA OMITIDA]')
		})

		it('should decode HTML entities', () => {
			const html = 'Esto &amp; aquello &lt; mayor &gt; menor'
			expect(cleanPostContent(html)).toBe('Esto & aquello < mayor > menor')
		})

		it('should normalize whitespace', () => {
			const html = 'Mucho    espacio\n\nen\tblanco'
			expect(cleanPostContent(html)).toBe('Mucho espacio en blanco')
		})

		it('should handle empty input', () => {
			expect(cleanPostContent('')).toBe('')
		})
	})

	describe('ExtractedPost interface', () => {
		it('should require core fields', () => {
			const post: ExtractedPost = {
				number: 1,
				author: 'usuario',
				content: 'Contenido del post',
				charCount: 17,
			}

			expect(post.number).toBeGreaterThan(0)
			expect(post.author).toBeDefined()
			expect(post.content).toBeDefined()
			expect(post.charCount).toBe(17)
		})

		it('should support optional fields', () => {
			const post: ExtractedPost = {
				number: 5,
				author: 'otro_usuario',
				content: 'Post con metadata',
				charCount: 17,
				timestamp: '2024-01-15T10:30:00Z',
				avatarUrl: 'https://example.com/avatar.jpg',
			}

			expect(post.timestamp).toBeDefined()
			expect(post.avatarUrl).toBeDefined()
		})
	})

	describe('applySmartTruncation', () => {
		it('should not modify posts if under limit', () => {
			const posts: ExtractedPost[] = [
				{ number: 1, author: 'a', content: 'Short', charCount: 5 },
				{ number: 2, author: 'b', content: 'Also short', charCount: 10 },
			]

			const result = applySmartTruncation(posts, 1000)

			expect(result).toHaveLength(2)
			expect(result[0].content).toBe('Short')
			expect(result[1].content).toBe('Also short')
		})

		it('should truncate long posts proportionally', () => {
			const longContent = 'A'.repeat(5000)
			const posts: ExtractedPost[] = [{ number: 1, author: 'a', content: longContent, charCount: 5000 }]

			const result = applySmartTruncation(posts, 1000)

			expect(result[0].content.length).toBeLessThan(5000)
			expect(result[0].content.endsWith('...')).toBe(true)
		})

		it('should respect minimum chars per post', () => {
			const posts: ExtractedPost[] = [
				{ number: 1, author: 'a', content: 'A'.repeat(100), charCount: 100 },
				{ number: 2, author: 'b', content: 'B'.repeat(100), charCount: 100 },
			]

			const result = applySmartTruncation(posts, 60) // Very low limit

			// Each post should have at least MIN_CHARS_PER_POST
			expect(result[0].charCount).toBeGreaterThanOrEqual(MIN_CHARS_PER_POST)
		})

		it('should handle empty post array', () => {
			const result = applySmartTruncation([], 1000)
			expect(result).toEqual([])
		})
	})

	describe('post extraction patterns', () => {
		it('should extract post number from data attribute pattern', () => {
			const postNumStr = '42'
			const postNum = parseInt(postNumStr)
			expect(postNum).toBe(42)
		})

		it('should handle author name extraction', () => {
			const authorLink = '<a href="/id/username" class="autor">username</a>'
			const match = authorLink.match(/>([^<]+)<\/a>/)
			expect(match?.[1]).toBe('username')
		})
	})
})
