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
	return cachedFetch(cacheKey, () => fetchTMDBViaBackground<T>(endpoint, params), { prefix: CACHE_PREFIX, ttl, persist })
}

// =============================================================================
// API Functions
// =============================================================================

export async function searchMovies(query: string, page = 1): Promise<TMDBSearchResult<TMDBMovie>> {
	const cacheKey = createCacheKey('search', query, page)
	return cachedFetch(
		cacheKey,
		() => fetchTMDBViaBackground<TMDBSearchResult<TMDBMovie>>('/search/movie', { query, page: String(page) }),
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
		cast,
		genres: details.genres.map(g => GENRE_TRANSLATIONS[g.name] || g.name),
		runtime: details.runtime,
		overview: details.overview,
		posterUrl: getPosterUrl(details.poster_path, 'w500'),
		trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
		releaseDate: spainReleaseDate || details.release_date,
		voteAverage: details.vote_average,
	}
}

export function generateTemplate(data: MovieTemplateData): string {
	const lines: string[] = []

	if (data.posterUrl) {
		lines.push('[center]')
		lines.push(`[img]${data.posterUrl}[/img]`)
		lines.push('[/center]')
		lines.push('')
	}

	lines.push(`[b]Director:[/b] ${data.director}`)
	lines.push(`[b]Reparto:[/b] ${data.cast.join(', ')}`)
	lines.push(`[b]Duración:[/b] ${data.runtime} min`)
	const genreLabel = data.genres.length === 1 ? 'Género' : 'Géneros'
	lines.push(`[b]${genreLabel}:[/b] ${data.genres.join(', ')}`)
	lines.push('')

	lines.push('[bar]SINOPSIS[/bar]')
	lines.push('')
	lines.push(data.overview)
	lines.push('')

	if (data.trailerUrl) {
		lines.push('[bar]TRAILER[/bar]')
		lines.push('')
		lines.push(`[media]${data.trailerUrl}[/media]`)
		lines.push('')
	}

	if (data.releaseDate) {
		lines.push('[bar]ESTRENO[/bar]')
		lines.push('')
		const date = new Date(data.releaseDate)
		const formatted = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
		lines.push(`${formatted}`)
	}

	return lines.join('\n')
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
		firstAirDate: details.first_air_date,
		lastAirDate: details.last_air_date,
		voteAverage: details.vote_average,
		seasons,
	}
}

