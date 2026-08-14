/**
 * Pure presentation helpers for the Cine dashboard section. Kept out of the view so the
 * split, the derived figures, and the ordering can be tested without rendering React.
 */
import type { MovieReviewBadge } from './movie-review'
import type { MovieReviewRecord } from './movie-review-store'

export type MovieReviewSort = 'recent' | 'oldest' | 'rating' | 'title'

export interface MovieReviewStats {
	count: number
	averageRating: number | null
	best: MovieReviewRecord | null
}

export interface MovieReviewFilters {
	year: string
	badge: MovieReviewBadge | 'all'
}

/** Published state is derived, never stored. */
export function splitByPublication(records: MovieReviewRecord[]): {
	published: MovieReviewRecord[]
	pending: MovieReviewRecord[]
} {
	return {
		published: records.filter(record => record.publication !== null),
		pending: records.filter(record => record.publication === null),
	}
}

export function getMovieReviewStats(records: MovieReviewRecord[]): MovieReviewStats {
	if (records.length === 0) return { count: 0, averageRating: null, best: null }

	const total = records.reduce((sum, record) => sum + record.rating, 0)
	// Ties keep the first record, which under the default ordering is the most recent.
	const best = records.reduce((top, record) => (record.rating > top.rating ? record : top), records[0])

	return {
		count: records.length,
		averageRating: Math.round((total / records.length) * 10) / 10,
		best,
	}
}

export function sortMovieReviews(records: MovieReviewRecord[], sort: MovieReviewSort): MovieReviewRecord[] {
	const sorted = [...records]

	switch (sort) {
		case 'oldest':
			return sorted.sort((a, b) => a.createdAt - b.createdAt)
		case 'rating':
			return sorted.sort((a, b) => b.rating - a.rating)
		case 'title':
			return sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'))
		case 'recent':
		default:
			return sorted.sort((a, b) => b.createdAt - a.createdAt)
	}
}

export function filterMovieReviews(records: MovieReviewRecord[], filters: MovieReviewFilters): MovieReviewRecord[] {
	return records.filter(record => {
		if (filters.year !== 'all' && record.year !== filters.year) return false
		if (filters.badge !== 'all' && record.badge !== filters.badge) return false
		return true
	})
}

/** Distinct years present in the collection, newest first, for the year filter. */
export function getAvailableYears(records: MovieReviewRecord[]): string[] {
	const years = new Set(records.map(record => record.year).filter(Boolean))
	return Array.from(years).sort((a, b) => b.localeCompare(a))
}
