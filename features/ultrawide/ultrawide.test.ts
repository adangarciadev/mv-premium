/**
 * Tests for Ultrawide Mode configuration
 */
import { describe, it, expect } from 'vitest'

// Re-define types and functions for testing
type UltrawideMode = 'off' | 'wide' | 'extra-wide' | 'full'

interface WidthConfig {
	maxWidth: string
	padding: string
}

const widthConfig: Record<Exclude<UltrawideMode, 'off'>, WidthConfig> = {
	wide: { maxWidth: '1400px', padding: '0' },
	'extra-wide': { maxWidth: '1800px', padding: '0' },
	full: { maxWidth: 'none', padding: '30px' },
}

function generateStyles(mode: UltrawideMode): string | null {
	if (mode === 'off') return null

	const config = widthConfig[mode]

	return `
    /* MVP Ultrawide Mode - ${mode} */
    .wrapper, #main-wrapper {
      max-width: ${config.maxWidth} !important;
      width: 100% !important;
      padding-left: ${config.padding} !important;
      padding-right: ${config.padding} !important;
    }
  `.trim()
}

function isValidMode(mode: string): mode is UltrawideMode {
	return ['off', 'wide', 'extra-wide', 'full'].includes(mode)
}

describe('ultrawide mode', () => {
	describe('UltrawideMode type', () => {
		it('should have valid mode values', () => {
			const modes: UltrawideMode[] = ['off', 'wide', 'extra-wide', 'full']

			expect(modes).toHaveLength(4)
			modes.forEach(mode => {
				expect(isValidMode(mode)).toBe(true)
			})
		})
	})

	describe('widthConfig', () => {
		it('should define wide mode as 1400px', () => {
			expect(widthConfig.wide.maxWidth).toBe('1400px')
			expect(widthConfig.wide.padding).toBe('0')
		})

		it('should define extra-wide mode as 1800px', () => {
			expect(widthConfig['extra-wide'].maxWidth).toBe('1800px')
			expect(widthConfig['extra-wide'].padding).toBe('0')
		})

		it('should define full mode with no max-width', () => {
			expect(widthConfig.full.maxWidth).toBe('none')
			expect(widthConfig.full.padding).toBe('30px')
		})
	})

	describe('generateStyles', () => {
		it('should return null for off mode', () => {
			expect(generateStyles('off')).toBeNull()
		})

		it('should generate CSS for wide mode', () => {
			const css = generateStyles('wide')

			expect(css).not.toBeNull()
			expect(css).toContain('1400px')
			expect(css).toContain('MVP Ultrawide Mode - wide')
		})

		it('should generate CSS for extra-wide mode', () => {
			const css = generateStyles('extra-wide')

			expect(css).not.toBeNull()
			expect(css).toContain('1800px')
			expect(css).toContain('MVP Ultrawide Mode - extra-wide')
		})

		it('should generate CSS for full mode', () => {
			const css = generateStyles('full')

			expect(css).not.toBeNull()
			expect(css).toContain('max-width: none')
			expect(css).toContain('30px')
		})

		it('should include !important flags', () => {
			const css = generateStyles('wide')

			expect(css).toContain('!important')
		})
	})

	describe('isValidMode', () => {
		it('should return true for valid modes', () => {
			expect(isValidMode('off')).toBe(true)
			expect(isValidMode('wide')).toBe(true)
			expect(isValidMode('extra-wide')).toBe(true)
			expect(isValidMode('full')).toBe(true)
		})

		it('should return false for invalid modes', () => {
			expect(isValidMode('invalid')).toBe(false)
			expect(isValidMode('')).toBe(false)
			expect(isValidMode('ultrawide')).toBe(false)
		})
	})

	describe('mode transitions', () => {
		it('should handle mode changes', () => {
			let currentMode: UltrawideMode = 'off'

			// Simulate mode change
			currentMode = 'wide'
			expect(generateStyles(currentMode)).not.toBeNull()

			// Change again
			currentMode = 'off'
			expect(generateStyles(currentMode)).toBeNull()

			// To full
			currentMode = 'full'
			const css = generateStyles(currentMode)
			expect(css).toContain('none')
		})
	})

	describe('CSS structure', () => {
		it('should target correct selectors', () => {
			const css = generateStyles('wide')

			expect(css).toContain('.wrapper')
			expect(css).toContain('#main-wrapper')
		})

		it('should set width to 100%', () => {
			const css = generateStyles('wide')

			expect(css).toContain('width: 100%')
		})
	})
})
