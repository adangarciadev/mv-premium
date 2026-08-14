import { describe, expect, it } from 'vitest'
import {
	getBarHeight,
	getFirstAndLast,
	getRanking,
	getPeakBand,
	getRatingHistogram,
	getRecapFacts,
	getRecapGeometry,
	getRewatchRanking,
	RATING_BAND_COUNT,
	RECAP_PADDING,
	RECAP_WIDTH,
} from './movie-recap-layout'
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

describe('getRatingHistogram', () => {
	it('always returns every band, so the gaps in a distribution stay visible', () => {
		const bands = getRatingHistogram([])

		expect(bands).toHaveLength(RATING_BAND_COUNT)
		expect(bands.map(band => band.band)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
		expect(bands.every(band => band.count === 0)).toBe(true)
	})

	it('rounds a half point up, the way half stars do', () => {
		const bands = getRatingHistogram([makeRecord({ rating: 7.5 })])

		expect(bands.find(band => band.band === 8)?.count).toBe(1)
		expect(bands.find(band => band.band === 7)?.count).toBe(0)
	})

	it('puts a whole score in its own band', () => {
		expect(getRatingHistogram([makeRecord({ rating: 8 })]).find(band => band.band === 8)?.count).toBe(1)
	})

	it('keeps the lowest and highest scores inside the scale', () => {
		const bands = getRatingHistogram([makeRecord({ rating: 0.5 }), makeRecord({ rating: 10 })])

		expect(bands.find(band => band.band === 1)?.count).toBe(1)
		expect(bands.find(band => band.band === 10)?.count).toBe(1)
	})

	it('counts a real spread', () => {
		const ratings = [9.5, 9, 8.5, 8.5, 8.5, 8, 8, 8, 7.5, 7.5, 7, 6.5, 6, 5.5]
		const bands = getRatingHistogram(ratings.map(rating => makeRecord({ rating })))

		expect(bands.map(band => band.count)).toEqual([0, 0, 0, 0, 0, 2, 2, 5, 4, 1])
	})
})

describe('getPeakBand', () => {
	it('finds the tallest band', () => {
		const bands = getRatingHistogram([9.5, 8, 8, 8, 7].map(rating => makeRecord({ rating })))

		expect(getPeakBand(bands)?.band).toBe(8)
		expect(getPeakBand(bands)?.count).toBe(3)
	})

	it('has nothing to highlight in an empty distribution', () => {
		expect(getPeakBand(getRatingHistogram([]))).toBeNull()
	})

	it('keeps the lower band when two tie, so the highlight never jumps around', () => {
		const bands = getRatingHistogram([7, 7, 9, 9].map(rating => makeRecord({ rating })))

		expect(getPeakBand(bands)?.band).toBe(7)
	})
})

/**
 * The objective replacement for a ranked podium. Chosen by when they happened, so no
 * tie-breaker is ever invented — which is the rule Letterboxd's own recap follows.
 */
describe('getFirstAndLast', () => {
	it('takes the oldest and the newest review', () => {
		const records = [
			makeRecord({ imageId: 'media', createdAt: 2000 }),
			makeRecord({ imageId: 'vieja', createdAt: 1000 }),
			makeRecord({ imageId: 'nueva', createdAt: 3000 }),
		]

		const { first, last } = getFirstAndLast(records)
		expect(first?.imageId).toBe('vieja')
		expect(last?.imageId).toBe('nueva')
	})

	it('ignores the score entirely', () => {
		const records = [
			makeRecord({ imageId: 'floja', createdAt: 1000, rating: 3 }),
			makeRecord({ imageId: 'buenisima', createdAt: 2000, rating: 10 }),
		]

		expect(getFirstAndLast(records).first?.imageId).toBe('floja')
	})

	it('does not repeat a single review as both ends', () => {
		const { first, last } = getFirstAndLast([makeRecord({ imageId: 'unica' })])

		expect(first?.imageId).toBe('unica')
		expect(last).toBeNull()
	})

	it('has neither end for an empty collection', () => {
		expect(getFirstAndLast([])).toEqual({ first: null, last: null })
	})

	it('does not mutate the input', () => {
		const records = [makeRecord({ imageId: 'b', createdAt: 2000 }), makeRecord({ imageId: 'a', createdAt: 1000 })]
		getFirstAndLast(records)

		expect(records.map(record => record.imageId)).toEqual(['b', 'a'])
	})
})

describe('getRecapGeometry', () => {
	const geometry = getRecapGeometry()

	/** Twice a Mediavida post's 648px, so the browser halves it on an integer boundary. */
	it('is exactly double the width of a forum post', () => {
		expect(geometry.width).toBe(RECAP_WIDTH)
		expect(geometry.width).toBe(648 * 2)
		expect(geometry.height).toBe(1004)
	})

	it('spans the bars across the full content width', () => {
		expect(geometry.barX(0)).toBe(RECAP_PADDING)
		expect(geometry.barX(RATING_BAND_COUNT - 1) + geometry.barWidth).toBeCloseTo(geometry.contentRight, 6)
	})

	it('leaves a gap between adjacent bars rather than a border', () => {
		expect(geometry.barGap).toBeGreaterThanOrEqual(2)
		expect(geometry.barX(1) - (geometry.barX(0) + geometry.barWidth)).toBeCloseTo(geometry.barGap, 6)
	})

	it('fits three ranking columns edge to edge', () => {
		expect(geometry.rankingX(0)).toBe(geometry.contentLeft)
		expect(geometry.rankingX(2) + geometry.rankingColumnWidth).toBeCloseTo(geometry.contentRight, 6)
		expect(geometry.rankingX(0) + geometry.rankingColumnWidth).toBeLessThan(geometry.rankingX(1))
	})

	it('stacks the ranking rows without overlap', () => {
		expect(geometry.rankingRowY(1) - geometry.rankingRowY(0)).toBe(geometry.rankingRowHeight)
		expect(geometry.rankingRowY(0)).toBe(geometry.rankingTop)
	})

	it('lays the two end cards side by side inside their own halves', () => {
		expect(geometry.endsCardX(0)).toBe(geometry.contentLeft)
		expect(geometry.endsCardX(1) + geometry.endsCardWidth).toBeCloseTo(geometry.contentRight, 6)
		expect(geometry.endsCardX(0) + geometry.endsCardWidth).toBeLessThan(geometry.endsCardX(1))
		expect(geometry.endsTextX(0) + geometry.endsTextWidth).toBeLessThanOrEqual(
			geometry.endsCardX(0) + geometry.endsCardWidth
		)
	})

	/** The poster has to clear its own card padding, not merely be smaller than the card. */
	it('fits the poster inside its card', () => {
		expect(geometry.posterHeight).toBeLessThanOrEqual(geometry.endsCardHeight)
		expect(geometry.endsTop + geometry.posterHeight).toBeLessThan(geometry.endsTop + geometry.endsCardHeight)
	})

	it('keeps the poster at the 2:3 film ratio', () => {
		expect(geometry.posterHeight / geometry.posterWidth).toBeCloseTo(1.5, 2)
	})

	it('orders the sections down the page without overlap', () => {
		expect(geometry.titleY).toBeLessThan(geometry.subtitleY)
		expect(geometry.subtitleY).toBeLessThan(geometry.factsRuleTopY)
		expect(geometry.factsRuleTopY).toBeLessThan(geometry.factsY)
		expect(geometry.factsY).toBeLessThan(geometry.factsRuleBottomY)
		expect(geometry.factsRuleBottomY).toBeLessThan(geometry.chartLabelY)
		expect(geometry.chartLabelY).toBeLessThan(geometry.chartTop)
		expect(geometry.chartTop).toBeLessThan(geometry.chartBottom)
		expect(geometry.chartBottom).toBeLessThan(geometry.axisY)
		expect(geometry.axisY).toBeLessThan(geometry.rankingLabelY)
		expect(geometry.rankingLabelY).toBeLessThan(geometry.rankingTop)
		expect(geometry.rankingRowY(3) + geometry.rankingRowHeight).toBeLessThanOrEqual(geometry.endsLabelY)
		expect(geometry.endsTop + geometry.endsCardHeight).toBeLessThanOrEqual(geometry.height)
	})

	/** The axis band has to be inside the image, or the score labels get cropped. */
	it('leaves room below the plot for the axis labels', () => {
		expect(geometry.axisY).toBeGreaterThan(geometry.chartBottom)
		expect(geometry.axisY).toBeLessThan(geometry.rankingLabelY)
	})
})

describe('getBarHeight', () => {
	it('gives the tallest band the full plot height', () => {
		expect(getBarHeight(5, 5, 200)).toBe(200)
	})

	it('scales the rest against the peak', () => {
		expect(getBarHeight(1, 5, 200)).toBe(40)
		expect(getBarHeight(4, 5, 200)).toBe(160)
	})

	it('draws nothing for an empty band', () => {
		expect(getBarHeight(0, 5, 200)).toBe(0)
	})

	it('does not divide by a peak of zero', () => {
		expect(getBarHeight(0, 0, 200)).toBe(0)
	})
})

describe('getRanking', () => {
	it('counts repetitions and orders by how often they appear', () => {
		expect(getRanking(['Drama', 'Terror', 'Drama', 'Drama', 'Terror', 'Comedia'])).toEqual([
			{ name: 'Drama', count: 3 },
			{ name: 'Terror', count: 2 },
			{ name: 'Comedia', count: 1 },
		])
	})

	/** The count is the point: a name alone is trivia, a name with a number is a fact. */
	it('carries the count, not just the name', () => {
		expect(getRanking(['Villeneuve', 'Villeneuve'])[0]).toEqual({ name: 'Villeneuve', count: 2 })
	})

	it('keeps only as many as asked for', () => {
		expect(getRanking(['a', 'b', 'c', 'd', 'e'], 3)).toHaveLength(3)
	})

	it('ignores blanks and copes with nothing at all', () => {
		expect(getRanking(['', '  '])).toEqual([])
		expect(getRanking([])).toEqual([])
	})
})

describe('getRecapFacts', () => {
	const records = [makeRecord({ imageId: 'a', rating: 9 }), makeRecord({ imageId: 'b', rating: 8 })]

	it('combines the stored figures with what TMDB could add', () => {
		const facts = getRecapFacts(records, {
			minutes: 250,
			directors: ['Villeneuve', 'Villeneuve', 'Glazer'],
			genres: ['Drama', 'Ciencia ficción'],
			actors: ['Chalamet', 'Zendaya', 'Chalamet'],
		})

		expect(facts.count).toBe(2)
		expect(facts.averageRating).toBe(8.5)
		expect(facts.minutes).toBe(250)
		expect(facts.directors[0]).toEqual({ name: 'Villeneuve', count: 2 })
		expect(facts.genres[0]).toEqual({ name: 'Drama', count: 1 })
		expect(facts.actors[0]).toEqual({ name: 'Chalamet', count: 2 })
	})

	/** The recap must still generate when TMDB cannot be reached. */
	it('stands on its own without any enrichment', () => {
		const facts = getRecapFacts(records, { minutes: null, directors: [], genres: [], actors: [] })

		expect(facts.count).toBe(2)
		expect(facts.minutes).toBeNull()
		expect(facts.directors).toEqual([])
		expect(facts.genres).toEqual([])
		expect(facts.actors).toEqual([])
	})
})

/**
 * The countable version of "what you keep going back to". Letterboxd shows repetitions, never a
 * podium ranked on scores, and this column follows the same rule.
 */
describe('getRewatchRanking', () => {
	it('ranks the films reviewed more than once, most repeated first', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 27205, title: 'Origen' }),
			makeRecord({ imageId: 'b', tmdbId: 27205, title: 'Origen' }),
			makeRecord({ imageId: 'c', tmdbId: 27205, title: 'Origen' }),
			makeRecord({ imageId: 'd', tmdbId: 438631, title: 'Dune' }),
			makeRecord({ imageId: 'e', tmdbId: 438631, title: 'Dune' }),
		]

		expect(getRewatchRanking(records)).toEqual([
			{ name: 'Origen', count: 3 },
			{ name: 'Dune', count: 2 },
		])
	})

	it('leaves out films seen once, because a single viewing is not a repetition', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 27205, title: 'Origen' }),
			makeRecord({ imageId: 'b', tmdbId: 438631, title: 'Dune' }),
		]

		expect(getRewatchRanking(records)).toEqual([])
	})

	/** A rewatch of a film seen before any of this happened has no number the period can print. */
	it('ignores a lone review flagged as a rewatch', () => {
		expect(getRewatchRanking([makeRecord({ rewatch: true })])).toEqual([])
	})

	it('keeps only as many as asked for', () => {
		const records = [1, 2, 3, 4, 5].flatMap(tmdbId => [
			makeRecord({ imageId: `${tmdbId}a`, tmdbId, title: `Película ${tmdbId}` }),
			makeRecord({ imageId: `${tmdbId}b`, tmdbId, title: `Película ${tmdbId}` }),
		])

		expect(getRewatchRanking(records, 3)).toHaveLength(3)
	})

	it('has nothing to rank in an empty collection', () => {
		expect(getRewatchRanking([])).toEqual([])
	})
})

describe('getRecapGeometry with a fourth ranking column', () => {
	it('divides the same content width between four columns', () => {
		const geometry = getRecapGeometry(4)

		expect(geometry.rankingX(0)).toBe(geometry.contentLeft)
		expect(geometry.rankingX(3) + geometry.rankingColumnWidth).toBeCloseTo(geometry.contentRight, 6)
		expect(geometry.rankingColumnWidth).toBeLessThan(getRecapGeometry(3).rankingColumnWidth)
	})

	/** Only the row of columns changes: the image must stay the same size either way. */
	it('does not change the height of the image', () => {
		expect(getRecapGeometry(4).height).toBe(getRecapGeometry(3).height)
	})
})
