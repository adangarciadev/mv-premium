/**
 * Tests for Favorite Subforums storage types and structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface FavoriteSubforum {
	id: string
	name: string
	url: string
	iconClass?: string
	description?: string
	addedAt: number
}

describe('favorite-subforums storage', () => {
	describe('FavoriteSubforum interface', () => {
		it('should require core fields', () => {
			const subforum: FavoriteSubforum = {
				id: 'off-topic',
				name: 'OFF-Topic',
				url: '/foro/off-topic',
				addedAt: Date.now(),
			}

			expect(subforum.id).toBeDefined()
			expect(subforum.name).toBeDefined()
			expect(subforum.url).toBeDefined()
			expect(subforum.addedAt).toBeGreaterThan(0)
		})

		it('should support optional iconClass', () => {
			const subforum: FavoriteSubforum = {
				id: 'cine',
				name: 'Cine',
				url: '/foro/cine',
				iconClass: 'fid fid-7',
				addedAt: Date.now(),
			}

			expect(subforum.iconClass).toBe('fid fid-7')
		})

		it('should support optional description', () => {
			const subforum: FavoriteSubforum = {
				id: 'videojuegos',
				name: 'Videojuegos',
				url: '/foro/videojuegos',
				description: 'Subforo de videojuegos',
				addedAt: Date.now(),
			}

			expect(subforum.description).toBeDefined()
		})
	})

	describe('subforum operations', () => {
		it('should detect duplicates by id', () => {
			const subforums: FavoriteSubforum[] = [{ id: 'cine', name: 'Cine', url: '/foro/cine', addedAt: Date.now() }]

			const isDuplicate = (id: string) => subforums.some(s => s.id === id)

			expect(isDuplicate('cine')).toBe(true)
			expect(isDuplicate('hardwar')).toBe(false)
		})

		it('should filter by id', () => {
			const subforums: FavoriteSubforum[] = [
				{ id: 'cine', name: 'Cine', url: '/foro/cine', addedAt: 1000 },
				{ id: 'hardwar', name: 'Hardwar', url: '/foro/hardwar', addedAt: 2000 },
				{ id: 'softwar', name: 'Softwar', url: '/foro/softwar', addedAt: 3000 },
			]

			const filtered = subforums.filter(s => s.id !== 'hardwar')

			expect(filtered).toHaveLength(2)
			expect(filtered.some(s => s.id === 'hardwar')).toBe(false)
		})

		it('should sort by addedAt', () => {
			const subforums: FavoriteSubforum[] = [
				{ id: 'a', name: 'A', url: '/foro/a', addedAt: 3000 },
				{ id: 'b', name: 'B', url: '/foro/b', addedAt: 1000 },
				{ id: 'c', name: 'C', url: '/foro/c', addedAt: 2000 },
			]

			const sorted = [...subforums].sort((a, b) => a.addedAt - b.addedAt)

			expect(sorted[0].id).toBe('b')
			expect(sorted[1].id).toBe('c')
			expect(sorted[2].id).toBe('a')
		})
	})

	describe('URL validation', () => {
		it('should have valid subforum URL format', () => {
			const validUrls = ['/foro/cine', '/foro/off-topic', '/foro/hardwar']

			validUrls.forEach(url => {
				expect(url).toMatch(/^\/foro\/[a-z-]+$/)
			})
		})

		it('should extract subforum id from URL', () => {
			const url = '/foro/off-topic'
			const id = url.split('/').pop()

			expect(id).toBe('off-topic')
		})
	})
})
