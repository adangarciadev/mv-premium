/**
 * Unified Media Resolver
 * Resolves TMDB and IMDb URLs to normalized media data
 *
 * ARCHITECTURE: This is a pure RPC facade. All network requests
 * go through the background script via sendMessage().
 */
import { sendMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import { getMovieDetails, getMovieCredits, getPersonDetails, getPosterUrl } from '@/services/api/tmdb'
import { cachedFetch, createCacheKey, CACHE_TTL } from './cache'

// Unified output interface
export interface MediaData {
	type: 'movie' | 'tv' | 'person'
	id: number
	title: string
	image: string | null
	subtitle: string
	rating?: number
	overview?: string
	director?: string
	genres?: string[]
	runtime?: number
	seasons?: number
	birthday?: string
	imdbId?: string | null
}

// TMDB Find result types
interface TMDBFindResult {
	movie_results: Array<{
		id: number
		title: string
		poster_path: string | null
		release_date: string
		vote_average: number
		overview: string
	}>
	tv_results: Array<{
		id: number
		name: string
		poster_path: string | null
		first_air_date: string
		vote_average: number
		overview: string
	}>
	person_results: Array<{
		id: number
		name: string
		profile_path: string | null
		known_for_department: string
	}>
}

// URL parsing result
interface ParsedUrl {
	source: 'tmdb' | 'imdb'
	type: 'movie' | 'tv' | 'person'
	id: string // String because IMDb uses tt/nm IDs
}

// TV Show details type
interface TMDBTvDetails {
	id: number
	name: string
	poster_path: string | null
	first_air_date: string
	vote_average: number
	overview: string
	number_of_seasons: number
	genres?: Array<{ id: number; name: string }>
}

// External IDs type
interface TMDBExternalIds {
	imdb_id: string | null
}

const CACHE_PREFIX = 'mv-resolver'

/**
 * Parse a cinema-related URL
 */
export function parseUrl(url: string): ParsedUrl | null {
	// TMDB Movie: themoviedb.org/movie/{id}
	const tmdbMovieMatch = url.match(/themoviedb\.org\/movie\/(\d+)/)
	if (tmdbMovieMatch) {
		return { source: 'tmdb', type: 'movie', id: tmdbMovieMatch[1] }
	}

	// TMDB Person: themoviedb.org/person/{id}
	const tmdbPersonMatch = url.match(/themoviedb\.org\/person\/(\d+)/)
	if (tmdbPersonMatch) {
		return { source: 'tmdb', type: 'person', id: tmdbPersonMatch[1] }
	}

	// TMDB TV: themoviedb.org/tv/{id}
	const tmdbTvMatch = url.match(/themoviedb\.org\/tv\/(\d+)/)
	if (tmdbTvMatch) {
		return { source: 'tmdb', type: 'tv', id: tmdbTvMatch[1] }
	}

	// IMDb Title: imdb.com/title/{tt_id} or imdb.com/es-es/title/{tt_id}
	const imdbTitleMatch = url.match(/imdb\.com\/(?:[a-z]{2}-[a-z]{2}\/)?title\/(tt\d+)/)
	if (imdbTitleMatch) {
		return { source: 'imdb', type: 'movie', id: imdbTitleMatch[1] }
	}

	// IMDb Person: imdb.com/name/{nm_id} or imdb.com/es-es/name/{nm_id}
	const imdbPersonMatch = url.match(/imdb\.com\/(?:[a-z]{2}-[a-z]{2}\/)?name\/(nm\d+)/)
	if (imdbPersonMatch) {
		return { source: 'imdb', type: 'person', id: imdbPersonMatch[1] }
	}

	return null
}

// =============================================================================
// Internal TMDB Fetch via Background Script
// =============================================================================

/**
 * Fetch data from TMDB via background script
 * All network requests are delegated to avoid CORS and secure API keys
 */
async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
	try {
		const result = await sendMessage('tmdbRequest', { endpoint, params })
		return result as T
	} catch (error) {
		logger.error('Error fetching from TMDB:', error)
		return null
	}
}

/**
 * Translate department to Spanish role
 */
function translateDepartment(department: string | null | undefined): string {
	if (!department) return 'Cine'

	const translations: Record<string, string> = {
		Acting: 'Actor/Actriz',
		Directing: 'Director/a',
		Writing: 'Guionista',
		Production: 'Productor/a',
		Camera: 'Director/a de Fotografía',
		Editing: 'Editor/a',
		Sound: 'Sonido',
		Art: 'Dirección Artística',
		'Costume & Make-Up': 'Vestuario y Maquillaje',
		Crew: 'Equipo Técnico',
		'Visual Effects': 'Efectos Visuales',
		Lighting: 'Iluminación',
	}

	return translations[department] || department
}

/**
 * Find content by external ID (IMDb)
 */