export function generateTVTemplate(data: TVShowTemplateData): string {
	const lines: string[] = []

	if (data.posterUrl) {
		lines.push('[center]')
		lines.push(`[img]${data.posterUrl}[/img]`)
		lines.push('[/center]')
		lines.push('')
	}

	// Basic info
	if (data.creators.length > 0) {
		const creatorLabel = data.creators.length === 1 ? 'Creador' : 'Creadores'
		lines.push(`[b]${creatorLabel}:[/b] ${data.creators.join(', ')}`)
	}
	lines.push(`[b]Reparto:[/b] ${data.cast.join(', ')}`)

	const genreLabel = data.genres.length === 1 ? 'Género' : 'Géneros'
	lines.push(`[b]${genreLabel}:[/b] ${data.genres.join(', ')}`)

	lines.push(`[b]Estado:[/b] ${data.status}`)

	if (data.episodeRunTime > 0) {
		lines.push(`[b]Duración por episodio:[/b] ${data.episodeRunTime} min`)
	}

	const seasonLabel = data.numberOfSeasons === 1 ? 'Temporada' : 'Temporadas'
	lines.push(`[b]${seasonLabel}:[/b] ${data.numberOfSeasons}`)
	const episodeLabel = data.numberOfEpisodes === 1 ? 'Episodio' : 'Episodios'
	lines.push(`[b]${episodeLabel}:[/b] ${data.numberOfEpisodes}`)
	lines.push('')

	// Synopsis
	lines.push('[bar]SINOPSIS[/bar]')
	lines.push('')
	lines.push(data.overview)
	lines.push('')

	// Seasons breakdown
	if (data.seasons.length > 0 && data.seasons.length <= 10) {
		lines.push('[bar]TEMPORADAS[/bar]')
		lines.push('')
		data.seasons.forEach(season => {
			const airYear = season.airDate ? ` (${season.airDate.split('-')[0]})` : ''
			lines.push(`[b]Temporada ${season.number}[/b]${airYear}: ${season.episodeCount} episodios`)
		})
		lines.push('')
	}

	// Trailer
	if (data.trailerUrl) {
		lines.push('[bar]TRAILER[/bar]')
		lines.push('')
		lines.push(`[media]${data.trailerUrl}[/media]`)
		lines.push('')
	}

	// Premiere date
	if (data.firstAirDate) {
		lines.push('[bar]ESTRENO[/bar]')
		lines.push('')
		const date = new Date(data.firstAirDate)
		const formatted = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
		lines.push(formatted)
		lines.push('')
	}

	// Networks/Channels at the end
	if (data.networks.length > 0) {
		lines.push('[bar]CADENA[/bar]')
		lines.push('')
		lines.push('[center]')
		data.networks.forEach(network => {
			if (network.logoUrl) {
				lines.push(`[img]${network.logoUrl}[/img]`)
			} else {
				lines.push(network.name)
			}
		})
		lines.push('[/center]')
	}

	return lines.join('\n')
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
		airDate: ep.air_date || null,
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
		airDate: seasonDetails.air_date,
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
	const lines: string[] = []

	if (data.posterUrl) {
		lines.push('[center]')
		lines.push(`[img]${data.posterUrl}[/img]`)
		lines.push('[/center]')
		lines.push('')
	}

	// Basic info
	if (data.seriesCreators.length > 0) {
		const creatorLabel = data.seriesCreators.length === 1 ? 'Creador' : 'Creadores'
		lines.push(`[b]${creatorLabel}:[/b] ${data.seriesCreators.join(', ')}`)
	}
	lines.push(`[b]Reparto:[/b] ${data.seriesCast.join(', ')}`)

	const genreLabel = data.seriesGenres.length === 1 ? 'Género' : 'Géneros'
	lines.push(`[b]${genreLabel}:[/b] ${data.seriesGenres.join(', ')}`)

	lines.push(`[b]Episodios:[/b] ${data.episodeCount}`)

	if (data.averageRuntime > 0) {
		lines.push(`[b]Duración por episodio:[/b] ${data.averageRuntime} min`)
	}
	lines.push('')

	// Synopsis
	lines.push('[bar]SINOPSIS[/bar]')
	lines.push('')
	lines.push(data.overview)
	lines.push('')

	// Episode list
	if (data.episodes.length > 0 && data.episodes.length <= 30) {
		lines.push('[bar]EPISODIOS[/bar]')
		lines.push('')
		data.episodes.forEach(ep => {
			lines.push(`[b]${ep.number}.[/b] ${ep.name}`)
		})
		lines.push('')
	}

	// Trailer
	if (data.trailerUrl) {
		lines.push('[bar]TRAILER[/bar]')
		lines.push('')
		lines.push(`[media]${data.trailerUrl}[/media]`)
		lines.push('')
	}

	// Premiere date
	if (data.airDate) {
		lines.push('[bar]ESTRENO[/bar]')
		lines.push('')
		const date = new Date(data.airDate)
		const formatted = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
		lines.push(formatted)
		lines.push('')
	}

	// Networks/Channels at the end
	if (data.networks.length > 0) {
		lines.push('[bar]CADENA[/bar]')
		lines.push('')
		lines.push('[center]')
		data.networks.forEach(network => {
			if (network.logoUrl) {
				lines.push(`[img]${network.logoUrl}[/img]`)
			} else {
				lines.push(network.name)
			}
		})
		lines.push('[/center]')
	}

	return lines.join('\n')
}
