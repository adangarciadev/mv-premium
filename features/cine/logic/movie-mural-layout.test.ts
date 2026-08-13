import { describe, expect, it } from 'vitest'
import {
	getMuralColumns,
	getMuralGeometry,
	MURAL_MAX_POSTERS,
	MURAL_PADDING,
	MURAL_WIDTH,
	selectMuralReviews,
} from './movie-mural-layout'
import type { MovieReviewRecord } from './movie-review-store'

function makeRecord(overrides: Partial<MovieReviewRecord> = {}): MovieReviewRecord {
	return {
		imageId: 'aaaaaaaaa',
		imageUrl: 'https://iili.io/aaaaaaaaa.png',
		tmdbId: 1,
		title: 'Una película',
		year: '2024',
		posterUrl: null,
		rating: 8,
		badge: null,
		quote: '',
		createdAt: 1000,
		source: 'generated',
		publication: { threadUrl: 'u', threadTitle: 't', postNumber: '1', confirmedAt: 1 },
		...overrides,
	}
}

describe('getMuralColumns', () => {
	it('never drops below four or rises above eight', () => {
		expect(getMuralColumns(0)).toBe(4)
		expect(getMuralColumns(1)).toBe(4)
		expect(getMuralColumns(100)).toBe(8)
	})

	/** Each boundary is where the wall would otherwise gain a row and start growing tall. */
	it('steps up at the counts where a row would be added', () => {
		expect(getMuralColumns(8)).toBe(4)
		expect(getMuralColumns(9)).toBe(5)
		expect(getMuralColumns(12)).toBe(5)
		expect(getMuralColumns(13)).toBe(6)
		expect(getMuralColumns(18)).toBe(6)
		expect(getMuralColumns(19)).toBe(7)
		expect(getMuralColumns(24)).toBe(7)
		expect(getMuralColumns(25)).toBe(8)
	})
})

describe('getMuralGeometry', () => {
	it('keeps a fixed width and grows only in height', () => {
		expect(getMuralGeometry(1).width).toBe(MURAL_WIDTH)
		expect(getMuralGeometry(42).width).toBe(MURAL_WIDTH)
		expect(getMuralGeometry(42).height).toBeGreaterThan(getMuralGeometry(1).height)
	})

	it('derives poster and cell sizes from the column count', () => {
		const four = getMuralGeometry(1)
		expect(four.columns).toBe(4)
		expect(four.rows).toBe(1)
		expect(four.posterWidth).toBe(268)
		expect(four.posterHeight).toBe(402)
		expect(four.cellHeight).toBe(436)
		expect(four.height).toBe(744)
	})

	it('adds a row rather than stretching the posters', () => {
		const five = getMuralGeometry(5)
		expect(five.columns).toBe(4)
		expect(five.rows).toBe(2)
		expect(five.posterWidth).toBe(268)
		expect(five.height).toBe(1196)
	})

	it('shrinks the posters as the collection grows', () => {
		expect(getMuralGeometry(12).posterWidth).toBeCloseTo(211.2, 5)
		expect(getMuralGeometry(42).posterWidth).toBe(126)
		expect(getMuralGeometry(42).rows).toBe(6)
		expect(getMuralGeometry(42).height).toBe(1726)
	})

	it('keeps posters at the 2:3 film poster ratio', () => {
		for (const count of [1, 5, 12, 20, 42]) {
			const geometry = getMuralGeometry(count)
			expect(geometry.posterHeight / geometry.posterWidth).toBeCloseTo(1.5, 10)
		}
	})

	/** The wall stays near square across the range, never a ribbon and never a tower. */
	it('holds a readable aspect ratio at every size', () => {
		for (const count of [1, 5, 10, 20, 30, 42]) {
			const geometry = getMuralGeometry(count)
			const ratio = geometry.width / geometry.height
			expect(ratio).toBeGreaterThan(0.65)
			expect(ratio).toBeLessThan(1.7)
		}
	})

	it('reports no rows for an empty collection instead of dividing by zero', () => {
		const empty = getMuralGeometry(0)
		expect(empty.rows).toBe(0)
		expect(empty.height).toBe(308)
		expect(Number.isFinite(empty.posterWidth)).toBe(true)
	})

	describe('cell positions', () => {
		it('starts a full row at the left padding', () => {
			const geometry = getMuralGeometry(8)
			expect(geometry.cellX(0, 8)).toBe(MURAL_PADDING)
			expect(geometry.cellX(4, 8)).toBe(MURAL_PADDING)
		})

		it('advances one poster plus a gap across a row', () => {
			const geometry = getMuralGeometry(8)
			expect(geometry.cellX(1, 8)).toBe(324)
			expect(geometry.cellX(2, 8)).toBe(608)
			expect(geometry.cellX(3, 8)).toBe(892)
		})

		it('centres a short final row so the wall never ends ragged', () => {
			const geometry = getMuralGeometry(5)
			// One poster alone in the last row sits in the middle of the content width.
			expect(geometry.cellX(4, 5)).toBe(466)
		})

		it('advances one cell plus a gap down the rows', () => {
			const geometry = getMuralGeometry(5)
			expect(geometry.cellY(0)).toBe(172)
			expect(geometry.cellY(3)).toBe(172)
			expect(geometry.cellY(4)).toBe(624)
		})
	})
})

describe('selectMuralReviews', () => {
	const records = [
		makeRecord({ imageId: 'aaaaaaaaa', title: 'Media', rating: 7, year: '2024' }),
		makeRecord({ imageId: 'bbbbbbbbb', title: 'Mejor', rating: 9.5, year: '2023' }),
		makeRecord({ imageId: 'ccccccccc', title: 'Buena', rating: 8, year: '2024' }),
	]

	it('ranks by score, descending', () => {
		expect(selectMuralReviews(records, { year: 'all', limit: null }).map(record => record.rating)).toEqual([9.5, 8, 7])
	})

	it('filters by year', () => {
		const selected = selectMuralReviews(records, { year: '2024', limit: null })

		expect(selected.map(record => record.imageId)).toEqual(['ccccccccc', 'aaaaaaaaa'])
	})

	it('keeps only the best when a limit is given', () => {
		expect(selectMuralReviews(records, { year: 'all', limit: 2 }).map(record => record.title)).toEqual([
			'Mejor',
			'Buena',
		])
	})

	it('never returns more than the wall can hold, even without a limit', () => {
		const many = Array.from({ length: 80 }, (_, index) => makeRecord({ imageId: `film-${index}`, rating: index % 10 }))

		expect(selectMuralReviews(many, { year: 'all', limit: null })).toHaveLength(MURAL_MAX_POSTERS)
		expect(selectMuralReviews(many, { year: 'all', limit: 999 })).toHaveLength(MURAL_MAX_POSTERS)
	})

	it('returns nothing for an empty collection', () => {
		expect(selectMuralReviews([], { year: 'all', limit: null })).toEqual([])
	})
})
