/**
 * TMDB API Service
 *
 * ARCHITECTURE: This is a pure RPC facade. All network requests
 * are made via the background script to avoid CORS issues and
 * keep API keys secure.
 *
 * The TMDB API key is provided globally via .env (VITE_TMDB_KEY)
 * and is used by the background script. Users do not configure this.
 *
 * API Documentation: https://www.themoviedb.org/documentation/api
 */
import { sendMessage } from '@/lib/messaging'
import { cachedFetch, createCacheKey, CACHE_TTL } from '@/services/media'
import { renderTemplate } from '@/lib/template-engine'
import { getDefaultTemplate } from '@/features/templates'
import { useSettingsStore } from '@/store'
import { formatDateLong } from '@/lib/date-utils'
import type { MediaTemplate } from '@/types/templates'

// Re-export types for consumers
export type {
	TMDBMovie,
	TMDBMovieDetails,
	TMDBCredits,
	TMDBVideos,
	TMDBReleaseDates,
	TMDBSearchResult,
	TMDBPerson,
	TMDBPersonDetails,
	TMDBTVShow,
	TMDBTVShowDetails,
	TMDBSeasonDetails,
} from '../../types'

import { API_URLS } from '@/constants'
import type {
	TMDBMovie,
	TMDBMovieDetails,
	TMDBCredits,
	TMDBVideos,
	TMDBReleaseDates,
	TMDBSearchResult,
	TMDBPerson,
	TMDBPersonDetails,
	TMDBTVShow,
	TMDBTVShowDetails,
	TMDBSeasonDetails,
} from '../../types'

// =============================================================================
// Constants
// =============================================================================

const TMDB_IMAGE_BASE = API_URLS.TMDB_IMAGE
const CACHE_PREFIX = 'mv-tmdb-v2'
const SPAIN_REGION = 'ES'
const THEATRICAL_RELEASE_TYPES = '2|3'
const MAX_DISCOVER_PAGES_FOR_RELEASES = 5
const MIN_FEATURE_RUNTIME_MINUTES = 60
const MIN_METADATA_SCORE = 3
const MIN_POPULARITY_FOR_WEAK_METADATA = 3
const RERELEASE_YEAR_GAP = 3

export interface UpcomingSpanishMovieRelease {
	id: number
	title: string
	originalTitle: string
	overview: string
	posterUrl: string | null
	backdropUrl: string | null
	releaseDate: string
	releaseTimestamp: number
	voteAverage: number
	popularity: number
	voteCount: number
	genreIds: number[]
	genres: string[]
	director: string | null
	runtime: number | null
	releaseNote: string | null
	isRerelease: boolean
	source: 'tmdb'
	tmdbUrl: string
}

export interface UpcomingSpanishMovieReleaseOptions {
	from: Date
	to: Date
	limit?: number
}

export interface MovieThreadPrefillData {
	title: string
	body: string
}

interface SpanishTheatricalRelease {
	dateKey: string
	type: number
	note: string | null
}

interface TMDBMovieDetailsWithCredits extends TMDBMovieDetails {
	credits?: TMDBCredits
}

// =============================================================================
// Image URL Helpers (no API call needed)
// =============================================================================

export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original'

export function getPosterUrl(path: string | null, size: PosterSize = 'w500'): string | null {
	if (!path) return null
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function getBackdropUrl(path: string | null, size: BackdropSize = 'w780'): string | null {
	if (!path) return null
	return `${TMDB_IMAGE_BASE}/${size}${path}`
}

// =============================================================================
// Internal Fetch via Background Script
// =============================================================================

/**
 * Fetch from TMDB via background script
 * This avoids CORS and keeps API key secure
 */
async function fetchTMDBViaBackground<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
	const result = await sendMessage('tmdbRequest', { endpoint, params })
	return result as T
}

export async function hasTmdbApiKey(): Promise<boolean> {
	return sendMessage('hasTmdbApiKey')
}

/**
 * Cached fetch wrapper
 */
/**
 * Cached fetch wrapper
 */
interface TMDBFetchOptions {
	ttl?: number
	persist?: boolean
}

