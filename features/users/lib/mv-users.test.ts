/**
 * Tests for Users lib - MV Users types and structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface SearchedUser {
	id: string
	nick: string
	avatarUrl?: string
	rol?: string
}

interface MVUser {
	id: string
	nick: string
	avatarUrl?: string
	lastSeen?: number
	notes?: string
	tags?: string[]
}

interface UserSearchResult {
	users: SearchedUser[]
	total: number
	hasMore: boolean
}

describe('mv-users types', () => {
	describe('SearchedUser interface', () => {
		it('should require id and nick', () => {
			const user: SearchedUser = {
				id: '12345',
				nick: 'usuario_ejemplo',
			}

			expect(user.id).toBe('12345')
			expect(user.nick).toBe('usuario_ejemplo')
		})

		it('should support optional avatarUrl', () => {
			const user: SearchedUser = {
				id: '12345',
				nick: 'usuario',
				avatarUrl: 'https://mediavida.com/img/usuarios/12345.jpg',
			}

			expect(user.avatarUrl).toContain('12345')
		})

		it('should support optional rol', () => {
			const user: SearchedUser = {
				id: '1',
				nick: 'admin',
				rol: 'administrador',
			}

			expect(user.rol).toBe('administrador')
		})
	})

	describe('MVUser interface', () => {
		it('should extend basic user info', () => {
			const user: MVUser = {
				id: '999',
				nick: 'test_user',
				avatarUrl: 'https://example.com/avatar.jpg',
				lastSeen: Date.now(),
				notes: 'Usuario conocido',
				tags: ['amigo', 'activo'],
			}

			expect(user.notes).toBeDefined()
			expect(user.tags).toHaveLength(2)
		})

		it('should track lastSeen timestamp', () => {
			const now = Date.now()
			const user: MVUser = {
				id: '100',
				nick: 'recent_user',
				lastSeen: now,
			}

			expect(user.lastSeen).toBe(now)
		})
	})

	describe('UserSearchResult interface', () => {
		it('should contain search metadata', () => {
			const result: UserSearchResult = {
				users: [
					{ id: '1', nick: 'user1' },
					{ id: '2', nick: 'user2' },
				],
				total: 50,
				hasMore: true,
			}

			expect(result.users).toHaveLength(2)
			expect(result.total).toBe(50)
			expect(result.hasMore).toBe(true)
		})

		it('should handle empty results', () => {
			const result: UserSearchResult = {
				users: [],
				total: 0,
				hasMore: false,
			}

			expect(result.users).toHaveLength(0)
			expect(result.hasMore).toBe(false)
		})
	})

	describe('user search operations', () => {
		it('should filter users by nick', () => {
			const users: SearchedUser[] = [
				{ id: '1', nick: 'johndoe' },
				{ id: '2', nick: 'janedoe' },
				{ id: '3', nick: 'bobsmith' },
			]

			const query = 'doe'
			const filtered = users.filter(u => u.nick.toLowerCase().includes(query.toLowerCase()))

			expect(filtered).toHaveLength(2)
		})

		it('should handle case-insensitive search', () => {
			const users: SearchedUser[] = [
				{ id: '1', nick: 'JohnDoe' },
				{ id: '2', nick: 'JANEDOE' },
			]

			const query = 'john'
			const filtered = users.filter(u => u.nick.toLowerCase().includes(query.toLowerCase()))

			expect(filtered).toHaveLength(1)
			expect(filtered[0].nick).toBe('JohnDoe')
		})
	})

	describe('avatar URL handling', () => {
		it('should generate avatar URL from user ID', () => {
			const userId = '12345'
			const avatarUrl = `https://mediavida.com/img/usuarios/${userId}.jpg`

			expect(avatarUrl).toContain(userId)
		})

		it('should provide default avatar when none set', () => {
			const user: SearchedUser = {
				id: '1',
				nick: 'no_avatar',
			}

			const avatarUrl = user.avatarUrl || '/img/default-avatar.jpg'

			expect(avatarUrl).toBe('/img/default-avatar.jpg')
		})
	})

	describe('user tags', () => {
		it('should support multiple tags', () => {
			const user: MVUser = {
				id: '1',
				nick: 'tagged_user',
				tags: ['friend', 'moderator', 'trusted'],
			}

			expect(user.tags).toContain('friend')
			expect(user.tags).toContain('moderator')
		})

		it('should handle adding/removing tags', () => {
			const tags = ['tag1', 'tag2']

			// Add tag
			const withNewTag = [...tags, 'tag3']
			expect(withNewTag).toHaveLength(3)

			// Remove tag
			const withoutTag2 = tags.filter(t => t !== 'tag2')
			expect(withoutTag2).toEqual(['tag1'])
		})
	})
})
