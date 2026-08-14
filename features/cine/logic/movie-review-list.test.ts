import { describe, expect, it } from 'vitest'
import {
	countUniqueMovies,
	filterMovieReviews,
	getAvailableYears,
	getDistinctPosterUrls,
	getMovieReviewStats,
	getMovieViewings,
	groupMovieReviews,
	sortMovieReviews,
	splitByPublication,
} from './movie-review-list'
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
		publication: null,
		...overrides,
	}
}

function publishedAt(postNumber: string, threadUrl = 'https://www.mediavida.com/foro/cine/hilo-1') {
	return { threadUrl, threadTitle: 'Hilo', postNumber, confirmedAt: 1 }
}

describe('splitByPublication', () => {
	it('separates published records from the pending tray', () => {
		const records = [
			makeRecord({ imageId: 'aaaaaaaaa', publication: publishedAt('1') }),
			makeRecord({ imageId: 'bbbbbbbbb' }),
		]

		const { published, pending } = splitByPublication(records)

		expect(published.map(record => record.imageId)).toEqual(['aaaaaaaaa'])
		expect(pending.map(record => record.imageId)).toEqual(['bbbbbbbbb'])
	})

	it('handles an empty collection', () => {
		expect(splitByPublication([])).toEqual({ published: [], pending: [] })
	})
})

describe('getMovieReviewStats', () => {
	it('derives count, mean and best', () => {
		const records = [
			makeRecord({ imageId: 'aaaaaaaaa', rating: 8 }),
			makeRecord({ imageId: 'bbbbbbbbb', rating: 9 }),
			makeRecord({ imageId: 'ccccccccc', rating: 6.5 }),
		]

		const stats = getMovieReviewStats(records)

		expect(stats.count).toBe(3)
		// 23.5 / 3 = 7.8333…, shown to one decimal.
		expect(stats.averageRating).toBe(7.8)
		expect(stats.best?.imageId).toBe('bbbbbbbbb')
	})

	it('reports an empty collection without dividing by zero', () => {
		expect(getMovieReviewStats([])).toEqual({ count: 0, averageRating: null, best: null, bestTies: 0 })
	})

	/** Naming a single favourite out of a tie is how the hero and the recap ended up disagreeing. */
	it('counts how many films share the top score, by film and not by review', () => {
		const records = [
			makeRecord({ imageId: 'origen-1', tmdbId: 27205, rating: 10 }),
			makeRecord({ imageId: 'origen-2', tmdbId: 27205, rating: 10 }),
			makeRecord({ imageId: 'padrino', tmdbId: 238, rating: 10 }),
			makeRecord({ imageId: 'dune', tmdbId: 438631, rating: 8.5 }),
		]

		expect(getMovieReviewStats(records).bestTies).toBe(2)
	})

	it('has a single favourite when nothing ties with it', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 1, rating: 10 }),
			makeRecord({ imageId: 'b', tmdbId: 2, rating: 9 }),
		]

		expect(getMovieReviewStats(records).bestTies).toBe(1)
	})

	it('keeps the first record when ratings tie', () => {
		const records = [makeRecord({ imageId: 'firstaaaa', rating: 9 }), makeRecord({ imageId: 'secondbbb', rating: 9 })]

		expect(getMovieReviewStats(records).best?.imageId).toBe('firstaaaa')
	})
})

describe('sortMovieReviews', () => {
	const records = [
		makeRecord({ imageId: 'aaaaaaaaa', title: 'Zodiac', rating: 7, createdAt: 3000 }),
		makeRecord({ imageId: 'bbbbbbbbb', title: 'Alien', rating: 9, createdAt: 1000 }),
		makeRecord({ imageId: 'ccccccccc', title: 'Mulholland Drive', rating: 8, createdAt: 2000 }),
	]

	it('sorts by newest, oldest, rating and title', () => {
		expect(sortMovieReviews(records, 'recent').map(record => record.createdAt)).toEqual([3000, 2000, 1000])
		expect(sortMovieReviews(records, 'oldest').map(record => record.createdAt)).toEqual([1000, 2000, 3000])
		expect(sortMovieReviews(records, 'rating').map(record => record.rating)).toEqual([9, 8, 7])
		expect(sortMovieReviews(records, 'title').map(record => record.title)).toEqual([
			'Alien',
			'Mulholland Drive',
			'Zodiac',
		])
	})

	it('collates Spanish titles properly, so accents and ñ sort where a reader expects', () => {
		const accented = [
			makeRecord({ imageId: 'aaaaaaaaa', title: 'Ñoño' }),
			makeRecord({ imageId: 'bbbbbbbbb', title: 'Ángel' }),
			makeRecord({ imageId: 'ccccccccc', title: 'Alien' }),
			makeRecord({ imageId: 'ddddddddd', title: 'Zodiac' }),
		]

		expect(sortMovieReviews(accented, 'title').map(record => record.title)).toEqual([
			'Alien',
			'Ángel',
			'Ñoño',
			'Zodiac',
		])
	})

	it('does not mutate the input', () => {
		const original = records.map(record => record.title)
		sortMovieReviews(records, 'title')

		expect(records.map(record => record.title)).toEqual(original)
	})
})

