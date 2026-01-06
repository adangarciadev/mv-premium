/**
 * Tests for Pinned Posts storage types and structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface PinnedPost {
	id: string
	postNumber: number
	author: string
	content: string
	threadId: string
	pinnedAt: number
	originalUrl: string
}

const STORAGE_KEY_PREFIX = 'pinnedPosts_'

describe('pinned-posts storage', () => {
	describe('PinnedPost interface', () => {
		it('should require all core fields', () => {
			const post: PinnedPost = {
				id: 'post_123',
				postNumber: 42,
				author: 'usuario123',
				content: 'Contenido del post',
				threadId: '789456',
				pinnedAt: Date.now(),
				originalUrl: '/foro/off-topic/hilo-789456#42',
			}

			expect(post.id).toBeDefined()
			expect(post.postNumber).toBeGreaterThan(0)
			expect(post.author).toBeDefined()
			expect(post.content).toBeDefined()
			expect(post.threadId).toBeDefined()
			expect(post.pinnedAt).toBeGreaterThan(0)
			expect(post.originalUrl).toContain('#')
		})
	})

	describe('storage key generation', () => {
		it('should generate unique key per thread', () => {
			const threadId1 = '123'
			const threadId2 = '456'

			const key1 = `${STORAGE_KEY_PREFIX}${threadId1}`
			const key2 = `${STORAGE_KEY_PREFIX}${threadId2}`

			expect(key1).toBe('pinnedPosts_123')
			expect(key2).toBe('pinnedPosts_456')
			expect(key1).not.toBe(key2)
		})
	})

	describe('post operations', () => {
		it('should detect duplicates by postNumber within thread', () => {
			const posts: PinnedPost[] = [
				{
					id: 'a',
					postNumber: 10,
					author: 'u1',
					content: 'c1',
					threadId: '100',
					pinnedAt: 1,
					originalUrl: '/a',
				},
				{
					id: 'b',
					postNumber: 20,
					author: 'u2',
					content: 'c2',
					threadId: '100',
					pinnedAt: 2,
					originalUrl: '/b',
				},
			]

			const isDuplicate = (postNumber: number) => posts.some(p => p.postNumber === postNumber)

			expect(isDuplicate(10)).toBe(true)
			expect(isDuplicate(99)).toBe(false)
		})

		it('should sort by pinnedAt (oldest first for order)', () => {
			const posts: PinnedPost[] = [
				{
					id: 'a',
					postNumber: 5,
					author: 'u',
					content: 'c',
					threadId: 't',
					pinnedAt: 3000,
					originalUrl: '/a',
				},
				{
					id: 'b',
					postNumber: 10,
					author: 'u',
					content: 'c',
					threadId: 't',
					pinnedAt: 1000,
					originalUrl: '/b',
				},
				{
					id: 'c',
					postNumber: 15,
					author: 'u',
					content: 'c',
					threadId: 't',
					pinnedAt: 2000,
					originalUrl: '/c',
				},
			]

			const sorted = [...posts].sort((a, b) => a.pinnedAt - b.pinnedAt)

			expect(sorted[0].postNumber).toBe(10)
			expect(sorted[1].postNumber).toBe(15)
			expect(sorted[2].postNumber).toBe(5)
		})

		it('should remove by id', () => {
			const posts: PinnedPost[] = [
				{
					id: 'post_1',
					postNumber: 1,
					author: 'u',
					content: 'c',
					threadId: 't',
					pinnedAt: 1,
					originalUrl: '/a',
				},
				{
					id: 'post_2',
					postNumber: 2,
					author: 'u',
					content: 'c',
					threadId: 't',
					pinnedAt: 2,
					originalUrl: '/b',
				},
			]

			const remaining = posts.filter(p => p.id !== 'post_1')

			expect(remaining).toHaveLength(1)
			expect(remaining[0].id).toBe('post_2')
		})
	})

	describe('URL parsing', () => {
		it('should build post URL with anchor', () => {
			const threadUrl = '/foro/off-topic/titulo-del-hilo-123456'
			const postNumber = 42

			const postUrl = `${threadUrl}#${postNumber}`

			expect(postUrl).toContain('#42')
		})

		it('should extract post number from anchor', () => {
			const url = '/foro/off-topic/titulo-del-hilo-123456#42'
			const anchor = url.split('#')[1]
			const postNumber = parseInt(anchor)

			expect(postNumber).toBe(42)
		})
	})

	describe('content handling', () => {
		it('should handle posts with quotes', () => {
			const post: PinnedPost = {
				id: 'q1',
				postNumber: 5,
				author: 'user',
				content: '[QUOTE]Contenido citado[/QUOTE]\n\nMi respuesta',
				threadId: 't1',
				pinnedAt: Date.now(),
				originalUrl: '/a',
			}

			expect(post.content).toContain('[QUOTE]')
		})

		it('should handle posts with multimedia', () => {
			const post: PinnedPost = {
				id: 'm1',
				postNumber: 10,
				author: 'user',
				content: 'Mira este video: [YT]dQw4w9WgXcQ[/YT]',
				threadId: 't1',
				pinnedAt: Date.now(),
				originalUrl: '/a',
			}

			expect(post.content).toContain('[YT]')
		})
	})
})