async function fetchTMDB<T>(
	endpoint: string,
	params: Record<string, string> = {},
	options: number | TMDBFetchOptions = CACHE_TTL.MEDIUM
): Promise<T> {
	const ttl = typeof options === 'number' ? options : options.ttl ?? CACHE_TTL.MEDIUM
	// Never persist TMDB data to storage - use memory-only cache
	const persist = typeof options === 'number' ? false : options.persist ?? false

	const cacheKey = createCacheKey(endpoint, JSON.stringify(params))
	return cachedFetch(cacheKey, () => fetchTMDBViaBackground<T>(endpoint, params), {
		prefix: CACHE_PREFIX,
		ttl,
		persist,
	})
}

// =============================================================================
// API Functions
// =============================================================================

export async function searchMovies(query: string, page = 1): Promise<TMDBSearchResult<TMDBMovie>> {
	const cacheKey = createCacheKey('search', query, page)
	return cachedFetch(
		cacheKey,
		() =>
			fetchTMDBViaBackground<TMDBSearchResult<TMDBMovie>>('/search/movie', {
				query,
				page: String(page),
				language: 'es-ES',
				region: SPAIN_REGION,
			}),
		{ prefix: CACHE_PREFIX, ttl: CACHE_TTL.SHORT, persist: false }
	)
}

export async function searchPeople(query: string, page = 1): Promise<TMDBSearchResult<TMDBPerson>> {
	const cacheKey = createCacheKey('search-person', query, page)
	return cachedFetch(
		cacheKey,
		() => fetchTMDBViaBackground<TMDBSearchResult<TMDBPerson>>('/search/person', { query, page: String(page) }),
		{ prefix: CACHE_PREFIX, ttl: CACHE_TTL.SHORT, persist: false }
	)
}

export async function getUpcomingMovies(page = 1): Promise<TMDBSearchResult<TMDBMovie>> {
	return fetchTMDB<TMDBSearchResult<TMDBMovie>>('/movie/upcoming', { page: String(page), region: 'ES' })
}

export async function getNowPlayingMovies(page = 1): Promise<TMDBSearchResult<TMDBMovie>> {
	return fetchTMDB<TMDBSearchResult<TMDBMovie>>('/movie/now_playing', { page: String(page), region: 'ES' })
}

export async function discoverMovies(params: Record<string, string>): Promise<TMDBSearchResult<TMDBMovie>> {
	const queryString = new URLSearchParams(params).toString()
	const cacheKey = createCacheKey('discover', queryString)

	return cachedFetch(cacheKey, () => fetchTMDBViaBackground<TMDBSearchResult<TMDBMovie>>('/discover/movie', params), {
		prefix: CACHE_PREFIX,
		ttl: CACHE_TTL.SHORT,
		persist: false,
	})
}

export interface TMDBGenre {
	id: number
	name: string
}

export async function getGenres(): Promise<TMDBGenre[]> {
	const data = await fetchTMDB<{ genres: TMDBGenre[] }>('/genre/movie/list', { language: 'es' }, CACHE_TTL.LONG)
	return data.genres
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
	// Hover data should be ephemeral (memory only) to avoid storage bloat
	return fetchTMDB<TMDBMovieDetails>(`/movie/${movieId}`, {}, { persist: false })
}

export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails> {
	// Hover data should be ephemeral (memory only)
	return fetchTMDB<TMDBPersonDetails>(`/person/${personId}`, {}, { persist: false })
}

export async function getMovieCredits(movieId: number): Promise<TMDBCredits> {
	return fetchTMDB<TMDBCredits>(`/movie/${movieId}/credits`, {}, { persist: false })
}

export async function getMovieVideos(movieId: number): Promise<TMDBVideos> {
	return fetchTMDB<TMDBVideos>(`/movie/${movieId}/videos`, {}, { persist: false })
}

export async function getMovieReleaseDates(movieId: number): Promise<TMDBReleaseDates> {
	return fetchTMDB<TMDBReleaseDates>(`/movie/${movieId}/release_dates`, {}, { persist: false })
}

