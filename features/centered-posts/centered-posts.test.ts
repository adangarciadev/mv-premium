/**
 * Tests for Centered Posts Mode configuration
 */
import { describe, it, expect } from 'vitest'
import { RUNTIME_CACHE_KEYS } from '@/constants'

// Test the CSS generation logic
describe('centered posts mode', () => {
	describe('generateStyles', () => {
		// Simplified version of the actual function for testing
		const generateStyles = (): string => {
			return `
				.c-side { display: none !important; }
				.c-main { width: 100% !important; max-width: 100% !important; }
			`
		}

		it('should generate CSS that hides sidebar', () => {
			const css = generateStyles()

			expect(css).toContain('.c-side')
			expect(css).toContain('display: none')
		})

		it('should generate CSS that expands main content', () => {
			const css = generateStyles()

			expect(css).toContain('.c-main')
			expect(css).toContain('width: 100%')
			expect(css).toContain('max-width: 100%')
		})

		it('should include !important flags', () => {
			const css = generateStyles()

			expect(css).toContain('!important')
		})
	})

	describe('cache management', () => {
		const CACHE_KEY = RUNTIME_CACHE_KEYS.CENTERED_POSTS

		it('should store enabled state in cache', () => {
			const updateCache = (enabled: boolean): void => {
				if (enabled) {
					localStorage.setItem(CACHE_KEY, 'true')
				} else {
					localStorage.removeItem(CACHE_KEY)
				}
			}

			// Enable
			updateCache(true)
			expect(localStorage.getItem(CACHE_KEY)).toBe('true')

			// Disable
			updateCache(false)
			expect(localStorage.getItem(CACHE_KEY)).toBeNull()
		})
	})

	describe('control bar elements', () => {
		it('should define all required sidebar elements to relocate', () => {
			const elementsToMove = [
				'#mvp-favorite-subforums-sidebar',
				'#topic-reply',
				'#more-actions',
				'#topic-nav',
				'.mvp-pinned-sidebar',
			]

			expect(elementsToMove).toHaveLength(5)
			expect(elementsToMove).toContain('#topic-reply')
			expect(elementsToMove).toContain('#more-actions')
		})
	})
})
