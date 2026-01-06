/**
 * Tests for Saved Threads storage types and structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface SavedThread {
	id: string
	title: string
	url: string
	subforum?: string
	subforumUrl?: string
	lastPost?: string
	savedAt: number
	lastVisited?: number
	notes?: string
}

describe('saved-threads storage', () => {
	describe('SavedThread interface', () => {
		it('should require core fields', () => {
			const thread: SavedThread = {
				id: '123456',
				title: 'Hilo de ejemplo',
				url: '/foro/off-topic/hilo-de-ejemplo-123456',
				savedAt: Date.now(),
			}

			expect(thread.id).toBe('123456')
			expect(thread.title).toBeDefined()
			expect(thread.url).toBeDefined()
			expect(thread.savedAt).toBeGreaterThan(0)
		})

		it('should support subforum metadata', () => {
			const thread: SavedThread = {
				id: '789',
				title: 'Otro hilo',
				url: '/foro/cine/otro-hilo-789',
				subforum: 'Cine',
				subforumUrl: '/foro/cine',
				savedAt: Date.now(),
			}

			expect(thread.subforum).toBe('Cine')
			expect(thread.subforumUrl).toBe('/foro/cine')
		})

		it('should support user notes', () => {
			const thread: SavedThread = {
				id: '111',
				title: 'Hilo importante',
				url: '/foro/hardwar/hilo-importante-111',
				notes: 'Revisar más tarde',
				savedAt: Date.now(),
			}

			expect(thread.notes).toBe('Revisar más tarde')
		})

		it('should track last visited time', () => {
			const savedAt = Date.now()
			const lastVisited = savedAt + 10000

			const thread: SavedThread = {
				id: '222',
				title: 'Seguimiento',
				url: '/foro/softwar/seguimiento-222',
				savedAt,
				lastVisited,
			}

			expect(thread.lastVisited).toBeGreaterThan(thread.savedAt)
		})
	})

	describe('thread operations', () => {
		it('should detect duplicates by id', () => {
			const threads: SavedThread[] = [
				{ id: '100', title: 'A', url: '/a', savedAt: 1000 },
				{ id: '200', title: 'B', url: '/b', savedAt: 2000 },
			]

			const isDuplicate = (id: string) => threads.some(t => t.id === id)

			expect(isDuplicate('100')).toBe(true)
			expect(isDuplicate('999')).toBe(false)
		})

		it('should sort by savedAt descending (newest first)', () => {
			const threads: SavedThread[] = [
				{ id: 'a', title: 'A', url: '/a', savedAt: 1000 },
				{ id: 'b', title: 'B', url: '/b', savedAt: 3000 },
				{ id: 'c', title: 'C', url: '/c', savedAt: 2000 },
			]

			const sorted = [...threads].sort((a, b) => b.savedAt - a.savedAt)

			expect(sorted[0].id).toBe('b')
			expect(sorted[1].id).toBe('c')
			expect(sorted[2].id).toBe('a')
		})

		it('should filter by subforum', () => {
			const threads: SavedThread[] = [
				{ id: '1', title: 'A', url: '/a', subforum: 'Cine', savedAt: 1 },
				{ id: '2', title: 'B', url: '/b', subforum: 'Hardwar', savedAt: 2 },
				{ id: '3', title: 'C', url: '/c', subforum: 'Cine', savedAt: 3 },
			]

			const cineThreads = threads.filter(t => t.subforum === 'Cine')

			expect(cineThreads).toHaveLength(2)
		})
	})

	describe('thread ID extraction', () => {
		it('should extract ID from thread URL', () => {
			const extractId = (url: string): string | null => {
				const match = url.match(/-(\d+)(?:\/\d+)?$/)
				return match ? match[1] : null
			}

			expect(extractId('/foro/off-topic/titulo-del-hilo-123456')).toBe('123456')
			expect(extractId('/foro/cine/pelicula-review-789/2')).toBe('789')
			expect(extractId('/foro/invalid')).toBe(null)
		})
	})

	describe('search and filter', () => {
		it('should search threads by title', () => {
			const threads: SavedThread[] = [
				{ id: '1', title: 'Review de películas', url: '/a', savedAt: 1 },
				{ id: '2', title: 'Nuevo GPU RTX', url: '/b', savedAt: 2 },
				{ id: '3', title: 'Películas de terror', url: '/c', savedAt: 3 },
			]

			const searchResults = threads.filter(t => t.title.toLowerCase().includes('películas'))

			expect(searchResults).toHaveLength(2)
		})
	})
})
