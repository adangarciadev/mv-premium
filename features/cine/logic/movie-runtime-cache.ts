/**
 * How long each film lasts, looked up once and kept for good.
 *
 * A review stores the TMDB id and nothing about the film itself, so the only way to add up hours is
 * to ask TMDB — and asking for fifty films every time the dashboard opens would be absurd for a
 * number that never changes. A film's runtime is a fact about the film, not about the collection,
 * so it is cached by id and shared by everything that needs it.
 *
 * Best effort throughout: a lookup that fails is simply not cached, so the total is short until the
 * next visit rather than wrong forever, and nothing here can stop the dashboard from rendering.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { getMovieDetails } from '@/services/api/tmdb'
import { mapWithConcurrency } from './movie-recap-enrichment'
import type { MovieReviewRecord } from './movie-review-store'

/** Minutes per TMDB id. Keys are strings because that is what survives a round trip through JSON. */
export type MovieRuntimes = Record<string, number>

const MOVIE_RUNTIMES_KEY = `local:${STORAGE_KEYS.MOVIE_RUNTIMES}` as `local:${string}`

export const movieRuntimesStorage = storage.defineItem<MovieRuntimes>(MOVIE_RUNTIMES_KEY, {
	defaultValue: {},
})

/** Same ceiling as the recap: every one of these crosses into the background service worker. */
const CONCURRENCY = 4

/**
 * Returns the runtime of every film asked for, fetching only the ones not already known.
 *
 * A film TMDB reports without a runtime is cached as zero, so it is not asked for again on every
 * single load — the answer is "TMDB does not know", and that answer is stable.
 */
export async function resolveMovieRuntimes(tmdbIds: number[]): Promise<MovieRuntimes> {
	const cached = (await movieRuntimesStorage.getValue()) ?? {}
	const missing = Array.from(new Set(tmdbIds)).filter(id => !(String(id) in cached))
	if (missing.length === 0) return cached

	const minutes = await mapWithConcurrency(missing, CONCURRENCY, async tmdbId => {
		try {
			const details = await getMovieDetails(tmdbId)
			return typeof details.runtime === 'number' && details.runtime > 0 ? details.runtime : 0
		} catch (error) {
			logger.debug('Mediaffinity: no se pudo obtener la duración de', tmdbId, error)
			return null
		}
	})

	const next = { ...cached }
	missing.forEach((tmdbId, index) => {
		const value = minutes[index]
		if (value !== null) next[String(tmdbId)] = value
	})

	try {
		await movieRuntimesStorage.setValue(next)
	} catch (error) {
		logger.warn('Mediaffinity: no se pudo guardar la caché de duraciones', error)
	}

	return next
}

/**
 * Total minutes across the given reviews.
 *
 * Every review counts, repeats included: watching Origen three times really was three times the
 * cinema. This is the one figure on the dashboard that is about reviews rather than films.
 *
 * Null when nothing could be resolved, so the hero can stay quiet instead of claiming zero.
 */
export function getTotalRuntime(records: MovieReviewRecord[], runtimes: MovieRuntimes): number | null {
	let total = 0
	let known = 0

	for (const record of records) {
		const minutes = runtimes[String(record.tmdbId)]
		if (typeof minutes === 'number' && minutes > 0) {
			total += minutes
			known += 1
		}
	}

	return known === 0 ? null : total
}

export interface RuntimeDisplay {
	/** The headline figure: hours, or minutes when there is not even one hour. */
	value: string
	unit: string
}

/**
 * Split for display: one number and one unit, nothing else.
 *
 * The leftover minutes go into the number as a tenth — "145,8 horas" — rather than trailing behind
 * it as a second, smaller figure. Flooring to whole hours quietly lost up to fifty-nine minutes,
 * which at this size is a whole film unaccounted for; tacking "48 min" on the end fixed the
 * accounting but split one figure into three pieces of decreasing importance, and the last one was
 * unreadable. A decimal keeps the total honest and the headline a single thing.
 *
 * Comma, because these are Spanish decimals. No trailing zero: a round total reads "145 horas".
 */
export function splitRuntimeForDisplay(minutes: number): RuntimeDisplay {
	if (minutes < 60) {
		return { value: String(minutes), unit: minutes === 1 ? 'minuto' : 'minutos' }
	}

	const hours = Math.round((minutes / 60) * 10) / 10
	const value = (Number.isInteger(hours) ? String(hours) : hours.toFixed(1)).replace('.', ',')

	return { value, unit: hours === 1 ? 'hora' : 'horas' }
}

/** The same total spelled out, for the tooltip: «145 horas y 48 minutos». */
export function formatRuntimeExact(minutes: number): string {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60

	if (hours === 0) return `${rest} ${rest === 1 ? 'minuto' : 'minutos'}`

	const spelledHours = `${hours} ${hours === 1 ? 'hora' : 'horas'}`
	return rest === 0 ? spelledHours : `${spelledHours} y ${rest} ${rest === 1 ? 'minuto' : 'minutos'}`
}