describe('filterMovieReviews', () => {
	const records = [
		makeRecord({ imageId: 'aaaaaaaaa', year: '2024', badge: 'masterpiece' }),
		makeRecord({ imageId: 'bbbbbbbbb', year: '2023', badge: 'masterpiece' }),
		makeRecord({ imageId: 'ccccccccc', year: '2024', badge: null }),
	]

	it('filters by year, by badge, and by both at once', () => {
		expect(filterMovieReviews(records, { year: '2024', badge: 'all' })).toHaveLength(2)
		expect(filterMovieReviews(records, { year: 'all', badge: 'masterpiece' })).toHaveLength(2)
		expect(filterMovieReviews(records, { year: '2024', badge: 'masterpiece' })).toHaveLength(1)
	})

	it('returns everything with no filters applied', () => {
		expect(filterMovieReviews(records, { year: 'all', badge: 'all' })).toHaveLength(3)
	})

})

describe('getAvailableYears', () => {
	it('lists distinct years, newest first, ignoring blanks', () => {
		const records = [
			makeRecord({ imageId: 'aaaaaaaaa', year: '2024' }),
			makeRecord({ imageId: 'bbbbbbbbb', year: '1999' }),
			makeRecord({ imageId: 'ccccccccc', year: '2024' }),
			makeRecord({ imageId: 'ddddddddd', year: '2007' }),
			makeRecord({ imageId: 'eeeeeeeee', year: '' }),
		]

		expect(getAvailableYears(records)).toEqual(['2024', '2007', '1999'])
	})

	it('returns nothing for an empty collection', () => {
		expect(getAvailableYears([])).toEqual([])
	})
})

/**
 * A film reviewed more than once is several reviews of one film, and the dashboard has to be able
 * to say both numbers without contradicting itself.
 */
describe('getMovieViewings', () => {
	it('numbers the viewings of a film by when they happened', () => {
		const records = [
			makeRecord({ imageId: 'segunda', tmdbId: 27205, createdAt: 2000, publication: publishedAt('2') }),
			makeRecord({ imageId: 'primera', tmdbId: 27205, createdAt: 1000, publication: publishedAt('1') }),
			makeRecord({ imageId: 'tercera', tmdbId: 27205, createdAt: 3000, publication: publishedAt('3') }),
		]

		const viewings = getMovieViewings(records)

		expect(viewings.get('primera')).toEqual({ ordinal: 1, isRewatch: false })
		expect(viewings.get('segunda')).toEqual({ ordinal: 2, isRewatch: true })
		expect(viewings.get('tercera')).toEqual({ ordinal: 3, isRewatch: true })
	})

	it('keeps films apart even when they were reviewed the same day', () => {
		const records = [
			makeRecord({ imageId: 'origen', tmdbId: 27205, createdAt: 1000, publication: publishedAt('1') }),
			makeRecord({ imageId: 'dune', tmdbId: 438631, createdAt: 1000, publication: publishedAt('2') }),
		]

		const viewings = getMovieViewings(records)

		expect(viewings.get('origen')?.ordinal).toBe(1)
		expect(viewings.get('dune')?.ordinal).toBe(1)
	})

	/** A pending card shows the number it will keep, without claiming it for the collection. */
	it('gives a pending card its number without letting it advance the count', () => {
		const records = [
			makeRecord({ imageId: 'publicada', tmdbId: 27205, createdAt: 1000, publication: publishedAt('1') }),
			makeRecord({ imageId: 'abandonada', tmdbId: 27205, createdAt: 2000 }),
			makeRecord({ imageId: 'siguiente', tmdbId: 27205, createdAt: 3000, publication: publishedAt('2') }),
		]

		const viewings = getMovieViewings(records)

		expect(viewings.get('abandonada')?.ordinal).toBe(2)
		// The one that made it into a message is the second viewing, not the third.
		expect(viewings.get('siguiente')?.ordinal).toBe(2)
	})

	/** The store only knows what it has recorded, so the user's own answer has to be able to win. */
	it('honours a first review the user declared a rewatch', () => {
		const viewings = getMovieViewings([makeRecord({ imageId: 'clasico', rewatch: true })])

		expect(viewings.get('clasico')).toEqual({ ordinal: 1, isRewatch: true })
	})

	it('does not mutate the input', () => {
		const records = [
			makeRecord({ imageId: 'b', createdAt: 2000 }),
			makeRecord({ imageId: 'a', createdAt: 1000 }),
		]
		getMovieViewings(records)

		expect(records.map(record => record.imageId)).toEqual(['b', 'a'])
	})

	it('has nothing to say about an empty collection', () => {
		expect(getMovieViewings([]).size).toBe(0)
	})
})