async function findByExternalId(externalId: string): Promise<TMDBFindResult | null> {
	return fetchTMDB<TMDBFindResult>(`/find/${externalId}`, { external_source: 'imdb_id' })
}

/**
 * Resolve TMDB movie to MediaData
 */
async function resolveTMDBMovie(id: number): Promise<MediaData | null> {
	try {
		const [details, credits, externalIds] = await Promise.all([
			getMovieDetails(id),
			getMovieCredits(id),
			fetchTMDB<TMDBExternalIds>(`/movie/${id}/external_ids`),
		])

		if (!details) return null

		const director = credits?.crew.find(c => c.job === 'Director')?.name

		return {
			type: 'movie',
			id: details.id,
			title: details.title,
			image: getPosterUrl(details.poster_path, 'w342'),
			subtitle: details.release_date?.split('-')[0] || '',
			rating: details.vote_average,
			overview: details.overview,
			director,
			genres: details.genres?.map(g => g.name),
			runtime: details.runtime,
			imdbId: externalIds?.imdb_id,
		}
	} catch (error) {
		logger.error('Error resolving TMDB movie:', error)
		return null
	}
}

/**
 * Resolve TMDB person to MediaData
 */
async function resolveTMDBPerson(id: number): Promise<MediaData | null> {
	try {
		const [details, externalIds] = await Promise.all([
			getPersonDetails(id),
			fetchTMDB<TMDBExternalIds>(`/person/${id}/external_ids`),
		])

		if (!details) return null

		return {
			type: 'person',
			id: details.id,
			title: details.name,
			image: getPosterUrl(details.profile_path, 'w342'),
			subtitle: translateDepartment(details.known_for_department),
			overview: details.biography,
			birthday: details.birthday || undefined,
			imdbId: externalIds?.imdb_id,
		}
	} catch (error) {
		logger.error('Error resolving TMDB person:', error)
		return null
	}
}

/**
 * Resolve TMDB TV show to MediaData
 */
async function resolveTMDBTv(id: number): Promise<MediaData | null> {
	try {
		const details = await fetchTMDB<TMDBTvDetails>(`/tv/${id}`)
		if (!details) return null

		return {
			type: 'tv',
			id: details.id,
			title: details.name,
			image: getPosterUrl(details.poster_path, 'w342'),
			subtitle: details.first_air_date?.split('-')[0] || '',
			rating: details.vote_average,
			overview: details.overview,
			seasons: details.number_of_seasons,
			genres: details.genres?.map(g => g.name),
		}
	} catch (error) {
		logger.error('Error resolving TMDB TV:', error)
		return null
	}
}

/**
 * Resolve IMDb title to MediaData
 */
async function resolveIMDbTitle(imdbId: string): Promise<MediaData | null> {
	const findResult = await findByExternalId(imdbId)
	if (!findResult) return null

	// Check movie results first
	if (findResult.movie_results.length > 0) {
		const movie = findResult.movie_results[0]
		return resolveTMDBMovie(movie.id)
	}

	// Then TV results
	if (findResult.tv_results.length > 0) {
		const tv = findResult.tv_results[0]
		return resolveTMDBTv(tv.id)
	}

	return null
}

/**
 * Resolve IMDb person to MediaData
 */
async function resolveIMDbPerson(nmId: string): Promise<MediaData | null> {
	const findResult = await findByExternalId(nmId)
	if (!findResult) return null

	if (findResult.person_results.length > 0) {
		const person = findResult.person_results[0]
		return resolveTMDBPerson(person.id)
	}

	return null
}

/**
 * Main resolver function - resolves any cinema URL to MediaData
 */
export async function resolveUrl(url: string): Promise<MediaData | null> {
	const parsed = parseUrl(url)
	if (!parsed) return null

	const cacheKey = createCacheKey('resolve', parsed.source, parsed.type, parsed.id)

	return cachedFetch(
		cacheKey,
		async () => {
			if (parsed.source === 'tmdb') {
				if (parsed.type === 'movie') {
					return resolveTMDBMovie(parseInt(parsed.id, 10))
				} else if (parsed.type === 'person') {
					return resolveTMDBPerson(parseInt(parsed.id, 10))
				} else if (parsed.type === 'tv') {
					return resolveTMDBTv(parseInt(parsed.id, 10))
				}
			} else if (parsed.source === 'imdb') {
				if (parsed.type === 'movie') {
					return resolveIMDbTitle(parsed.id)
				} else if (parsed.type === 'person') {
					return resolveIMDbPerson(parsed.id)
				}
			}

			return null
		},
		{ prefix: CACHE_PREFIX, ttl: CACHE_TTL.MEDIUM, persist: false }
	)
}

/**
 * Check if a URL is a supported cinema link
 */
export function isSupportedUrl(url: string): boolean {
	return parseUrl(url) !== null
}
