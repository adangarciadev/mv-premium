/**
 * Tests for Constants - Storage Keys, Z-Indexes, Timing
 */
import { describe, it, expect } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { Z_INDEXES } from '@/constants/z-indexes'
import { DEBOUNCE, FEEDBACK, DELAY } from '@/constants/timing'

describe('constants', () => {
	describe('STORAGE_KEYS', () => {
		it('should have all keys prefixed with "mvp-"', () => {
			for (const [key, value] of Object.entries(STORAGE_KEYS)) {
				expect(value).toMatch(/^mvp-/)
			}
		})

		it('should have unique values', () => {
			const values = Object.values(STORAGE_KEYS)
			const uniqueValues = new Set(values)
			expect(uniqueValues.size).toBe(values.length)
		})

		it('should define core settings keys', () => {
			expect(STORAGE_KEYS.SETTINGS).toBe('mvp-settings')
			expect(STORAGE_KEYS.PROFILE).toBe('mvp-profile')
		})

		it('should define theme-related keys', () => {
			expect(STORAGE_KEYS.THEME).toBeDefined()
			expect(STORAGE_KEYS.THEME_RAW).toBeDefined()
			expect(STORAGE_KEYS.THEME_CUSTOM).toBeDefined()
		})

		it('should define feature-related keys', () => {
			expect(STORAGE_KEYS.MUTED_WORDS).toBeDefined()
			expect(STORAGE_KEYS.SAVED_THREADS).toBeDefined()
			expect(STORAGE_KEYS.DRAFTS).toBeDefined()
			expect(STORAGE_KEYS.USER_CUSTOMIZATIONS).toBeDefined()
		})

		it('should define prefixes for dynamic keys', () => {
			expect(STORAGE_KEYS.PINNED_PREFIX).toBeDefined()
			expect(STORAGE_KEYS.DRAFT_PREFIX).toBeDefined()
		})
	})

	describe('Z_INDEXES', () => {
		it('should define base layer', () => {
			expect(Z_INDEXES.BASE).toBe(1)
		})

		it('should have increasing z-index for stacking contexts', () => {
			expect(Z_INDEXES.DROPDOWN).toBeLessThan(Z_INDEXES.MODAL)
			expect(Z_INDEXES.MODAL).toBeLessThan(Z_INDEXES.TOAST)
			expect(Z_INDEXES.TOAST).toBeLessThan(Z_INDEXES.TOOLTIP)
		})

		it('should define MAX at very high value', () => {
			expect(Z_INDEXES.MAX).toBeGreaterThan(1000)
		})

		it('should have overlay below modal', () => {
			expect(Z_INDEXES.OVERLAY).toBeLessThan(Z_INDEXES.MODAL)
		})
	})

	describe('DEBOUNCE timing', () => {
		it('should have scroll debounce for performance', () => {
			expect(DEBOUNCE.SCROLL).toBeGreaterThanOrEqual(50)
			expect(DEBOUNCE.SCROLL).toBeLessThanOrEqual(200)
		})

		it('should have input debounce for responsiveness', () => {
			expect(DEBOUNCE.INPUT).toBeGreaterThanOrEqual(100)
			expect(DEBOUNCE.INPUT).toBeLessThanOrEqual(300)
		})

		it('should have heavier search debounce for API calls', () => {
			expect(DEBOUNCE.SEARCH_HEAVY).toBeGreaterThan(DEBOUNCE.INPUT)
		})
	})

	describe('FEEDBACK timing', () => {
		it('should have reasonable toast duration', () => {
			expect(FEEDBACK.TOAST_DURATION).toBeGreaterThanOrEqual(2000)
			expect(FEEDBACK.TOAST_DURATION).toBeLessThanOrEqual(5000)
		})

		it('should have copy feedback shorter than toast', () => {
			expect(FEEDBACK.COPY_FEEDBACK).toBeLessThanOrEqual(FEEDBACK.TOAST_DURATION)
		})

		it('should have tooltip delays', () => {
			expect(FEEDBACK.TOOLTIP_DELAY).toBeDefined()
			expect(FEEDBACK.TOOLTIP_INSTANT).toBe(0)
		})
	})

	describe('DELAY timing', () => {
		it('should have short delays for quick operations', () => {
			expect(DELAY.FOCUS).toBeLessThan(100)
			expect(DELAY.SHORT).toBeLessThanOrEqual(150)
		})

		it('should have longer delays for heavy operations', () => {
			expect(DELAY.RELOAD).toBeGreaterThanOrEqual(1000)
			expect(DELAY.SETTINGS_RELOAD).toBeGreaterThanOrEqual(1000)
		})

		it('should have animation delay reasonable', () => {
			expect(DELAY.ANIMATION).toBeGreaterThanOrEqual(200)
			expect(DELAY.ANIMATION).toBeLessThanOrEqual(500)
		})
	})
})