function toDateKey(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function normalizeReleaseDate(value: string | null | undefined): string | null {
	if (!value) return null
	const match = value.match(/^\d{4}-\d{2}-\d{2}/)
	return match?.[0] ?? null
}

function dateKeyToTimestamp(dateKey: string): number {
	return new Date(`${dateKey}T00:00:00`).getTime()
}

function getSpanishTheatricalRelease(
	releaseDates: TMDBReleaseDates,
	fromKey: string,
	toKey: string
): SpanishTheatricalRelease | null {
	const spainRelease = releaseDates.results.find(result => result.iso_3166_1 === SPAIN_REGION)
	if (!spainRelease) return null

	const getReleaseInRange = (type: number) =>
		spainRelease.release_dates
			.map(release => ({ ...release, dateKey: normalizeReleaseDate(release.release_date) }))
			.filter(
				(release): release is typeof release & { dateKey: string } =>
					release.type === type && release.dateKey !== null && isDateInRange(release.dateKey, fromKey, toKey)
			)
			.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
			.map(release => ({ dateKey: release.dateKey, type: release.type, note: release.note ?? null }))[0] ?? null

	return getReleaseInRange(3) ?? getReleaseInRange(2)
}

function isDateInRange(dateKey: string, fromKey: string, toKey: string): boolean {
	return dateKey >= fromKey && dateKey <= toKey
}

function getYearFromDateKey(dateKey: string | null): number | null {
	if (!dateKey) return null
	const year = Number.parseInt(dateKey.slice(0, 4), 10)
	return Number.isFinite(year) ? year : null
}

function isRereleaseNote(note: string | null): boolean {
	if (!note) return false
	return /re-?release|reestreno|anniversary|aniversario|remaster|restaurad|restored|4k/i.test(note)
}

function isLikelyRerelease(movie: TMDBMovie, release: SpanishTheatricalRelease): boolean {
	if (isRereleaseNote(release.note)) return true

	const originalYear = getYearFromDateKey(normalizeReleaseDate(movie.release_date))
	const spanishReleaseYear = getYearFromDateKey(release.dateKey)
	if (originalYear === null || spanishReleaseYear === null) return false

	return spanishReleaseYear - originalYear >= RERELEASE_YEAR_GAP
}

function getDirectorFromCredits(credits: TMDBCredits | undefined): string | null {
	return credits?.crew.find(c => c.job === 'Director')?.name ?? null
}

async function getMovieReleaseDetails(movieId: number): Promise<TMDBMovieDetailsWithCredits> {
	return fetchTMDB<TMDBMovieDetailsWithCredits>(
		`/movie/${movieId}`,
		{ append_to_response: 'credits', language: 'es-ES' },
		{ ttl: CACHE_TTL.LONG, persist: false }
	)
}

async function enrichMovieRelease(release: UpcomingSpanishMovieRelease): Promise<UpcomingSpanishMovieRelease> {
	const details = await getMovieReleaseDetails(release.id)

	return {
		...release,
		title: details.title ?? release.title,
		originalTitle: details.original_title ?? release.originalTitle,
		overview: details.overview ?? release.overview,
		posterUrl: details.poster_path ? getPosterUrl(details.poster_path, 'w342') : release.posterUrl,
		backdropUrl: details.backdrop_path ? getBackdropUrl(details.backdrop_path, 'w780') : release.backdropUrl,
		voteAverage: details.vote_average ?? release.voteAverage,
		genreIds: details.genre_ids ?? release.genreIds,
		genres: details.genres?.map(genre => GENRE_TRANSLATIONS[genre.name] || genre.name) ?? release.genres,
		director: getDirectorFromCredits(details.credits) ?? release.director,
		runtime: typeof details.runtime === 'number' && details.runtime > 0 ? details.runtime : release.runtime,
	}
}

function mapMovieRelease(movie: TMDBMovie, release: SpanishTheatricalRelease): UpcomingSpanishMovieRelease {
	return {
		id: movie.id,
		title: movie.title,
		originalTitle: movie.original_title,
		overview: movie.overview,
		posterUrl: getPosterUrl(movie.poster_path, 'w342'),
		backdropUrl: getBackdropUrl(movie.backdrop_path, 'w780'),
		releaseDate: release.dateKey,
		releaseTimestamp: dateKeyToTimestamp(release.dateKey),
		voteAverage: movie.vote_average,
		popularity: movie.popularity ?? 0,
		voteCount: movie.vote_count ?? 0,
		genreIds: movie.genre_ids,
		genres: [],
		director: null,
		runtime: null,
		releaseNote: release.note,
		isRerelease: isLikelyRerelease(movie, release),
		source: 'tmdb',
		tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
	}
}

function mergeMovieReleases(releases: UpcomingSpanishMovieRelease[]): UpcomingSpanishMovieRelease[] {
	const byMovieAndDate = new Map<string, UpcomingSpanishMovieRelease>()

	for (const release of releases) {
		const key = `${release.id}:${release.releaseDate}`
		const existing = byMovieAndDate.get(key)
		if (!existing) {
			byMovieAndDate.set(key, release)
			continue
		}

		byMovieAndDate.set(key, {
			...existing,
			...release,
			releaseNote: existing.releaseNote ?? release.releaseNote,
			isRerelease: existing.isRerelease || release.isRerelease,
			source: existing.source === 'tmdb' ? existing.source : release.source,
		})
	}

	return [...byMovieAndDate.values()]
}

function isDisplayableMovieRelease(release: UpcomingSpanishMovieRelease): boolean {
	if (release.runtime !== null && release.runtime < MIN_FEATURE_RUNTIME_MINUTES) return false

	const metadataScore = [
		release.posterUrl !== null,
		release.overview.trim().length >= 80,
		release.director !== null,
		release.runtime !== null,
		release.genreIds.length > 0 || release.genres.length > 0,
		release.voteCount > 0 || release.popularity >= MIN_POPULARITY_FOR_WEAK_METADATA,
	].filter(Boolean).length

	return metadataScore >= MIN_METADATA_SCORE
}

export async function getUpcomingSpanishMovieReleases({
	from,
	to,
	limit = 18,
}: UpcomingSpanishMovieReleaseOptions): Promise<UpcomingSpanishMovieRelease[]> {
	const fromKey = toDateKey(from)
	const toKey = toDateKey(to)
	const baseParams = {
		include_adult: 'false',
		language: 'es-ES',
		region: SPAIN_REGION,
		'release_date.gte': fromKey,
		'release_date.lte': toKey,
		sort_by: 'primary_release_date.asc',
		with_release_type: THEATRICAL_RELEASE_TYPES,
	}

	const firstPage = await discoverMovies({ ...baseParams, page: '1' })
	const totalPages = Math.min(firstPage.total_pages, MAX_DISCOVER_PAGES_FOR_RELEASES)
	const remainingPages =
		totalPages > 1
			? await Promise.all(
					Array.from({ length: totalPages - 1 }, (_, index) =>
						discoverMovies({ ...baseParams, page: String(index + 2) })
					)
				)
			: []

	const moviesById = new Map<number, TMDBMovie>()
	for (const movie of [firstPage, ...remainingPages].flatMap(page => page.results)) {
		if (!moviesById.has(movie.id)) {
			moviesById.set(movie.id, movie)
		}
	}

	const tmdbReleases = await Promise.all(
		[...moviesById.values()].map(async movie => {
			const releaseDates = await getMovieReleaseDates(movie.id)
			const spanishRelease = getSpanishTheatricalRelease(releaseDates, fromKey, toKey)

			if (!spanishRelease || !isDateInRange(spanishRelease.dateKey, fromKey, toKey)) {
				return null
			}

			return mapMovieRelease(movie, spanishRelease)
		})
	)

	const mappedTmdbReleases = tmdbReleases.filter(
		(release): release is UpcomingSpanishMovieRelease => release !== null
	)
	const selectedReleases = mergeMovieReleases(mappedTmdbReleases)
		.filter((release): release is UpcomingSpanishMovieRelease => release !== null)
		.sort(
			(a, b) =>
				a.releaseTimestamp - b.releaseTimestamp ||
				b.voteAverage - a.voteAverage ||
				a.title.localeCompare(b.title, 'es')
		)

	const enrichedReleases = await Promise.all(selectedReleases.map(enrichMovieRelease))
	return enrichedReleases.filter(isDisplayableMovieRelease).slice(0, limit)
}

// External IDs response type
export interface TMDBExternalIds {
	id: number
	imdb_id: string | null
	wikidata_id: string | null
	facebook_id: string | null
	instagram_id: string | null
	twitter_id: string | null
}

export async function getMovieExternalIds(movieId: number): Promise<TMDBExternalIds> {
	return fetchTMDB<TMDBExternalIds>(`/movie/${movieId}/external_ids`, {}, { persist: false })
}

export async function getPersonExternalIds(personId: number): Promise<TMDBExternalIds> {
	return fetchTMDB<TMDBExternalIds>(`/person/${personId}/external_ids`, {}, { persist: false })
}

// =============================================================================
// Template Data
// =============================================================================

export interface MovieTemplateData {
	title: string
	originalTitle: string
	year: string
	director: string
	screenplay: string[]
	cast: string[]
	genres: string[]
	runtime: number
	overview: string
	posterUrl: string | null
	trailerUrl: string | null
	releaseDate: string | null
	voteAverage: number
}

export async function getMovieTemplateData(movieId: number): Promise<MovieTemplateData> {
	const [details, credits, videos, releaseDates] = await Promise.all([
		getMovieDetails(movieId),
		getMovieCredits(movieId),
		getMovieVideos(movieId),
		getMovieReleaseDates(movieId),
	])

	const director = credits.crew.find(c => c.job === 'Director')?.name || 'Desconocido'

	// Prioritize "Screenplay", "Writer", "Scenario" jobs
	let writers = credits.crew.filter(c => ['Screenplay', 'Writer', 'Scenario'].includes(c.job)).map(c => c.name)

	// Fallback to Writing department if empty
	if (writers.length === 0) {
		writers = credits.crew.filter(c => c.department === 'Writing').map(c => c.name)
	}

	const screenplay = writers.filter((name, i, arr) => arr.indexOf(name) === i).slice(0, 5)

	const cast = credits.cast
		.sort((a, b) => a.order - b.order)
		.slice(0, 5)
		.map(c => c.name)

	const trailer = videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))

	const spainRelease = releaseDates.results.find(r => r.iso_3166_1 === 'ES')
	const spainReleaseDate =
		spainRelease?.release_dates.find(rd => rd.type === 3)?.release_date || spainRelease?.release_dates[0]?.release_date

	return {
		title: details.title,
		originalTitle: details.original_title,
		year: details.release_date?.split('-')[0] || '',
		director,
		screenplay,
		cast,
		genres: details.genres.map(g => GENRE_TRANSLATIONS[g.name] || g.name),
		runtime: details.runtime,
		overview: details.overview,
		posterUrl: getPosterUrl(details.poster_path, 'w500'),
		trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
		releaseDate: formatDateLong(spainReleaseDate || details.release_date),
		voteAverage: details.vote_average,
	}
}

