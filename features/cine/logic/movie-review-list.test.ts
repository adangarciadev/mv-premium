import { describe, expect, it } from 'vitest'
import {
	countSharingPost,
	filterMovieReviews,
	getAvailableYears,
	getMovieReviewStats,
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
		expect(getMovieReviewStats([])).toEqual({ count: 0, averageRating: null, best: null })
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

describe('countSharingPost', () => {
	it('counts the other reviews published in the same message', () => {
		const target = makeRecord({ imageId: 'aaaaaaaaa', publication: publishedAt('45') })
		const records = [
			target,
			makeRecord({ imageId: 'bbbbbbbbb', publication: publishedAt('45') }),
			makeRecord({ imageId: 'ccccccccc', publication: publishedAt('88') }),
		]

		expect(countSharingPost(records, target)).toBe(1)
	})

	it('does not confuse the same post number in a different thread', () => {
		const target = makeRecord({ imageId: 'aaaaaaaaa', publication: publishedAt('45') })
		const records = [
			target,
			makeRecord({
				imageId: 'bbbbbbbbb',
				publication: publishedAt('45', 'https://www.mediavida.com/foro/cine/otro-hilo-2'),
			}),
		]

		expect(countSharingPost(records, target)).toBe(0)
	})

	it('counts nothing for an unpublished record', () => {
		const target = makeRecord({ imageId: 'aaaaaaaaa' })

		expect(countSharingPost([target, makeRecord({ imageId: 'bbbbbbbbb' })], target)).toBe(0)
	})
})
