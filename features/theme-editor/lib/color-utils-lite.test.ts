/**
 * Tests for Color Utilities (Lite)
 *
 * Tests hex parsing, OKLCH conversions, and WCAG contrast calculations.
 */
import { describe, it, expect } from 'vitest'
import {
	parseHex,
	formatHex,
	hexToOklch,
	oklchToHex,
	wcagContrast,
	rgbToOklch,
	oklchToRgb,
	oklch,
	clampChroma,
} from '@/features/theme-editor/lib/color-utils-lite'

describe('color-utils-lite', () => {
	describe('parseHex', () => {
		it('should parse 6-digit hex colors', () => {
			const rgb = parseHex('#ff0000')
			expect(rgb).toBeDefined()
			expect(rgb?.r).toBeCloseTo(1, 2)
			expect(rgb?.g).toBeCloseTo(0, 2)
			expect(rgb?.b).toBeCloseTo(0, 2)
		})

		it('should parse 6-digit hex without hash', () => {
			const rgb = parseHex('00ff00')
			expect(rgb?.g).toBeCloseTo(1, 2)
		})

		it('should parse 3-digit hex colors', () => {
			const rgb = parseHex('#f00')
			expect(rgb?.r).toBeCloseTo(1, 2)
			expect(rgb?.g).toBeCloseTo(0, 2)
		})

		it('should handle white and black', () => {
			const white = parseHex('#ffffff')
			expect(white?.r).toBeCloseTo(1, 2)
			expect(white?.g).toBeCloseTo(1, 2)
			expect(white?.b).toBeCloseTo(1, 2)

			const black = parseHex('#000000')
			expect(black?.r).toBeCloseTo(0, 2)
		})

		it('should return undefined for invalid hex', () => {
			expect(parseHex('invalid')).toBeUndefined()
			expect(parseHex('#gggggg')).toBeUndefined()
		})
	})

	describe('formatHex', () => {
		it('should format RGB to hex', () => {
			expect(formatHex({ r: 1, g: 0, b: 0 })).toBe('#ff0000')
			expect(formatHex({ r: 0, g: 1, b: 0 })).toBe('#00ff00')
			expect(formatHex({ r: 0, g: 0, b: 1 })).toBe('#0000ff')
		})

		it('should clamp values outside 0-1', () => {
			expect(formatHex({ r: 1.5, g: -0.5, b: 0.5 })).toBe('#ff0080')
		})

		it('should handle middle values', () => {
			const hex = formatHex({ r: 0.5, g: 0.5, b: 0.5 })
			expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
		})
	})

	describe('hexToOklch', () => {
		it('should convert white to high lightness', () => {
			const oklch = hexToOklch('#ffffff')
			expect(oklch?.l).toBeCloseTo(1, 1)
			expect(oklch?.c).toBeLessThan(0.01) // Near achromatic
		})

		it('should convert black to low lightness', () => {
			const oklch = hexToOklch('#000000')
			expect(oklch?.l).toBeCloseTo(0, 1)
		})

		it('should convert red to have hue near 30', () => {
			const oklch = hexToOklch('#ff0000')
			expect(oklch?.h).toBeGreaterThan(20)
			expect(oklch?.h).toBeLessThan(40)
		})

		it('should return undefined for invalid input', () => {
			expect(hexToOklch('invalid')).toBeUndefined()
		})
	})

	describe('oklchToHex', () => {
		it('should convert white oklch to white hex', () => {
			const hex = oklchToHex({ mode: 'oklch', l: 1, c: 0 })
			expect(hex).toBe('#ffffff')
		})

		it('should convert black oklch to black hex', () => {
			const hex = oklchToHex({ mode: 'oklch', l: 0, c: 0 })
			expect(hex).toBe('#000000')
		})

		it('should roundtrip with hexToOklch', () => {
			const original = '#3388cc'
			const oklchColor = hexToOklch(original)
			const result = oklchToHex(oklchColor!)
			expect(result.toLowerCase()).toBe(original.toLowerCase())
		})
	})

	describe('wcagContrast', () => {
		it('should return 21 for black on white', () => {
			const contrast = wcagContrast('#000000', '#ffffff')
			expect(contrast).toBeCloseTo(21, 0)
		})

		it('should return 1 for same colors', () => {
			const contrast = wcagContrast('#888888', '#888888')
			expect(contrast).toBeCloseTo(1, 2)
		})

		it('should return value above 4.5 for good contrast', () => {
			// Dark blue on white should have good contrast
			const contrast = wcagContrast('#0044aa', '#ffffff')
			expect(contrast).toBeGreaterThan(4.5)
		})

		it('should return low value for poor contrast', () => {
			// Light gray on white
			const contrast = wcagContrast('#eeeeee', '#ffffff')
			expect(contrast).toBeLessThan(2)
		})
	})

	describe('oklch factory', () => {
		it('should create oklch object', () => {
			const color = oklch(0.5, 0.2, 180)
			expect(color.mode).toBe('oklch')
			expect(color.l).toBe(0.5)
			expect(color.c).toBe(0.2)
			expect(color.h).toBe(180)
		})

		it('should handle undefined hue', () => {
			const color = oklch(0.5, 0)
			expect(color.h).toBeUndefined()
		})
	})

	describe('clampChroma', () => {
		it('should not significantly change in-gamut colors', () => {
			// Use a lower chroma that's definitely in gamut
			const original = oklch(0.7, 0.05, 180)
			const clamped = clampChroma(original)
			// The clamped value should be close to original (within precision)
			expect(clamped.c).toBeCloseTo(original.c, 2)
		})

		it('should reduce chroma for out-of-gamut colors', () => {
			// Very high chroma that's definitely out of gamut
			const original = oklch(0.5, 0.5, 180)
			const clamped = clampChroma(original)
			expect(clamped.c).toBeLessThan(original.c)
		})
	})
})
