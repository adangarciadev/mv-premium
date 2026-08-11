import { describe, expect, it } from 'vitest'
import {
	buildMovieMetadata,
	getMovieRatingTier,
	getMovieReviewBadge,
	getSuggestedMovieReviewBadge,
	MOVIE_REVIEW_BADGES,
	normalizeMovieRating,
	normalizeMovieReviewQuote,
} from './movie-review'

describe('movie review domain', () => {
	it.each([
		[10, 'must-see'],
		[9, 'must-see'],
		[8.5, 'recommended'],
		[7, 'recommended'],
		[6.5, 'interesting'],
		[5, 'interesting'],
		[2.5, 'not-recommended'],
	])('maps %s to %s', (rating, tier) => {
		expect(getMovieRatingTier(rating).id).toBe(tier)
	})

	it('normalizes ratings to half-star increments', () => expect(normalizeMovieRating(8.74)).toBe(8.5))
	it('allows half a star as the minimum rating', () => expect(normalizeMovieRating(0.1)).toBe(0.5))
	it('limits the editorial quote', () => expect(normalizeMovieReviewQuote('x'.repeat(180))).toHaveLength(160))
	it('does not leave empty metadata separators', () =>
		expect(buildMovieMetadata('Desconocido', '2024', [])).toBe('2024'))
	it('shows at most two genres', () =>
		expect(buildMovieMetadata('Denis Villeneuve', '2024', ['Ciencia ficción', 'Aventura', 'Drama'])).toBe(
			'Denis Villeneuve · 2024 · Ciencia ficción · Aventura'
		))
	it('keeps the approval badge optional', () => expect(getMovieReviewBadge(null)).toBeNull())
	it('resolves a selected approval badge', () => expect(getMovieReviewBadge('masterpiece')?.label).toBe('OBRA MAESTRA'))
	it('includes guilty pleasure as an independent badge', () =>
		expect(getMovieReviewBadge('guilty-pleasure')?.label).toBe('PLACER CULPABLE'))
})

describe('suggested verdict', () => {
	it.each([
		[10, 'masterpiece'],
		[9.5, 'masterpiece'],
		[9, 'must-see'],
		[8.5, 'must-see'],
		[8, 'recommended'],
		[7, 'recommended'],
		[6.5, 'interesting'],
		[5, 'interesting'],
		[4.5, 'disappointing'],
		[3.5, 'disappointing'],
		[3, 'not-recommended'],
		[2, 'not-recommended'],
		[1.5, 'terrible'],
		[0.5, 'terrible'],
	])('suggests %s → %s', (rating, badge) => {
		expect(getSuggestedMovieReviewBadge(rating)).toBe(badge)
	})

	it('falls back to the coldest verdict for a non-finite rating', () =>
		expect(getSuggestedMovieReviewBadge(Number.NaN)).toBe('terrible'))

	it('never suggests guilty pleasure, which exists to contradict the score', () => {
		const suggestions = Array.from({ length: 20 }, (_, index) => getSuggestedMovieReviewBadge((index + 1) / 2))

		expect(suggestions).not.toContain('guilty-pleasure')
	})

	it('only suggests verdicts that exist as badges', () => {
		const ids = MOVIE_REVIEW_BADGES.map(option => option.id)

		for (let rating = 0.5; rating <= 10; rating += 0.5) {
			expect(ids).toContain(getSuggestedMovieReviewBadge(rating))
		}
	})

	it('keeps the badge list ordered as a warm-to-cold ramp, which is how the picker renders it', () => {
		expect(MOVIE_REVIEW_BADGES.map(option => option.id)).toEqual([
			'masterpiece',
			'must-see',
			'recommended',
			'interesting',
			'guilty-pleasure',
			'disappointing',
			'not-recommended',
			'terrible',
		])
	})
})
