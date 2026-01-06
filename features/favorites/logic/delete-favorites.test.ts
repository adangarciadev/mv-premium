/**
 * Tests for Favorites deletion logic
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface Favorite {
	id: string
	url: string
	title: string
	subforum?: string
	author?: string
	lastPost?: string
	addedAt: number
	lastChecked?: number
	newPosts?: number
}

function filterFavorites(favorites: Favorite[], idsToRemove: string[]): Favorite[] {
	const removeSet = new Set(idsToRemove)
	return favorites.filter(f => !removeSet.has(f.id))
}

function findBySubforum(favorites: Favorite[], subforum: string): Favorite[] {
	return favorites.filter(f => f.subforum === subforum)
}

function sortFavorites(favorites: Favorite[], sortBy: 'added' | 'lastPost' | 'title' | 'newPosts'): Favorite[] {
	const sorted = [...favorites]

	switch (sortBy) {
		case 'added':
			return sorted.sort((a, b) => b.addedAt - a.addedAt)
		case 'lastPost':
			return sorted.sort((a, b) => {
				const aTime = a.lastChecked || a.addedAt
				const bTime = b.lastChecked || b.addedAt
				return bTime - aTime
			})
		case 'title':
			return sorted.sort((a, b) => a.title.localeCompare(b.title))
		case 'newPosts':
			return sorted.sort((a, b) => (b.newPosts || 0) - (a.newPosts || 0))
		default:
			return sorted
	}
}

function markAsChecked(favorite: Favorite): Favorite {
	return {
		...favorite,
		lastChecked: Date.now(),
		newPosts: 0,
	}
}

describe('favorites delete-favorites', () => {
	describe('Favorite interface', () => {
		it('should have required fields', () => {
			const favorite: Favorite = {
				id: '123456',
				url: '/foro/off-topic/hilo-123456',
				title: 'Título del hilo favorito',
				addedAt: Date.now(),
			}

			expect(favorite.id).toBeDefined()
			expect(favorite.url).toBeDefined()
			expect(favorite.title).toBeDefined()
			expect(favorite.addedAt).toBeGreaterThan(0)
		})

		it('should support subforum tracking', () => {
			const favorite: Favorite = {
				id: '100',
				url: '/foro/cine/review-100',
				title: 'Review película',
				subforum: 'Cine',
				addedAt: Date.now(),
			}

			expect(favorite.subforum).toBe('Cine')
		})

		it('should track new posts count', () => {
			const favorite: Favorite = {
				id: '200',
				url: '/url',
				title: 'Hilo activo',
				addedAt: Date.now(),
				newPosts: 5,
			}

			expect(favorite.newPosts).toBe(5)
		})
	})

	describe('filterFavorites', () => {
		const sampleFavorites: Favorite[] = [
			{ id: 'f1', url: '/a', title: 'A', addedAt: 1000 },
			{ id: 'f2', url: '/b', title: 'B', addedAt: 2000 },
			{ id: 'f3', url: '/c', title: 'C', addedAt: 3000 },
		]

		it('should remove single favorite', () => {
			const result = filterFavorites(sampleFavorites, ['f2'])

			expect(result).toHaveLength(2)
			expect(result.find(f => f.id === 'f2')).toBeUndefined()
		})

		it('should remove multiple favorites', () => {
			const result = filterFavorites(sampleFavorites, ['f1', 'f3'])

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe('f2')
		})

		it('should handle empty list', () => {
			const result = filterFavorites(sampleFavorites, [])
			expect(result).toHaveLength(3)
		})

		it('should handle non-existent ids', () => {
			const result = filterFavorites(sampleFavorites, ['unknown'])
			expect(result).toHaveLength(3)
		})
	})

	describe('findBySubforum', () => {
		const favorites: Favorite[] = [
			{ id: '1', url: '/a', title: 'Cine 1', subforum: 'Cine', addedAt: 1 },
			{ id: '2', url: '/b', title: 'Hardware', subforum: 'Hardwar', addedAt: 2 },
			{ id: '3', url: '/c', title: 'Cine 2', subforum: 'Cine', addedAt: 3 },
		]

		it('should find all favorites in subforum', () => {
			const result = findBySubforum(favorites, 'Cine')

			expect(result).toHaveLength(2)
			expect(result.every(f => f.subforum === 'Cine')).toBe(true)
		})

		it('should return empty for unknown subforum', () => {
			const result = findBySubforum(favorites, 'Unknown')
			expect(result).toHaveLength(0)
		})
	})

	describe('sortFavorites', () => {
		const favorites: Favorite[] = [
			{ id: '1', url: '/a', title: 'Zebra', addedAt: 2000, newPosts: 3 },
			{ id: '2', url: '/b', title: 'Apple', addedAt: 3000, newPosts: 10 },
			{ id: '3', url: '/c', title: 'Mango', addedAt: 1000, newPosts: 0 },
		]

		it('should sort by added date (newest first)', () => {
			const result = sortFavorites(favorites, 'added')

			expect(result[0].addedAt).toBe(3000)
			expect(result[2].addedAt).toBe(1000)
		})

		it('should sort by title alphabetically', () => {
			const result = sortFavorites(favorites, 'title')

			expect(result[0].title).toBe('Apple')
			expect(result[1].title).toBe('Mango')
			expect(result[2].title).toBe('Zebra')
		})

		it('should sort by new posts (most first)', () => {
			const result = sortFavorites(favorites, 'newPosts')

			expect(result[0].newPosts).toBe(10)
			expect(result[1].newPosts).toBe(3)
			expect(result[2].newPosts).toBe(0)
		})
	})

	describe('markAsChecked', () => {
		it('should update lastChecked timestamp', () => {
			const favorite: Favorite = {
				id: '1',
				url: '/a',
				title: 'T',
				addedAt: 1000,
				newPosts: 5,
			}

			const checked = markAsChecked(favorite)

			expect(checked.lastChecked).toBeGreaterThan(0)
			expect(checked.newPosts).toBe(0)
		})

		it('should not mutate original', () => {
			const original: Favorite = {
				id: '1',
				url: '/a',
				title: 'T',
				addedAt: 1000,
				newPosts: 5,
			}

			markAsChecked(original)

			expect(original.newPosts).toBe(5) // Unchanged
		})
	})
})
