/**
 * Tests for Command Menu utilities
 */
import { describe, it, expect } from 'vitest'

// Re-implement pure functions for testing
function normalizeString(str: string): string {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
}

function matchesQuery(text: string, query: string): boolean {
	return normalizeString(text).includes(normalizeString(query))
}

function getIconId(iconClass?: string): number {
	if (!iconClass) return 0
	const match = iconClass.match(/fid-(\d+)/)
	return match ? parseInt(match[1]) : 0
}

function getPageContext(pathname: string) {
	const isThread = /\/foro\/[^/]+\/[^/]+-\d+/.test(pathname)

	return {
		pathname,
		isThread,
		isSubforum: pathname.startsWith('/foro/') && !isThread,
		isHome: pathname === '/' || pathname === '',
		isMessages: pathname.startsWith('/mensajes'),
		isProfile: pathname.startsWith('/id/'),
		isFavorites: pathname.startsWith('/favoritos'),
	}
}

describe('command-menu utils', () => {
	describe('normalizeString', () => {
		it('should remove accents', () => {
			expect(normalizeString('café')).toBe('cafe')
			expect(normalizeString('niño')).toBe('nino')
			expect(normalizeString('señor')).toBe('senor')
		})

		it('should convert to lowercase', () => {
			expect(normalizeString('HELLO')).toBe('hello')
			expect(normalizeString('CamelCase')).toBe('camelcase')
		})

		it('should handle mixed accents and case', () => {
			expect(normalizeString('INFORMACIÓN')).toBe('informacion')
		})

		it('should preserve numbers', () => {
			expect(normalizeString('Test123')).toBe('test123')
		})
	})

	describe('matchesQuery', () => {
		it('should match exact text', () => {
			expect(matchesQuery('Hello World', 'hello')).toBe(true)
			expect(matchesQuery('Hello World', 'world')).toBe(true)
		})

		it('should be case insensitive', () => {
			expect(matchesQuery('Hello', 'HELLO')).toBe(true)
			expect(matchesQuery('HELLO', 'hello')).toBe(true)
		})

		it('should be accent insensitive', () => {
			expect(matchesQuery('información', 'informacion')).toBe(true)
			expect(matchesQuery('cafe', 'café')).toBe(true)
		})

		it('should match partial text', () => {
			expect(matchesQuery('Mediavida Premium', 'media')).toBe(true)
			expect(matchesQuery('Subforos favoritos', 'fav')).toBe(true)
		})

		it('should return false when no match', () => {
			expect(matchesQuery('Hello', 'xyz')).toBe(false)
		})
	})

	describe('getIconId', () => {
		it('should extract icon ID from class string', () => {
			expect(getIconId('fid fid-6')).toBe(6)
			expect(getIconId('fid fid-123')).toBe(123)
		})

		it('should return 0 for missing class', () => {
			expect(getIconId()).toBe(0)
			expect(getIconId('')).toBe(0)
		})

		it('should return 0 for invalid class', () => {
			expect(getIconId('some-other-class')).toBe(0)
		})
	})

	describe('getPageContext', () => {
		it('should detect home page', () => {
			expect(getPageContext('/').isHome).toBe(true)
			expect(getPageContext('').isHome).toBe(true)
		})

		it('should detect thread pages', () => {
			const ctx = getPageContext('/foro/cine/titulo-del-hilo-123456')
			expect(ctx.isThread).toBe(true)
			expect(ctx.isSubforum).toBe(false)
		})

		it('should detect subforum pages', () => {
			const ctx = getPageContext('/foro/cine')
			expect(ctx.isSubforum).toBe(true)
			expect(ctx.isThread).toBe(false)
		})

		it('should detect messages page', () => {
			expect(getPageContext('/mensajes').isMessages).toBe(true)
			expect(getPageContext('/mensajes/inbox').isMessages).toBe(true)
		})

		it('should detect profile pages', () => {
			expect(getPageContext('/id/username').isProfile).toBe(true)
		})

		it('should detect favorites page', () => {
			expect(getPageContext('/favoritos').isFavorites).toBe(true)
		})
	})
})
