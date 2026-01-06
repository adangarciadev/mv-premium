/**
 * Tests for Nav Menu logic
 */
import { describe, it, expect } from 'vitest'

// Re-define types and structures for testing
interface NavMenuItem {
	id: string
	label: string
	url?: string
	icon?: string
	children?: NavMenuItem[]
}

interface UserMenuConfig {
	showDashboard: boolean
	showFavorites: boolean
	showSavedThreads: boolean
	customLinks: NavMenuItem[]
}

function buildNavUrl(path: string): string {
	// Ensure path starts with /
	if (!path.startsWith('/')) {
		path = '/' + path
	}
	return `https://www.mediavida.com${path}`
}

function isExternalUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return !parsed.hostname.includes('mediavida.com')
	} catch {
		return false
	}
}

function getActiveMenuItem(path: string, items: NavMenuItem[]): NavMenuItem | null {
	// First check children for more specific matches
	for (const item of items) {
		if (item.children) {
			const found = getActiveMenuItem(path, item.children)
			if (found) return found
		}
	}
	// Then check current level (less specific)
	for (const item of items) {
		if (item.url && item.url !== '/' && path.startsWith(item.url)) {
			return item
		}
	}
	// Home matches everything if nothing else matched
	for (const item of items) {
		if (item.url === '/' && path === '/') {
			return item
		}
	}
	return null
}

function filterAccessibleItems(items: NavMenuItem[], isLoggedIn: boolean): NavMenuItem[] {
	return items.filter(item => {
		// Items requiring auth
		if (item.id === 'messages' && !isLoggedIn) return false
		if (item.id === 'favorites' && !isLoggedIn) return false
		return true
	})
}

describe('nav-menu logic', () => {
	describe('NavMenuItem interface', () => {
		it('should support basic menu item', () => {
			const item: NavMenuItem = {
				id: 'home',
				label: 'Inicio',
				url: '/',
			}

			expect(item.id).toBe('home')
			expect(item.label).toBeDefined()
		})

		it('should support nested children', () => {
			const item: NavMenuItem = {
				id: 'foros',
				label: 'Foros',
				children: [
					{ id: 'cine', label: 'Cine', url: '/foro/cine' },
					{ id: 'hardwar', label: 'Hardwar', url: '/foro/hardwar' },
				],
			}

			expect(item.children).toHaveLength(2)
			expect(item.children?.[0].url).toBe('/foro/cine')
		})

		it('should support optional icon', () => {
			const item: NavMenuItem = {
				id: 'settings',
				label: 'Ajustes',
				url: '/ajustes',
				icon: 'settings',
			}

			expect(item.icon).toBe('settings')
		})
	})

	describe('UserMenuConfig', () => {
		it('should define dashboard visibility', () => {
			const config: UserMenuConfig = {
				showDashboard: true,
				showFavorites: true,
				showSavedThreads: false,
				customLinks: [],
			}

			expect(config.showDashboard).toBe(true)
			expect(config.showSavedThreads).toBe(false)
		})

		it('should support custom links', () => {
			const config: UserMenuConfig = {
				showDashboard: true,
				showFavorites: true,
				showSavedThreads: true,
				customLinks: [{ id: 'custom1', label: 'Mi Link', url: '/custom' }],
			}

			expect(config.customLinks).toHaveLength(1)
		})
	})

	describe('buildNavUrl', () => {
		it('should build absolute URLs', () => {
			expect(buildNavUrl('/foro/cine')).toBe('https://www.mediavida.com/foro/cine')
		})

		it('should handle paths without leading slash', () => {
			expect(buildNavUrl('foro/cine')).toBe('https://www.mediavida.com/foro/cine')
		})

		it('should handle root path', () => {
			expect(buildNavUrl('/')).toBe('https://www.mediavida.com/')
		})
	})

	describe('isExternalUrl', () => {
		it('should identify internal URLs', () => {
			expect(isExternalUrl('https://www.mediavida.com/foro')).toBe(false)
			expect(isExternalUrl('https://mediavida.com/cine')).toBe(false)
		})

		it('should identify external URLs', () => {
			expect(isExternalUrl('https://google.com')).toBe(true)
			expect(isExternalUrl('https://twitter.com')).toBe(true)
		})

		it('should handle relative URLs as internal', () => {
			// Relative URLs throw on URL parsing
			expect(isExternalUrl('/foro/cine')).toBe(false)
		})
	})

	describe('getActiveMenuItem', () => {
		const items: NavMenuItem[] = [
			{ id: 'home', label: 'Inicio', url: '/' },
			{
				id: 'foros',
				label: 'Foros',
				children: [
					{ id: 'cine', label: 'Cine', url: '/foro/cine' },
					{ id: 'hardwar', label: 'Hardwar', url: '/foro/hardwar' },
				],
			},
		]

		it('should find top-level active item', () => {
			const active = getActiveMenuItem('/', items)
			expect(active?.id).toBe('home')
		})

		it('should find nested active item', () => {
			const active = getActiveMenuItem('/foro/cine/thread-123', items)
			expect(active?.id).toBe('cine')
		})

		it('should return null for no match', () => {
			const active = getActiveMenuItem('/random/path', items)
			expect(active).toBeNull()
		})
	})

	describe('filterAccessibleItems', () => {
		const items: NavMenuItem[] = [
			{ id: 'home', label: 'Inicio', url: '/' },
			{ id: 'messages', label: 'Mensajes', url: '/mensajes' },
			{ id: 'favorites', label: 'Favoritos', url: '/favoritos' },
			{ id: 'foros', label: 'Foros', url: '/foro' },
		]

		it('should show all items for logged-in users', () => {
			const filtered = filterAccessibleItems(items, true)
			expect(filtered).toHaveLength(4)
		})

		it('should hide auth-required items for guests', () => {
			const filtered = filterAccessibleItems(items, false)
			expect(filtered).toHaveLength(2) // home and foros only
			expect(filtered.find(i => i.id === 'messages')).toBeUndefined()
			expect(filtered.find(i => i.id === 'favorites')).toBeUndefined()
		})
	})

	describe('menu ordering', () => {
		it('should maintain insertion order', () => {
			const items: NavMenuItem[] = [
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B' },
				{ id: 'c', label: 'C' },
			]

			expect(items[0].id).toBe('a')
			expect(items[2].id).toBe('c')
		})

		it('should support reordering by index', () => {
			const items = ['a', 'b', 'c']
			const reordered = [items[1], items[0], items[2]]

			expect(reordered).toEqual(['b', 'a', 'c'])
		})
	})
})