describe('countUniqueMovies', () => {
	it('counts films, not reviews', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 27205 }),
			makeRecord({ imageId: 'b', tmdbId: 27205 }),
			makeRecord({ imageId: 'c', tmdbId: 438631 }),
		]

		expect(countUniqueMovies(records)).toBe(2)
	})

	it('counts nothing in an empty collection', () => {
		expect(countUniqueMovies([])).toBe(0)
	})
})

describe('getDistinctPosterUrls', () => {
	it('gives a repeated film one slot on the wall, not three', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 27205, rating: 10, posterUrl: 'origen.jpg' }),
			makeRecord({ imageId: 'b', tmdbId: 27205, rating: 9, posterUrl: 'origen.jpg' }),
			makeRecord({ imageId: 'c', tmdbId: 438631, rating: 8, posterUrl: 'dune.jpg' }),
		]

		expect(getDistinctPosterUrls(records, 14)).toEqual(['origen.jpg', 'dune.jpg'])
	})

	it('takes the best rated first and stops at the limit', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 1, rating: 6, posterUrl: 'floja.jpg' }),
			makeRecord({ imageId: 'b', tmdbId: 2, rating: 10, posterUrl: 'buenisima.jpg' }),
			makeRecord({ imageId: 'c', tmdbId: 3, rating: 8, posterUrl: 'buena.jpg' }),
		]

		expect(getDistinctPosterUrls(records, 2)).toEqual(['buenisima.jpg', 'buena.jpg'])
	})

	it('skips records with no poster', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 1, rating: 10, posterUrl: null }),
			makeRecord({ imageId: 'b', tmdbId: 2, rating: 8, posterUrl: 'dune.jpg' }),
		]

		expect(getDistinctPosterUrls(records, 14)).toEqual(['dune.jpg'])
	})
})

/**
 * Galería shows films, Diario shows reviews. Without this grouping, a film watched three times
 * took three slots of the wall with the same poster in each.
 */
describe('groupMovieReviews', () => {
	it('gives a film one entry however many times it was reviewed', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 27205 }),
			makeRecord({ imageId: 'b', tmdbId: 27205 }),
			makeRecord({ imageId: 'c', tmdbId: 438631 }),
		]

		const entries = groupMovieReviews(records)

		expect(entries).toHaveLength(2)
		expect(entries[0].reviews.map(review => review.imageId)).toEqual(['a', 'b'])
		expect(entries[1].reviews.map(review => review.imageId)).toEqual(['c'])
	})

	/** So the card always agrees with the sort in force, whatever the caller ordered by. */
	it('takes the first review in the given order as the one that stands for the film', () => {
		const records = [
			makeRecord({ imageId: 'mejor', tmdbId: 27205, rating: 10 }),
			makeRecord({ imageId: 'peor', tmdbId: 27205, rating: 7 }),
		]

		expect(groupMovieReviews(records)[0].record.imageId).toBe('mejor')
		expect(groupMovieReviews([...records].reverse())[0].record.imageId).toBe('peor')
	})

	it('keeps the films in the order they first appear', () => {
		const records = [
			makeRecord({ imageId: 'a', tmdbId: 3 }),
			makeRecord({ imageId: 'b', tmdbId: 1 }),
			makeRecord({ imageId: 'c', tmdbId: 3 }),
			makeRecord({ imageId: 'd', tmdbId: 2 }),
		]

		expect(groupMovieReviews(records).map(entry => entry.record.tmdbId)).toEqual([3, 1, 2])
	})

	it('has nothing to group in an empty collection', () => {
		expect(groupMovieReviews([])).toEqual([])
	})
})
