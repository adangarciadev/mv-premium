/**
 * Tests for Theme Utilities
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isMVDarkMode } from './theme-utils'

describe('theme-utils', () => {
	describe('isMVDarkMode', () => {
		let originalQuerySelectorAll: typeof document.querySelectorAll

		beforeEach(() => {
			originalQuerySelectorAll = document.querySelectorAll
		})

		afterEach(() => {
			document.querySelectorAll = originalQuerySelectorAll
		})

		it('should return true when dark stylesheet is loaded', () => {
			const mockLinks = [
				{ href: 'https://mediavida.com/style/123/dark_v7.css' },
				{ href: 'https://mediavida.com/style/other.css' },
			]
			document.querySelectorAll = vi.fn().mockReturnValue(mockLinks)

			expect(isMVDarkMode()).toBe(true)
		})

		it('should return false when only light stylesheet is loaded', () => {
			const mockLinks = [
				{ href: 'https://mediavida.com/style/123/light.css' },
				{ href: 'https://mediavida.com/style/other.css' },
			]
			document.querySelectorAll = vi.fn().mockReturnValue(mockLinks)

			expect(isMVDarkMode()).toBe(false)
		})

		it('should return false when no stylesheets are loaded', () => {
			document.querySelectorAll = vi.fn().mockReturnValue([])

			expect(isMVDarkMode()).toBe(false)
		})

		it('should detect dark mode in various URL formats', () => {
			const darkUrls = [
				'https://mediavida.com/style/123/dark_v7.css',
				'https://mediavida.com/css/dark.css',
				'/assets/dark-theme.css',
				'dark.min.css',
			]

			for (const url of darkUrls) {
				const mockLinks = [{ href: url }]
				document.querySelectorAll = vi.fn().mockReturnValue(mockLinks)
				expect(isMVDarkMode()).toBe(true)
			}
		})

		it('should query for stylesheet links only', () => {
			document.querySelectorAll = vi.fn().mockReturnValue([])

			isMVDarkMode()

			expect(document.querySelectorAll).toHaveBeenCalledWith('link[rel="stylesheet"]')
		})
	})
})
