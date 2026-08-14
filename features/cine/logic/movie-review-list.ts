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
	/**
	 * How many distinct films hold that top score.
	 *
	 * Anything above one means there is no single best film, and a headline that names one is
	 * inventing a winner out of a tie — which is exactly how the dashboard ended up claiming a
	 * different favourite than the shared recap did.
	 */
	bestTies: number
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
	if (records.length === 0) return { count: 0, averageRating: null, best: null, bestTies: 0 }

	const total = records.reduce((sum, record) => sum + record.rating, 0)
	// Ties keep the first record, which under the default ordering is the most recent.
	const best = records.reduce((top, record) => (record.rating > top.rating ? record : top), records[0])
	// Counted by film, not by review: three critiques of the same ten are one favourite, not three.
	const bestTies = new Set(
		records.filter(record => record.rating === best.rating).map(record => record.tmdbId)
	).size

	return {
		count: records.length,
		averageRating: Math.round((total / records.length) * 10) / 10,
		best,
		bestTies,
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

export interface MovieViewing {
	/** Which viewing of that film this is, counting only what reached a message. */
	ordinal: number
	isRewatch: boolean
}

/**
 * Where each review sits in the sequence of viewings of its film.
 *
 * Only published reviews advance the count. A card generated and then abandoned would otherwise
 * renumber everything behind it for good — the collection would claim a third viewing while
 * showing two, and the only way back would be remembering to delete the right pending card. A
 * pending card still gets the number it would take, which is the one it will keep once it appears
 * in a message.
 *
 * Ordered by date, so the ordinal is an observed fact and never a ranking. The record's own
 * `rewatch` flag can only add: the very first review of a film may still be a rewatch if the user
 * said so, because the store knows nothing about what was watched before it existed.
 */
export function getMovieViewings(records: MovieReviewRecord[]): Map<string, MovieViewing> {
	const byMovie = new Map<number, MovieReviewRecord[]>()

	for (const record of records) {
		const group = byMovie.get(record.tmdbId)
		if (group) group.push(record)
		else byMovie.set(record.tmdbId, [record])
	}

	const viewings = new Map<string, MovieViewing>()

	for (const group of byMovie.values()) {
		let published = 0

		for (const record of [...group].sort((a, b) => a.createdAt - b.createdAt)) {
			const ordinal = published + 1
			viewings.set(record.imageId, { ordinal, isRewatch: ordinal > 1 || record.rewatch === true })
			if (record.publication !== null) published += 1
		}
	}

	return viewings
}

export interface MovieCollectionEntry {
	/** The review that stands for the film: its score, its verdict, its message. */
	record: MovieReviewRecord
	/** Every review of that film present in the list, in the order they arrived. */
	reviews: MovieReviewRecord[]
}

/**
 * One entry per film rather than one per review.
 *
 * A diary records viewings, so a film watched three times is three entries there. A collection is
 * of films, and nobody keeps the same poster three times on a shelf — repeated posters read as a
 * bug even when the data behind them is right.
 *
 * The representative is whichever review comes first in the list it is given, so it always agrees
 * with the sort in force: ordered by score, the film shows at its best; by date, at its most
 * recent. The order of the entries themselves is the order their films first appeared.
 */
export function groupMovieReviews(records: MovieReviewRecord[]): MovieCollectionEntry[] {
	const byMovie = new Map<number, MovieCollectionEntry>()

	for (const record of records) {
		const entry = byMovie.get(record.tmdbId)
		if (entry) entry.reviews.push(record)
		else byMovie.set(record.tmdbId, { record, reviews: [record] })
	}

	return Array.from(byMovie.values())
}

/** Distinct films, as opposed to reviews: three critiques of one film are one film. */
export function countUniqueMovies(records: MovieReviewRecord[]): number {
	return new Set(records.map(record => record.tmdbId)).size
}

/**
 * One poster per film, best rated first.
 *
 * A film reviewed three times used to take three slices of the hero wall, which turned a repeat
 * into a visual claim about the collection it never earned.
 */
export function getDistinctPosterUrls(records: MovieReviewRecord[], limit: number): string[] {
	const seen = new Set<number>()
	const urls: string[] = []

	for (const record of sortMovieReviews(records, 'rating')) {
		if (record.posterUrl === null || seen.has(record.tmdbId)) continue
		seen.add(record.tmdbId)
		urls.push(record.posterUrl)
		if (urls.length >= limit) break
	}

	return urls
}

/** Distinct years present in the collection, newest first, for the year filter. */
export function getAvailableYears(records: MovieReviewRecord[]): string[] {
	const years = new Set(records.map(record => record.year).filter(Boolean))
	return Array.from(years).sort((a, b) => b.localeCompare(a))
}
