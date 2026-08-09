import { describe, expect, it } from 'vitest'
import {
	buildMovieMetadata,
	getMovieRatingTier,
	getMovieReviewBadge,
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
		expect(getMovieReviewBadge('guilty-pleasure')?.label).toBe('CULPABLE PLACER'))
})