/**
 * Get the active template for a given type.
 * Returns the user's custom template if set, otherwise the default.
 */
function getActiveTemplate(type: 'movie' | 'tvshow' | 'season'): MediaTemplate {
	const { mediaTemplates } = useSettingsStore.getState()
	const customTemplate = mediaTemplates[type]
	return customTemplate || getDefaultTemplate(type)
}

export function generateTemplate(data: MovieTemplateData): string {
	const template = getActiveTemplate('movie')
	return renderTemplate(template, data)
}

export function buildMovieThreadTitle(data: Pick<MovieTemplateData, 'title' | 'director' | 'year'>): string {
	const director = data.director.trim() || 'Desconocido'
	const year = data.year.trim() || 's/f'
	return `'${data.title}', de ${director} (${year})`
}

export async function getMovieThreadPrefillData(movieId: number): Promise<MovieThreadPrefillData> {
	const data = await getMovieTemplateData(movieId)
	return {
		title: buildMovieThreadTitle(data),
		body: generateTemplate(data),
	}
}

// =============================================================================
// TV Series API Functions
// =============================================================================

export async function searchTVShows(query: string, page = 1): Promise<TMDBSearchResult<TMDBTVShow>> {
	const cacheKey = createCacheKey('search-tv', query, page)
	return cachedFetch(
		cacheKey,
		() => fetchTMDBViaBackground<TMDBSearchResult<TMDBTVShow>>('/search/tv', { query, page: String(page) }),
		{ prefix: CACHE_PREFIX, ttl: CACHE_TTL.SHORT, persist: false }
	)
}

