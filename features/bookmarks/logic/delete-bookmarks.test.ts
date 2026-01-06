/**
 * Tests for Bookmarks deletion logic
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface Bookmark {
	id: string
	threadId: string
	postNumber: number
	url: string
	title: string
	author: string
	content: string
	createdAt: number
	note?: string
}

function filterBookmarks(bookmarks: Bookmark[], idsToRemove: string[]): Bookmark[] {
	const removeSet = new Set(idsToRemove)
	return bookmarks.filter(b => !removeSet.has(b.id))
}

function findBookmarksByThread(bookmarks: Bookmark[], threadId: string): Bookmark[] {
	return bookmarks.filter(b => b.threadId === threadId)
}

function sortBookmarks(bookmarks: Bookmark[], sortBy: 'date' | 'thread' | 'author'): Bookmark[] {
	const sorted = [...bookmarks]

	switch (sortBy) {
		case 'date':
			return sorted.sort((a, b) => b.createdAt - a.createdAt)
		case 'thread':
			return sorted.sort((a, b) => a.threadId.localeCompare(b.threadId))
		case 'author':
			return sorted.sort((a, b) => a.author.localeCompare(b.author))
		default:
			return sorted
	}
}

describe('bookmarks delete-bookmarks', () => {
	describe('Bookmark interface', () => {
		it('should have required fields', () => {
			const bookmark: Bookmark = {
				id: 'bm_123',
				threadId: '456789',
				postNumber: 42,
				url: '/foro/off-topic/hilo-456789#42',
				title: 'Título del hilo',
				author: 'usuario',
				content: 'Contenido del post guardado',
				createdAt: Date.now(),
			}

			expect(bookmark.id).toBeDefined()
			expect(bookmark.threadId).toBeDefined()
			expect(bookmark.postNumber).toBeGreaterThan(0)
		})

		it('should support optional note', () => {
			const bookmark: Bookmark = {
				id: 'bm_1',
				threadId: '100',
				postNumber: 1,
				url: '/a',
				title: 'T',
				author: 'A',
				content: 'C',
				createdAt: Date.now(),
				note: 'Nota personal',
			}

			expect(bookmark.note).toBe('Nota personal')
		})
	})

	describe('filterBookmarks', () => {
		const sampleBookmarks: Bookmark[] = [
			{
				id: 'bm_1',
				threadId: 't1',
				postNumber: 1,
				url: '/a',
				title: 'A',
				author: 'u1',
				content: 'c1',
				createdAt: 1000,
			},
			{
				id: 'bm_2',
				threadId: 't2',
				postNumber: 2,
				url: '/b',
				title: 'B',
				author: 'u2',
				content: 'c2',
				createdAt: 2000,
			},
			{
				id: 'bm_3',
				threadId: 't1',
				postNumber: 3,
				url: '/c',
				title: 'C',
				author: 'u1',
				content: 'c3',
				createdAt: 3000,
			},
		]

		it('should remove single bookmark by id', () => {
			const result = filterBookmarks(sampleBookmarks, ['bm_2'])

			expect(result).toHaveLength(2)
			expect(result.find(b => b.id === 'bm_2')).toBeUndefined()
		})

		it('should remove multiple bookmarks', () => {
			const result = filterBookmarks(sampleBookmarks, ['bm_1', 'bm_3'])

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe('bm_2')
		})

		it('should handle empty removal list', () => {
			const result = filterBookmarks(sampleBookmarks, [])

			expect(result).toHaveLength(3)
		})

		it('should handle non-existent ids gracefully', () => {
			const result = filterBookmarks(sampleBookmarks, ['nonexistent'])

			expect(result).toHaveLength(3)
		})
	})

	describe('findBookmarksByThread', () => {
		const bookmarks: Bookmark[] = [
			{
				id: 'bm_1',
				threadId: 't1',
				postNumber: 1,
				url: '/a',
				title: 'A',
				author: 'u',
				content: 'c',
				createdAt: 1,
			},
			{
				id: 'bm_2',
				threadId: 't2',
				postNumber: 2,
				url: '/b',
				title: 'B',
				author: 'u',
				content: 'c',
				createdAt: 2,
			},
			{
				id: 'bm_3',
				threadId: 't1',
				postNumber: 3,
				url: '/c',
				title: 'C',
				author: 'u',
				content: 'c',
				createdAt: 3,
			},
		]

		it('should find all bookmarks for a thread', () => {
			const result = findBookmarksByThread(bookmarks, 't1')

			expect(result).toHaveLength(2)
			expect(result.every(b => b.threadId === 't1')).toBe(true)
		})

		it('should return empty for unknown thread', () => {
			const result = findBookmarksByThread(bookmarks, 'unknown')

			expect(result).toHaveLength(0)
		})
	})

	describe('sortBookmarks', () => {
		const bookmarks: Bookmark[] = [
			{
				id: 'bm_1',
				threadId: 't_charlie',
				postNumber: 1,
				url: '/a',
				title: 'A',
				author: 'zack',
				content: 'c',
				createdAt: 2000,
			},
			{
				id: 'bm_2',
				threadId: 't_alpha',
				postNumber: 2,
				url: '/b',
				title: 'B',
				author: 'alice',
				content: 'c',
				createdAt: 3000,
			},
			{
				id: 'bm_3',
				threadId: 't_bravo',
				postNumber: 3,
				url: '/c',
				title: 'C',
				author: 'mike',
				content: 'c',
				createdAt: 1000,
			},
		]

		it('should sort by date (newest first)', () => {
			const result = sortBookmarks(bookmarks, 'date')

			expect(result[0].createdAt).toBe(3000)
			expect(result[2].createdAt).toBe(1000)
		})

		it('should sort by thread alphabetically', () => {
			const result = sortBookmarks(bookmarks, 'thread')

			expect(result[0].threadId).toBe('t_alpha')
			expect(result[1].threadId).toBe('t_bravo')
			expect(result[2].threadId).toBe('t_charlie')
		})

		it('should sort by author alphabetically', () => {
			const result = sortBookmarks(bookmarks, 'author')

			expect(result[0].author).toBe('alice')
			expect(result[1].author).toBe('mike')
			expect(result[2].author).toBe('zack')
		})
	})
})
