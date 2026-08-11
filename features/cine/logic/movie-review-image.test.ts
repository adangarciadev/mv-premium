import { describe, expect, it } from 'vitest'
import { layoutMovieTitle, truncateToWidth } from './movie-review-image'

/**
 * Fake 2D context that measures each code point as half the current font size, so a 20px font
 * means "10px per character" and the expected wrap points are easy to reason about.
 */
function createMeasuringContext(): CanvasRenderingContext2D {
	const ctx = {
		font: '900 20px sans-serif',
		measureText(text: string) {
			const fontSize = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 20)
			return { width: Array.from(text).length * fontSize * 0.5 }
		},
	}
	return ctx as unknown as CanvasRenderingContext2D
}

function measure(text: string, fontSize: number) {
	return Array.from(text).length * fontSize * 0.5
}

describe('truncateToWidth', () => {
	const ctx = createMeasuringContext()

	it('returns the text untouched when it already fits', () => {
		expect(truncateToWidth(ctx, 'SupermaN_CK', 200)).toBe('SupermaN_CK')
	})

	it('returns the text untouched when it fits exactly', () => {
		expect(truncateToWidth(ctx, 'Adan', 40)).toBe('Adan')
	})

	it('cuts an overflowing single line and appends an ellipsis within the budget', () => {
		const result = truncateToWidth(ctx, 'un_nombre_de_usuario_larguisimo', 100)

		expect(result).toBe('un_nombre…')
		expect(measure(result, 20)).toBeLessThanOrEqual(100)
	})

	it('does not leave a trailing space before the ellipsis', () => {
		expect(truncateToWidth(ctx, 'Blade Runner 2049', 60)).toBe('Blade…')
	})

	it('never drops below a single character plus the ellipsis', () => {
		expect(truncateToWidth(ctx, 'Interstellar', 5)).toBe('I…')
	})

	it('cuts by code point so astral characters are not split into surrogate halves', () => {
		const result = truncateToWidth(ctx, '🎬🎬🎬🎬🎬', 30)

		expect(result).toBe('🎬🎬…')
		// No lone high surrogate: every astral character survived as a complete pair.
		expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
	})
})

describe('layoutMovieTitle', () => {
	const ctx = createMeasuringContext()
	const MAX_WIDTH = 650

	it('keeps a short title on one line at the largest size', () => {
		const layout = layoutMovieTitle(ctx, 'Phenomenon', MAX_WIDTH)

		expect(layout.lines).toEqual(['Phenomenon'])
		expect(layout.fontSize).toBe(38)
		expect(layout.lineHeight).toBe(42)
	})

	it('wraps a long title onto two lines instead of cutting it', () => {
		const title = 'Phenomenon (Algo extraordinario más allá de la vida)'
		const layout = layoutMovieTitle(ctx, title, MAX_WIDTH)

		expect(layout.lines.length).toBe(2)
		expect(layout.lines.join(' ')).toBe(title)
		expect(layout.lines.join('')).not.toContain('…')
	})

	it('shrinks the font only as far as needed to reach two lines', () => {
		const title = 'El asesinato de Jesse James por el cobarde Robert Ford'
		const layout = layoutMovieTitle(ctx, title, MAX_WIDTH)

		expect(layout.lines.length).toBeLessThanOrEqual(2)
		expect(layout.fontSize).toBeGreaterThan(18)
		expect(layout.fontSize).toBeLessThanOrEqual(38)
		for (const line of layout.lines) expect(measure(line, layout.fontSize)).toBeLessThanOrEqual(MAX_WIDTH)
	})

	it('keeps every word of an extremely long title, even past the minimum size', () => {
		const title = Array.from({ length: 40 }, (_, index) => `palabra${index}`).join(' ')
		const layout = layoutMovieTitle(ctx, title, MAX_WIDTH)

		expect(layout.lines.join(' ')).toBe(title)
		expect(layout.fontSize).toBe(18)
	})

	it('leaves an unbreakable word whole and lets the canvas condense it', () => {
		const title = 'A'.repeat(200)
		const layout = layoutMovieTitle(ctx, title, MAX_WIDTH)

		expect(layout.lines).toEqual([title])
		expect(layout.fontSize).toBe(18)
	})

	it('sets the chosen font on the context before returning', () => {
		const layout = layoutMovieTitle(ctx, 'Dune', MAX_WIDTH)

		expect(ctx.font).toContain(`${layout.fontSize}px`)
	})
})
