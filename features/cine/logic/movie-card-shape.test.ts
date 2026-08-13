import { describe, expect, it } from 'vitest'
import { CARD_HEIGHT, CARD_RATIO, CARD_RATIO_TOLERANCE, CARD_WIDTH, isCardRatio } from './movie-card-shape'

describe('isCardRatio', () => {
	it('accepts the exact card dimensions', () => {
		expect(isCardRatio(CARD_WIDTH, CARD_HEIGHT)).toBe(true)
	})

	it('accepts a scaled copy of the card', () => {
		expect(isCardRatio(600, 226.5)).toBe(true)
		expect(isCardRatio(2400, 906)).toBe(true)
	})

	it('accepts a ratio just inside the relative tolerance', () => {
		expect(CARD_RATIO_TOLERANCE).toBe(0.03)
		expect(isCardRatio(CARD_RATIO * 1.029 * 100, 100)).toBe(true)
		expect(isCardRatio(CARD_RATIO * 0.971 * 100, 100)).toBe(true)
	})

	it('rejects a ratio just outside it', () => {
		expect(isCardRatio(CARD_RATIO * 1.031 * 100, 100)).toBe(false)
		expect(isCardRatio(CARD_RATIO * 0.969 * 100, 100)).toBe(false)
	})

	/**
	 * The shapes that actually turn up on a forum. If any of these starts passing, the import
	 * dialog will offer the user a wall of images that are not cards.
	 */
	it('rejects ordinary image shapes', () => {
		expect(isCardRatio(1920, 1080)).toBe(false) // 16:9
		expect(isCardRatio(1000, 1000)).toBe(false) // square
		expect(isCardRatio(600, 900)).toBe(false) // poster, 2:3
		expect(isCardRatio(1200, 630)).toBe(false) // social preview
		expect(isCardRatio(2560, 1097)).toBe(false) // 21:9 ultrawide
		expect(isCardRatio(1500, 500)).toBe(false) // 3:1 header
	})

	it('rejects the widescreen cinema ratios, which are the nearest common shapes', () => {
		expect(isCardRatio(2350, 1000)).toBe(false) // 2.35:1
		expect(isCardRatio(2390, 1000)).toBe(false) // 2.39:1
	})

	it('rejects zero or negative dimensions instead of dividing by them', () => {
		expect(isCardRatio(0, 0)).toBe(false)
		expect(isCardRatio(1200, 0)).toBe(false)
		expect(isCardRatio(-1200, 453)).toBe(false)
		expect(isCardRatio(1200, -453)).toBe(false)
	})
})
