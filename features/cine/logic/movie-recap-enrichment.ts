/**
 * Optional figures the recap borrows from TMDB.
 *
 * Runtime, director and genre are not stored with a review — only the TMDB id is — so they are
 * looked up when a recap is generated. This is best effort by design: a recap must still be
 * generatable when TMDB is unreachable, so every failure degrades to a missing line rather than
 * to an error.
 */
import { logger } from '@/lib/logger'
import { getMovieDetailsWithCredits } from '@/services/api/tmdb'
import type { MovieReviewRecord } from './movie-review-store'

export interface RecapEnrichment {
	minutes: number | null
	directors: string[]
	genres: string[]
	actors: string[]
	/** Director per TMDB id, for the films the recap names one by one. */
	directorById: Map<number, string>
}

export const EMPTY_ENRICHMENT: RecapEnrichment = {
	minutes: null,
	directors: [],
	genres: [],
	actors: [],
	directorById: new Map(),
}

/**
 * How far down the billing to count someone as "in" a film.
 *
 * Whole casts would make the most repeated actor whoever does the most bit parts. The top of
 * the billing is who the film is actually with.
 */
const BILLED_CAST_DEPTH = 3

/**
 * How many lookups run at once.
 *
 * Everything here crosses into the background service worker, and firing one request per film
 * at once buries it. Four keeps a recap of forty films responsive without stampeding.
 */
const CONCURRENCY = 4

/** Runs an async map with a ceiling on how many are in flight, preserving input order. */
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length)
	let cursor = 0

	const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
		while (cursor < items.length) {
			const index = cursor++
			results[index] = await run(items[index], index)
		}
	})

	await Promise.all(workers)
	return results
}

/**
 * Collects runtime, directors and genres for the given reviews.
 * Films that cannot be looked up are simply absent from the totals.
 *
 * A film reviewed twice is looked up once but counted twice for runtime and once for everyone
 * involved in it: rewatching Dune really is another 166 minutes of your life, but it does not make
 * Villeneuve any more of a recurring director than one viewing did.
 */
export async function collectRecapEnrichment(records: MovieReviewRecord[]): Promise<RecapEnrichment> {
	if (records.length === 0) return EMPTY_ENRICHMENT

	const viewingsByMovie = new Map<number, number>()
	for (const record of records) {
		viewingsByMovie.set(record.tmdbId, (viewingsByMovie.get(record.tmdbId) ?? 0) + 1)
	}
	const movieIds = Array.from(viewingsByMovie.keys())

	const details = await mapWithConcurrency(movieIds, CONCURRENCY, async tmdbId => {
		try {
			return await getMovieDetailsWithCredits(tmdbId)
		} catch (error) {
			logger.debug('Resumen de cine: no se pudieron obtener los detalles de', tmdbId, error)
			return null
		}
	})

	const directors: string[] = []
	const genres: string[] = []
	const actors: string[] = []
	const directorById = new Map<number, string>()
	let minutes = 0
	let hasRuntime = false

	details.forEach((detail, index) => {
		if (!detail) return
		const viewings = viewingsByMovie.get(movieIds[index]) ?? 1

		if (typeof detail.runtime === 'number' && detail.runtime > 0) {
			minutes += detail.runtime * viewings
			hasRuntime = true
		}

		const director = detail.credits?.crew?.find(member => member.job === 'Director')?.name
		if (director) {
			directors.push(director)
			directorById.set(detail.id, director)
		}

		for (const genre of detail.genres ?? []) {
			if (genre?.name) genres.push(genre.name)
		}

		for (const member of detail.credits?.cast?.slice(0, BILLED_CAST_DEPTH) ?? []) {
			if (member?.name) actors.push(member.name)
		}
	})

	return { minutes: hasRuntime ? minutes : null, directors, genres, actors, directorById }
}

/** "31 h" or "1 h 45 min", whichever reads better at that size. */
export function formatRuntime(minutes: number | null): string | null {
	if (minutes === null || minutes <= 0) return null

	const hours = Math.floor(minutes / 60)
	if (hours === 0) return `${minutes} min`
	if (hours < 10) {
		const rest = minutes % 60
		return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
	}

	return `${hours} horas`
}