export async function getTVShowDetails(tvId: number): Promise<TMDBTVShowDetails> {
	return fetchTMDB<TMDBTVShowDetails>(`/tv/${tvId}`, {}, { persist: false })
}

export async function getTVShowCredits(tvId: number): Promise<TMDBCredits> {
	return fetchTMDB<TMDBCredits>(`/tv/${tvId}/credits`, {}, { persist: false })
}

export async function getTVShowVideos(tvId: number): Promise<TMDBVideos> {
	return fetchTMDB<TMDBVideos>(`/tv/${tvId}/videos`, {}, { persist: false })
}

export async function getTVShowExternalIds(tvId: number): Promise<TMDBExternalIds> {
	return fetchTMDB<TMDBExternalIds>(`/tv/${tvId}/external_ids`, {}, { persist: false })
}

export async function getSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBSeasonDetails> {
	return fetchTMDB<TMDBSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`, {}, { persist: false })
}

export async function getSeasonVideos(tvId: number, seasonNumber: number): Promise<TMDBVideos> {
	return fetchTMDB<TMDBVideos>(`/tv/${tvId}/season/${seasonNumber}/videos`)
}

// =============================================================================
// TV Series Template Data
// =============================================================================

export interface TVShowTemplateData {
	title: string
	originalTitle: string
	year: string
	creators: string[]
	cast: string[]
	genres: string[]
	episodeRunTime: number
	numberOfSeasons: number
	numberOfEpisodes: number
	status: string
	type: string
	networks: { name: string; logoUrl: string | null }[]
	overview: string
	posterUrl: string | null
	trailerUrl: string | null
	firstAirDate: string | null
	lastAirDate: string | null
	voteAverage: number
	seasons: {
		number: number
		name: string
		episodeCount: number
		airDate: string | null
	}[]
}

const TV_STATUS_LABELS: Record<string, string> = {
	'Returning Series': 'En emisión',
	Ended: 'Finalizada',
	Canceled: 'Cancelada',
	'In Production': 'En producción',
	Planned: 'Planeada',
	Pilot: 'Piloto',
}

const TV_TYPE_LABELS: Record<string, string> = {
	Scripted: 'Serie',
	Documentary: 'Documental',
	Miniseries: 'Miniserie',
	Reality: 'Reality',
	'Talk Show': 'Talk Show',
	News: 'Noticias',
	Video: 'Vídeo',
}

const GENRE_TRANSLATIONS: Record<string, string> = {
	'Action & Adventure': 'Acción y Aventura',
	Animation: 'Animación',
	Comedy: 'Comedia',
	Crime: 'Crimen',
	Documentary: 'Documental',
	Drama: 'Drama',
	Family: 'Familia',
	Kids: 'Infantil',
	Mystery: 'Misterio',
	News: 'Noticias',
	Reality: 'Reality',
	'Sci-Fi & Fantasy': 'Ciencia ficción y Fantasía',
	Soap: 'Telenovela',
	Talk: 'Talk Show',
	'War & Politics': 'Guerra y Política',
	Western: 'Western',
	'Science Fiction': 'Ciencia ficción',
	Adventure: 'Aventura',
	Action: 'Acción',
	Fantasy: 'Fantasía',
	Horror: 'Terror',
	Thriller: 'Suspense',
	Music: 'Música',
	Romance: 'Romance',
	History: 'Historia',
	War: 'Guerra',
	'TV Movie': 'Película de TV',
}

export async function getTVShowTemplateData(tvId: number): Promise<TVShowTemplateData> {
	const [details, credits, videos] = await Promise.all([
		getTVShowDetails(tvId),
		getTVShowCredits(tvId),
		getTVShowVideos(tvId),
	])

	const creators = details.created_by?.map(c => c.name) || []

	const cast = credits.cast
		.sort((a, b) => a.order - b.order)
		.slice(0, 6)
		.map(c => c.name)

	const trailer = videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))

	// Calculate average episode runtime
	const episodeRunTime =
		details.episode_run_time?.length > 0
			? Math.round(details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length)
			: 0

	// Filter out specials (season 0) and sort by season number
	const seasons =
		details.seasons
			?.filter(s => s.season_number > 0)
			.sort((a, b) => a.season_number - b.season_number)
			.map(s => ({
				number: s.season_number,
				name: s.name,
				episodeCount: s.episode_count,
				airDate: s.air_date,
			})) || []

	return {
		title: details.name,
		originalTitle: details.original_name,
		year: details.first_air_date?.split('-')[0] || '',
		creators,
		cast,
		genres: details.genres.map(g => GENRE_TRANSLATIONS[g.name] || g.name),
		episodeRunTime,
		numberOfSeasons: details.number_of_seasons,
		numberOfEpisodes: details.number_of_episodes,
		status: TV_STATUS_LABELS[details.status] || details.status,
		type: TV_TYPE_LABELS[details.type] || details.type,
		networks:
			details.networks?.map(n => ({
				name: n.name,
				logoUrl: n.logo_path ? getPosterUrl(n.logo_path, 'w154') : null,
			})) || [],
		overview: details.overview,
		posterUrl: getPosterUrl(details.poster_path, 'w500'),
		trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
		firstAirDate: formatDateLong(details.first_air_date),
		lastAirDate: formatDateLong(details.last_air_date),
		voteAverage: details.vote_average,
		seasons,
	}
}

export function generateTVTemplate(data: TVShowTemplateData): string {
	const template = getActiveTemplate('tvshow')
	return renderTemplate(template, data)
}

// =============================================================================
// Season-Specific Template Data
// =============================================================================

export interface SeasonTemplateData {
	seriesTitle: string
	seasonNumber: number
	seasonName: string
	year: string
	overview: string
	episodeCount: number
	averageRuntime: number
	posterUrl: string | null
	trailerUrl: string | null
	airDate: string | null
	voteAverage: number
	networks: { name: string; logoUrl: string | null }[]
	// Episodes with names
	episodes: { number: number; name: string; airDate: string | null }[]
	// From series for context
	seriesGenres: string[]
	seriesCreators: string[]
	seriesCast: string[]
	seriesStatus: string
}

export async function getSeasonTemplateData(
	tvId: number,
	seasonNumber: number,
	seriesData: TVShowTemplateData
): Promise<SeasonTemplateData> {
	const [seasonDetails, seasonVideos] = await Promise.all([
		getSeasonDetails(tvId, seasonNumber),
		getSeasonVideos(tvId, seasonNumber),
	])

	const trailer = seasonVideos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))

	// Calculate average episode runtime
	const runtimes = seasonDetails.episodes.map(ep => ep.runtime).filter((r): r is number => r !== null && r > 0)
	const averageRuntime =
		runtimes.length > 0 ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : seriesData.episodeRunTime

	// Use season poster if available, otherwise fall back to series poster
	const posterUrl = seasonDetails.poster_path ? getPosterUrl(seasonDetails.poster_path, 'w500') : seriesData.posterUrl

	// Map episodes with name and number
	const episodes = seasonDetails.episodes.map(ep => ({
		number: ep.episode_number,
		name: ep.name,
		airDate: formatDateLong(ep.air_date),
	}))

	return {
		seriesTitle: seriesData.title,
		seasonNumber: seasonDetails.season_number,
		seasonName: seasonDetails.name,
		year: seasonDetails.air_date?.split('-')[0] || '',
		overview: seasonDetails.overview || seriesData.overview, // Fallback to series overview
		episodeCount: seasonDetails.episodes.length,
		averageRuntime,
		posterUrl,
		trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
		airDate: formatDateLong(seasonDetails.air_date),
		voteAverage: seasonDetails.vote_average,
		networks: seriesData.networks,
		episodes,
		seriesGenres: seriesData.genres,
		seriesCreators: seriesData.creators,
		seriesCast: seriesData.cast,
		seriesStatus: seriesData.status,
	}
}

export function generateSeasonTemplate(data: SeasonTemplateData): string {
	const template = getActiveTemplate('season')
	return renderTemplate(template, data)
}
