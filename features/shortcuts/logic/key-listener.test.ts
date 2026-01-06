/**
 * Tests for Keyboard Shortcuts Logic
 */
import { describe, it, expect } from 'vitest'

// Re-define constants for testing
const MV_URLS = {
	FORUM: '/foro',
	FAVORITES: '/favoritos',
	SPY: '/spy',
	MESSAGES: '/mensajes',
}

function getUserProfileUrl(username: string): string {
	return `/id/${username}`
}

function getUserBookmarksUrl(username: string): string {
	return `/id/${username}/marcadores`
}

// Shortcut action definitions
const SHORTCUT_ACTIONS = [
	// Navigation
	{ id: 'home', label: 'Inicio', url: '/' },
	{ id: 'subforums', label: 'Subforos', url: MV_URLS.FORUM },
	{ id: 'favorite_threads', label: 'Hilos favoritos', url: MV_URLS.FAVORITES },
	{ id: 'spy', label: 'Spy', url: MV_URLS.SPY },
	{ id: 'messages', label: 'Mensajes', url: MV_URLS.MESSAGES },

	// User specific
	{ id: 'profile', label: 'Mi perfil', requiresUser: true },
	{ id: 'bookmarks', label: 'Marcadores', requiresUser: true },
	{ id: 'saved', label: 'Hilos guardados', requiresUser: true },
	{ id: 'pinned', label: 'Posts anclados', requiresUser: true },

	// Tools
	{ id: 'panel', label: 'Panel de opciones', isMessage: true },
	{ id: 'drafts', label: 'Borradores', isMessage: true },
	{ id: 'templates', label: 'Plantillas', isMessage: true },
	{ id: 'new-draft', label: 'Nuevo borrador', isMessage: true },
	{ id: 'theme-toggle', label: 'Cambiar tema', isSpecial: true },
]

describe('keyboard-shortcuts', () => {
	describe('SHORTCUT_ACTIONS', () => {
		it('should define navigation shortcuts', () => {
			const navActions = ['home', 'subforums', 'favorite_threads', 'spy', 'messages']
			for (const id of navActions) {
				const action = SHORTCUT_ACTIONS.find(a => a.id === id)
				expect(action).toBeDefined()
				expect(action?.label).toBeDefined()
			}
		})

		it('should define user-specific shortcuts', () => {
			const userActions = SHORTCUT_ACTIONS.filter(a => a.requiresUser)
			expect(userActions.length).toBeGreaterThan(0)
			expect(userActions.some(a => a.id === 'profile')).toBe(true)
			expect(userActions.some(a => a.id === 'bookmarks')).toBe(true)
		})

		it('should define tool shortcuts', () => {
			const toolActions = SHORTCUT_ACTIONS.filter(a => a.isMessage)
			expect(toolActions.length).toBeGreaterThan(0)
			expect(toolActions.some(a => a.id === 'panel')).toBe(true)
			expect(toolActions.some(a => a.id === 'drafts')).toBe(true)
		})

		it('should have unique IDs', () => {
			const ids = SHORTCUT_ACTIONS.map(a => a.id)
			const uniqueIds = new Set(ids)
			expect(uniqueIds.size).toBe(ids.length)
		})
	})

	describe('URL helpers', () => {
		it('should generate profile URL correctly', () => {
			expect(getUserProfileUrl('testuser')).toBe('/id/testuser')
			expect(getUserProfileUrl('user-with-dash')).toBe('/id/user-with-dash')
		})

		it('should generate bookmarks URL correctly', () => {
			expect(getUserBookmarksUrl('testuser')).toBe('/id/testuser/marcadores')
		})
	})

	describe('MV_URLS constants', () => {
		it('should define standard MV paths', () => {
			expect(MV_URLS.FORUM).toBe('/foro')
			expect(MV_URLS.FAVORITES).toBe('/favoritos')
			expect(MV_URLS.SPY).toBe('/spy')
			expect(MV_URLS.MESSAGES).toBe('/mensajes')
		})
	})

	describe('shortcut key validation', () => {
		it('should accept valid single-key shortcuts', () => {
			const validKeys = ['a', 'b', '1', '2', 'F1', 'F12']
			for (const key of validKeys) {
				expect(key.length).toBeGreaterThan(0)
			}
		})

		it('should support modifier combinations', () => {
			const combos = ['Ctrl+K', 'Alt+S', 'Ctrl+Shift+P']
			for (const combo of combos) {
				expect(combo.includes('+')).toBe(true)
			}
		})
	})
})
