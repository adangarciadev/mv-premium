import { describe, expect, it } from 'vitest'
import { wcagContrast } from '@/features/theme-editor/lib/color-utils-lite'
import { MV_COLOR_GROUPS } from './color-groups'
import { generateRandomMvThemeOverrides } from './random-wcag-generator'

function isHexColor(value: string): boolean {
	return /^#[0-9a-f]{6}$/i.test(value)
}

function createSeededRandom(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state += 0x6d2b79f5
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

describe('generateRandomMvThemeOverrides', () => {
	it('returns values for all configured color groups', () => {
		const overrides = generateRandomMvThemeOverrides({ random: createSeededRandom(1) })
		for (const group of MV_COLOR_GROUPS) {
			expect(overrides[group.id]).toBeDefined()
		}
	})

	it('generates valid hex colors', () => {
		const overrides = generateRandomMvThemeOverrides({ random: createSeededRandom(2) })
		for (const value of Object.values(overrides)) {
			expect(isHexColor(value)).toBe(true)
		}
	})

	it('keeps key pairs at WCAG AA contrast or above', () => {
		for (let i = 0; i < 20; i++) {
			const overrides = generateRandomMvThemeOverrides({ random: createSeededRandom(100 + i) })

			expect(wcagContrast(overrides['text-primary'], overrides['page-bg'])).toBeGreaterThanOrEqual(4.5)
			expect(wcagContrast(overrides['text-secondary'], overrides['container-bg'])).toBeGreaterThanOrEqual(4.5)
			expect(wcagContrast(overrides['text-muted'], overrides['container-bg'])).toBeGreaterThanOrEqual(4.5)
			expect(wcagContrast(overrides.accent, overrides['page-bg'])).toBeGreaterThanOrEqual(4.5)
			expect(wcagContrast(overrides.link, overrides['page-bg'])).toBeGreaterThanOrEqual(4.5)
		}
	})

	it('avoids generating near-black page backgrounds all the time', () => {
		for (let i = 0; i < 20; i++) {
			const overrides = generateRandomMvThemeOverrides({ random: createSeededRandom(500 + i) })
			expect(wcagContrast(overrides['page-bg'], '#000000')).toBeGreaterThan(1.25)
		}
	})

	it('can generate a light theme when requested', () => {
		const overrides = generateRandomMvThemeOverrides({
			tone: 'light',
			random: createSeededRandom(42),
		})

		expect(wcagContrast('#000000', overrides['page-bg'])).toBeGreaterThan(10)
		expect(wcagContrast(overrides['text-primary'], overrides['page-bg'])).toBeGreaterThanOrEqual(4.5)
		expect(wcagContrast(overrides.accent, overrides['text-muted'])).toBeGreaterThanOrEqual(2.1)
	})
})
