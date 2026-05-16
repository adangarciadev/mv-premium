/**
 * IGDB API Service
 *
 * ARCHITECTURE: This is a pure RPC facade. All network requests
 * are made via the background script to avoid CORS issues and
 * keep API credentials secure.
 *
 * IGDB requires Twitch OAuth credentials (Client ID + Secret)
 * which are configured by the user in Dashboard > Integraciones.
 *
 * API Documentation: https://api-docs.igdb.com/
 */

import { sendMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import { cachedFetch, createCacheKey, CACHE_TTL } from '@/services/media'
import { renderTemplate } from '@/lib/template-engine'
import { getDefaultTemplate } from '@/features/templates'
import { getSettings, useSettingsStore } from '@/store'
import { fetchSteamGameDetailsViaBackground, extractSteamAppId } from '@/services/api/steam'
import type { MediaTemplate, GameTemplateDataInput } from '@/types/templates'
import type { IGDBGame, IGDBAlternativeName, IGDBGameLocalization, IGDBRegion, IGDBReleaseDate } from './igdb-types'
import {
	getIGDBImageUrl,
	PEGI_RATING_LABELS,
	GAME_MODE_TRANSLATIONS,
	GENRE_TRANSLATIONS,
	THEME_TRANSLATIONS,
	GAME_STATUS_LABELS,
	PLAYER_PERSPECTIVE_TRANSLATIONS,
	IGDBAgeRatingCategory,
	IGDBWebsiteCategory,
} from './igdb-types'
import type { IGDBTimeToBeat } from './igdb-types'

// Re-export types
export type { IGDBGame, IGDBCover, IGDBSearchResult, IGDBImageSize } from './igdb-types'
export { getIGDBImageUrl, IGDBWebsiteCategory } from './igdb-types'

// =============================================================================
// Constants
// =============================================================================

const CACHE_PREFIX = 'mv-igdb-v1'
const IGDB_PAGE_SIZE = 500
const IGDB_PAGE_OVERLAP = 50

const SPANISH_MONTHS = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre',
] as const

export interface UpcomingGameRelease {
	id: number
	name: string
	slug?: string
	coverUrl: string | null
	heroUrl: string | null
	releaseDate: string
	releaseTimestamp: number
	platforms: string[]
	releasePlatforms: string[]
	platformLogos: UpcomingPlatformLogo[]
	igdbUrl: string
	relevanceScore: number
	hypes: number
	follows: number
	rating: number | null
	ratingCount: number
}

export interface UpcomingPlatformLogo {
	name: string
	abbreviation?: string
	logoUrl: string
}

export interface UpcomingGameReleaseQuery {
	from: Date
	to: Date
	platforms?: number[]
	limit?: number
}

const SPANISH_LANGUAGE_TOKENS = ['espanol', 'spanish', 'espa']
const SUPPORT_TYPE_RANKS: { token: string; rank: number }[] = [
	{ token: 'voces', rank: 0 },
	{ token: 'voice', rank: 0 },
	{ token: 'subtit', rank: 1 },
	{ token: 'subtitle', rank: 1 },
	{ token: 'interfaz', rank: 2 },
	{ token: 'interface', rank: 2 },
]

const MAIN_GAME_CATEGORY = 0
const REMAKE_CATEGORY = 8
const REMASTER_CATEGORY = 9
const FEATURED_RELEASE_CATEGORIES = new Set([MAIN_GAME_CATEGORY, REMAKE_CATEGORY, REMASTER_CATEGORY])
const NON_FINAL_RELEASE_STATUS_TOKENS = [
	'alpha',
	'beta',
	'early',
	'advanced',
	'cancel',
	'offline',
	'compatibility',
	'optimization',
] as const

interface IGDBReleaseDateWithGame extends IGDBReleaseDate {
	game?: IGDBGame
}

// =============================================================================
// API Availability Check
// =============================================================================

/**
 * Check if IGDB credentials are configured in environment
 */
export async function hasIgdbCredentials(): Promise<boolean> {
	return sendMessage('hasIgdbCredentials', undefined)
}

// =============================================================================
// Internal Fetch via Background Script
// =============================================================================

/**
 * Fetch from IGDB via background script
 * This handles Twitch OAuth and CORS issues
 */
async function fetchIGDBViaBackground<T>(endpoint: string, body: string): Promise<T> {
	const result = await sendMessage('igdbRequest', { endpoint, body })
	return result as T
}

/**
 * Cached fetch wrapper for IGDB
 */
async function fetchIGDB<T>(endpoint: string, body: string, ttl: number = CACHE_TTL.MEDIUM): Promise<T> {
	const cacheKey = createCacheKey(endpoint, body)
	return cachedFetch(cacheKey, () => fetchIGDBViaBackground<T>(endpoint, body), {
		prefix: CACHE_PREFIX,
		ttl,
		persist: false, // Keep IGDB data in memory only
	})
}

function sortLanguageSupports(a: string, b: string) {
	const aLower = a.toLowerCase()
	const bLower = b.toLowerCase()
	const aIsSpanish = SPANISH_LANGUAGE_TOKENS.some(token => aLower.includes(token))
	const bIsSpanish = SPANISH_LANGUAGE_TOKENS.some(token => bLower.includes(token))
	if (aIsSpanish !== bIsSpanish) return aIsSpanish ? -1 : 1

	const aTypeRank = SUPPORT_TYPE_RANKS.find(rank => aLower.includes(rank.token))?.rank ?? 3
	const bTypeRank = SUPPORT_TYPE_RANKS.find(rank => bLower.includes(rank.token))?.rank ?? 3
	if (aTypeRank !== bTypeRank) return aTypeRank - bTypeRank

	return a.localeCompare(b, 'es')
}

async function fetchGameLocalizations(gameId: number): Promise<IGDBGameLocalization[]> {
	const body = `
		fields name, region, cover.image_id;
		where game = ${gameId};
		limit 50;
	`
	return fetchIGDB<IGDBGameLocalization[]>('/game_localizations', body, CACHE_TTL.LONG)
}

async function fetchAlternativeNames(gameId: number): Promise<IGDBAlternativeName[]> {
	const body = `
		fields name, comment, game;
		where game = ${gameId};
		limit 50;
	`
	return fetchIGDB<IGDBAlternativeName[]>('/alternative_names', body, CACHE_TTL.LONG)
}

async function fetchRegions(): Promise<IGDBRegion[]> {
	const body = `
		fields id, identifier, name, category;
		limit 500;
	`
	return fetchIGDB<IGDBRegion[]>('/regions', body, CACHE_TTL.LONG)
}

function normalizeRegionIdentifier(identifier?: string) {
	return identifier?.trim().toLowerCase() || ''
}

function getPreferredRegionIds(regions: IGDBRegion[]): number[] {
	const ordered: number[] = []
	const seen = new Set<number>()
	const add = (region?: IGDBRegion) => {
		if (region && !seen.has(region.id)) {
			ordered.push(region.id)
			seen.add(region.id)
		}
	}

	const findByIdentifier = (identifier: string) =>
		regions.find(region => normalizeRegionIdentifier(region.identifier) === identifier)
	const findByName = (needle: string) => regions.find(region => (region.name || '').toLowerCase().includes(needle))

	add(findByIdentifier('es'))
	add(findByName('spain'))
	add(findByName('espana'))
	add(findByIdentifier('eu'))
	add(findByName('europe'))
	add(findByIdentifier('ww'))
	add(findByName('worldwide'))

	return ordered
}

function findLocalizationByRegion(
	localizations: IGDBGameLocalization[],
	regionIds: number[]
): IGDBGameLocalization | null {
	for (const regionId of regionIds) {
		const match = localizations.find(loc => loc.region === regionId && (loc.name || loc.cover?.image_id))
		if (match) return match
	}
	return null
}

function pickAlternativeName(alternativeNames: IGDBAlternativeName[]): string | null {
	for (const alt of alternativeNames) {
		const comment = alt.comment?.toLowerCase() || ''
		if (
			comment.includes('spanish') ||
			comment.includes('espanol') ||
			comment.includes('espana') ||
			comment.includes('spain') ||
			comment.includes('latam') ||
			comment.includes('latin america')
		) {
			return alt.name
		}
	}
	return null
}

function resolveSpanishLocalization(
	localizations: IGDBGameLocalization[],
	alternativeNames: IGDBAlternativeName[],
	regions: IGDBRegion[]
): { localizedName: string | null; localizedCoverUrl: string | null } {
	if (localizations.length === 0 && alternativeNames.length === 0) {
		return { localizedName: null, localizedCoverUrl: null }
	}

	const preferredRegionIds = getPreferredRegionIds(regions)
	const preferredLocalization = findLocalizationByRegion(localizations, preferredRegionIds)
	const fallbackLocalization = localizations.find(loc => loc.name || loc.cover?.image_id) || null

	const localizedName =
		preferredLocalization?.name || fallbackLocalization?.name || pickAlternativeName(alternativeNames)
	const coverId = preferredLocalization?.cover?.image_id || fallbackLocalization?.cover?.image_id || null
	const localizedCoverUrl = coverId ? getIGDBImageUrl(coverId, 'cover_big') : null

	return { localizedName: localizedName || null, localizedCoverUrl }
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Sanitize search query for IGDB API.
 * Removes special characters that break IGDB's search parser.
 */
function sanitizeSearchQuery(query: string): string {
	return (
		query
			// Remove characters that break IGDB search
			.replace(/[:"'!@#$%^&*()+=\[\]{}<>|\\/.?~`]/g, ' ')
			// Collapse multiple spaces
			.replace(/\s{2,}/g, ' ')
			.trim()
	)
}

/**
 * Search for games by name.
 *
 * Uses IGDB's `search` endpoint first (best relevance ranking).
 * If no results are found, falls back to a wildcard `where name` query
 * which is more tolerant of partial matches and special characters.
 */
export async function searchGames(query: string, limit = 50): Promise<IGDBGame[]> {
	const sanitized = sanitizeSearchQuery(query)
	if (!sanitized) return []

	// Escape quotes in query
	const escapedQuery = sanitized.replace(/"/g, '\\"')

	// Primary search: IGDB's built-in search (best relevance)
	const body = `
		search "${escapedQuery}";
		fields name, cover.image_id, first_release_date, platforms.name, platforms.abbreviation,
			   genres.name, rating, summary;
		limit ${limit};
	`

	const results = await fetchIGDB<IGDBGame[]>('/games', body, CACHE_TTL.SHORT)

	// If search found results, return them
	if (results.length > 0) return results

	// Fallback strategy:
	// If the query has multiple terms (e.g. "resident evil bio"), splitting them allows
	// finding "Resident Evil 7: Biohazard" where the terms are not contiguous.
	const terms = escapedQuery.split(/\s+/).filter(t => t.length > 0)
	let whereClause = `name ~ *"${escapedQuery}"*` // Default: exact phrase substring

	if (terms.length > 1) {
		// Create AND condition: name ~ *"term1"* & name ~ *"term2"*
		whereClause = terms.map(t => `name ~ *"${t}"*`).join(' & ')
	}

	// Fallback query construction
	const fallbackBody = `
		fields name, cover.image_id, first_release_date, platforms.name, platforms.abbreviation,
			   genres.name, rating, summary;
		where ${whereClause};
		sort rating desc;
		limit ${limit};
	`

	return fetchIGDB<IGDBGame[]>('/games', fallbackBody, CACHE_TTL.SHORT)
}

/**
 * Get detailed game information by ID
 */
export async function getGameDetails(gameId: number): Promise<IGDBGame | null> {
	const body = `
		fields name, slug, summary, storyline, first_release_date, status,
			   rating, aggregated_rating, total_rating,
			   cover.image_id,
			   screenshots.image_id,
			   artworks.image_id,
			   videos.name, videos.video_id,
			   genres.name, themes.name,
			   platforms.name, platforms.abbreviation,
			   involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
			   game_modes.name,
			   player_perspectives.name,
			   game_engines.name,
			   collection.name,
			   collections.name,
			   franchise.name,
			   franchises.name,
			   similar_games.name, similar_games.cover.image_id,
			   dlcs.name,
			   websites.category, websites.url,
			   age_ratings.category, age_ratings.rating,
			   release_dates.date, release_dates.human, release_dates.platform.name,
			   external_games.name, external_games.url, external_games.uid, external_games.year,
			   external_games.platform.name, external_games.external_game_source.name,
			   external_games.game_release_format.format,
			   language_supports.language.name, language_supports.language.native_name,
			   language_supports.language_support_type.name;
		where id = ${gameId};
	`

	const results = await fetchIGDB<IGDBGame[]>('/games', body, CACHE_TTL.MEDIUM)
	return results.length > 0 ? results[0] : null
}

/**
 * Get multiple games by IDs
 */
export async function getGamesByIds(gameIds: number[]): Promise<IGDBGame[]> {
	if (gameIds.length === 0) return []

	const body = `
		fields name, cover.image_id, first_release_date, platforms.abbreviation, rating;
		where id = (${gameIds.join(',')});
		limit ${gameIds.length};
	`

	return fetchIGDB<IGDBGame[]>('/games', body, CACHE_TTL.MEDIUM)
}

function toUnixSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000)
}

function getReleaseRelevanceScore(game: IGDBGame): number {
	const hypes = game.hypes ?? 0
	const follows = game.follows ?? 0
	const ratingCount = game.total_rating_count ?? game.rating_count ?? 0
	const totalRating = game.total_rating ?? game.rating ?? 0
	const platformCount = game.platforms?.length ?? 0
	const hasCover = game.cover?.image_id ? 25 : 0
	const hasSlug = game.slug ? 8 : 0

	return hypes * 3 + follows * 2 + ratingCount * 1.5 + totalRating * 0.25 + platformCount * 4 + hasCover + hasSlug
}

function shouldIncludeFeaturedRelease(game: IGDBGame): boolean {
	if (typeof game.first_release_date !== 'number') return false
	if (typeof game.category === 'number' && !FEATURED_RELEASE_CATEGORIES.has(game.category)) return false
	if (typeof game.version_parent === 'number') return false

	return true
}

function formatReleaseDateKey(timestamp: number): string {
	return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function getPlatformName(platform: { name: string; abbreviation?: string }): string {
	return platform.abbreviation || platform.name
}

function uniquePlatforms(platforms: string[]): string[] {
	return [...new Set(platforms.filter(Boolean))]
}

function getReleaseDateStatusName(releaseDate: IGDBReleaseDate): string | null {
	if (!releaseDate.status || typeof releaseDate.status === 'number') return null
	return releaseDate.status.name?.toLowerCase() ?? null
}

function isCalendarReleaseDate(releaseDate: IGDBReleaseDate): releaseDate is IGDBReleaseDate & { date: number } {
	const statusName = getReleaseDateStatusName(releaseDate)
	const isFinalRelease =
		statusName === null || !NON_FINAL_RELEASE_STATUS_TOKENS.some(token => statusName.includes(token))

	return typeof releaseDate.date === 'number' && isFinalRelease
}

function getReleasePlatformsForDate(game: IGDBGame, releaseDate: string): string[] {
	const releasePlatforms =
		game.release_dates
			?.filter(releaseDateEntry => {
				return (
					isCalendarReleaseDate(releaseDateEntry) &&
					formatReleaseDateKey(releaseDateEntry.date) === releaseDate &&
					releaseDateEntry.platform
				)
			})
			.map(releaseDateEntry => getPlatformName(releaseDateEntry.platform!)) ?? []

	return uniquePlatforms(releasePlatforms)
}

function getCalendarReleaseDatesInRange(game: IGDBGame, fromSeconds?: number, toSeconds?: number): number[] {
	const timestamps =
		game.release_dates
			?.filter(isCalendarReleaseDate)
			.map(releaseDate => releaseDate.date)
			.filter(timestamp => {
				if (fromSeconds !== undefined && timestamp < fromSeconds) return false
				if (toSeconds !== undefined && timestamp >= toSeconds) return false
				return true
			}) ?? []

	return [...new Set(timestamps)].sort((a, b) => a - b)
}

function toUpcomingGameRelease(
	game: IGDBGame,
	releaseTimestamp: number,
	releasePlatforms: string[]
): UpcomingGameRelease | null {
	if (!shouldIncludeFeaturedRelease(game)) return null

	const releaseDate = formatReleaseDateKey(releaseTimestamp)
	const coverUrl = game.cover?.image_id ? getIGDBImageUrl(game.cover.image_id, 'cover_big') : null
	const heroImageId = game.artworks?.[0]?.image_id || game.screenshots?.[0]?.image_id
	const heroUrl = heroImageId ? getIGDBImageUrl(heroImageId, 'screenshot_big') : null
	const platformEntries = game.platforms ?? []
	const platforms = uniquePlatforms(platformEntries.map(getPlatformName))
	const visibleReleasePlatforms = releasePlatforms.length > 0 ? releasePlatforms : getReleasePlatformsForDate(game, releaseDate)
	const platformLogos = platformEntries
		.filter(platform => platform.platform_logo?.image_id)
		.map(platform => ({
			name: platform.name,
			abbreviation: platform.abbreviation,
			logoUrl: getIGDBImageUrl(platform.platform_logo!.image_id, 'logo_med'),
		}))
	const slug = game.slug || String(game.id)

	return {
		id: game.id,
		name: game.name,
		slug: game.slug,
		coverUrl,
		heroUrl,
		releaseDate,
		releaseTimestamp,
		platforms,
		releasePlatforms: visibleReleasePlatforms.length > 0 ? visibleReleasePlatforms : platforms,
		platformLogos,
		igdbUrl: `https://www.igdb.com/games/${slug}`,
		relevanceScore: getReleaseRelevanceScore(game),
		hypes: game.hypes ?? 0,
		follows: game.follows ?? 0,
		rating: game.total_rating ?? game.rating ?? null,
		ratingCount: game.total_rating_count ?? game.rating_count ?? 0,
	}
}

function normalizeUpcomingReleaseDateEntries(entries: IGDBReleaseDateWithGame[]): UpcomingGameRelease[] {
	const grouped = new Map<string, { game: IGDBGame; releaseTimestamp: number; platforms: string[] }>()

	for (const entry of entries) {
		if (!isCalendarReleaseDate(entry) || !entry.game) continue

		const key = `${entry.game.id}:${entry.date}`
		const current = grouped.get(key) ?? { game: entry.game, releaseTimestamp: entry.date, platforms: [] }
		if (entry.platform) current.platforms.push(getPlatformName(entry.platform))
		grouped.set(key, current)
	}

	return [...grouped.values()]
		.map(({ game, releaseTimestamp, platforms }) => toUpcomingGameRelease(game, releaseTimestamp, uniquePlatforms(platforms)))
		.filter((release): release is UpcomingGameRelease => release !== null)
		.sort((a, b) => a.releaseTimestamp - b.releaseTimestamp || b.relevanceScore - a.relevanceScore || a.id - b.id)
}

function pickUpcomingReleases(releases: UpcomingGameRelease[], limit?: number): UpcomingGameRelease[] {
	const sorted = releases.sort(
		(a, b) =>
			a.releaseTimestamp - b.releaseTimestamp ||
			b.relevanceScore - a.relevanceScore ||
			a.name.localeCompare(b.name, 'es') ||
			a.id - b.id
	)

	return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
}

export function normalizeUpcomingGameReleases(games: IGDBGame[], from?: Date, to?: Date): UpcomingGameRelease[] {
	const fromSeconds = from ? toUnixSeconds(from) : undefined
	const toSeconds = to ? toUnixSeconds(to) : undefined

	return games
		.flatMap(game => {
			const releaseDates = getCalendarReleaseDatesInRange(game, fromSeconds, toSeconds)
			const timestamps =
				releaseDates.length > 0
					? releaseDates
					: typeof game.first_release_date === 'number'
						? [game.first_release_date]
						: []

			return timestamps.map(timestamp => toUpcomingGameRelease(game, timestamp, []))
		})
		.filter((release): release is UpcomingGameRelease => release !== null)
		.sort((a, b) => a.releaseTimestamp - b.releaseTimestamp || b.relevanceScore - a.relevanceScore || a.id - b.id)
}

async function fetchIGDBPages<T>(
	endpoint: string,
	body: string,
	ttl: number = CACHE_TTL.MEDIUM,
	getKey?: (item: T) => number | string
): Promise<T[]> {
	const results: T[] = []
	const seenKeys = new Set<number | string>()
	let offset = 0
	const pageStep = getKey ? IGDB_PAGE_SIZE - IGDB_PAGE_OVERLAP : IGDB_PAGE_SIZE

	while (true) {
		const page = await fetchIGDB<T[]>(
			endpoint,
			`
			${body}
			limit ${IGDB_PAGE_SIZE};
			offset ${offset};
		`,
			ttl
		)
		for (const item of page) {
			if (!getKey) {
				results.push(item)
				continue
			}

			const key = getKey(item)
			if (seenKeys.has(key)) continue

			seenKeys.add(key)
			results.push(item)
		}

		if (page.length < IGDB_PAGE_SIZE) return results
		offset += pageStep
	}
}

export async function getUpcomingGameReleases({
	from,
	to,
	platforms,
	limit,
}: UpcomingGameReleaseQuery): Promise<UpcomingGameRelease[]> {
	const fromSeconds = toUnixSeconds(from)
	const toSeconds = toUnixSeconds(to)
	const finalCacheKey = createCacheKey(
		'upcoming-releases',
		fromSeconds,
		toSeconds,
		platforms?.join(',') || 'all',
		limit ?? 'all'
	)

	return cachedFetch(
		finalCacheKey,
		() => fetchUpcomingGameReleases({ from, to, platforms, limit }, fromSeconds, toSeconds),
		{
			prefix: CACHE_PREFIX,
			ttl: CACHE_TTL.LONG,
			persist: true,
		}
	)
}

async function fetchUpcomingGameReleases(
	{ from, to, platforms, limit }: UpcomingGameReleaseQuery,
	fromSeconds: number,
	toSeconds: number
): Promise<UpcomingGameRelease[]> {
	const platformClause = platforms?.length ? ` & platforms = (${platforms.join(',')})` : ''
	const releaseDatePlatformClause = platforms?.length ? ` & platform = (${platforms.join(',')})` : ''
	const fields = `
		fields name, slug, category, version_parent, cover.image_id, artworks.image_id, screenshots.image_id, first_release_date,
			   platforms.name, platforms.abbreviation, platforms.platform_logo.image_id,
			   release_dates.date, release_dates.category, release_dates.status.name,
			   release_dates.platform.name, release_dates.platform.abbreviation,
			   hypes, follows, rating, rating_count,
			   total_rating, total_rating_count;
	`
	const releaseDateFields = `
		fields date, category, status.name, platform.name, platform.abbreviation,
			   game.name, game.slug, game.category, game.version_parent,
			   game.cover.image_id, game.artworks.image_id, game.screenshots.image_id, game.first_release_date,
			   game.platforms.name, game.platforms.abbreviation, game.platforms.platform_logo.image_id,
			   game.hypes, game.follows, game.rating, game.rating_count,
			   game.total_rating, game.total_rating_count;
	`
	const whereClause = `where first_release_date >= ${fromSeconds} & first_release_date < ${toSeconds}${platformClause};`
	const releaseDateWhereClause = `where date >= ${fromSeconds} & date < ${toSeconds}${releaseDatePlatformClause};`
	const gamesBody = `
		${fields}
		${whereClause}
		sort first_release_date asc;
	`
	const releaseDatesBody = `
		${releaseDateFields}
		${releaseDateWhereClause}
		sort date asc;
	`

	const [gameResults, releaseDateEntries] = await Promise.all([
		fetchIGDBPages<IGDBGame>('/games', gamesBody, CACHE_TTL.MEDIUM, game => game.id),
		fetchIGDBPages<IGDBReleaseDateWithGame>('/release_dates', releaseDatesBody, CACHE_TTL.MEDIUM, releaseDate => releaseDate.id),
	])
	const gamesById = new Map<number, IGDBGame>()
	for (const game of gameResults) {
		gamesById.set(game.id, game)
	}

	const releasesByGameAndDate = new Map<string, UpcomingGameRelease>()
	for (const release of [
		...normalizeUpcomingGameReleases([...gamesById.values()], from, to),
		...normalizeUpcomingReleaseDateEntries(releaseDateEntries),
	]) {
		releasesByGameAndDate.set(`${release.id}:${release.releaseDate}`, release)
	}

	return pickUpcomingReleases([...releasesByGameAndDate.values()], limit)
}

/**
 * Get time-to-beat data for a game
 */
async function getTimeToBeat(gameId: number): Promise<IGDBTimeToBeat | null> {
	try {
		const body = `
			fields game_id, hastily, normally, completely, count;
			where game_id = ${gameId};
		`

		const results = await fetchIGDB<IGDBTimeToBeat[]>('/game_time_to_beats', body, CACHE_TTL.MEDIUM)
		if (!Array.isArray(results) || results.length === 0) return null
		return results[0]
	} catch (error) {
		// Don't let TTB errors break the whole template generation
		logger.debug('Failed to fetch time-to-beat data for game', gameId, error)
		return null
	}
}

/**
 * Format seconds to a human-readable duration string (e.g. "32h 15min")
 */
function formatTimeToBeat(seconds: number): string {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	if (hours === 0) return `${minutes}min`
	if (minutes === 0) return `${hours}h`
	return `${hours}h ${minutes}min`
}

// =============================================================================
// Template Data
// =============================================================================

/**
 * Convert IGDB game data to template format
 */
export type GameFetchStep = 'igdb' | 'steam' | 'done'

export async function getGameTemplateData(
	gameId: number,
	onProgress?: (step: GameFetchStep) => void
): Promise<GameTemplateDataInput | null> {
	// Fetch game details and time-to-beat in parallel
	onProgress?.('igdb')
	const [game, timeToBeat, localizations, alternativeNames] = await Promise.all([
		getGameDetails(gameId),
		getTimeToBeat(gameId),
		fetchGameLocalizations(gameId),
		fetchAlternativeNames(gameId),
	])
	if (!game) return null

	const regions = localizations.length > 0 ? await fetchRegions() : []
	const { localizedName, localizedCoverUrl } = resolveSpanishLocalization(localizations, alternativeNames, regions)

	// Extract developers and publishers
	const developers: string[] = []
	const publishers: string[] = []

	game.involved_companies?.forEach(ic => {
		if (ic.developer) developers.push(ic.company.name)
		if (ic.publisher) publishers.push(ic.company.name)
	})

	// Get platforms
	const platforms = game.platforms?.map(p => p.abbreviation || p.name) || []

	// Get genres with translations
	const genres = game.genres?.map(g => GENRE_TRANSLATIONS[g.name] || g.name) || []

	// Get themes with translations
	const themes = game.themes?.map(t => THEME_TRANSLATIONS[t.name] || t.name) || []

	// Get game modes with translations
	const gameModes = game.game_modes?.map(gm => GAME_MODE_TRANSLATIONS[gm.name] || gm.name) || []

	// Get player perspectives with translations
	const playerPerspectives =
		game.player_perspectives?.map(pp => PLAYER_PERSPECTIVE_TRANSLATIONS[pp.name] || pp.name) || []

	// Get cover URL (HD)
	const coverUrl = localizedCoverUrl || (game.cover ? getIGDBImageUrl(game.cover.image_id, 'cover_big') : null)

	// Get screenshots in 1080p
	const screenshots = game.screenshots?.slice(0, 6).map(s => getIGDBImageUrl(s.image_id, '1080p')) || []

	// Get artworks in 1080p (high-quality promotional art / backgrounds)
	const artworks = game.artworks?.slice(0, 4).map(a => getIGDBImageUrl(a.image_id, '1080p')) || []

	// Get all video URLs (YouTube)
	// IGDB video names can be anything (trailer, gameplay, soundtrack...).
	// We try to find a proper trailer first for `trailerUrl`.
	const allVideos =
		game.videos?.map(v => ({
			name: v.name || 'Video',
			url: `https://www.youtube.com/watch?v=${v.video_id}`,
		})) || []

	// Find the best trailer: prefer videos with "trailer" in the name
	const trailerNames = ['trailer', 'tráiler', 'announce', 'reveal', 'launch', 'cinematic']
	const bestTrailer =
		allVideos.find(v => trailerNames.some(t => v.name.toLowerCase().includes(t))) || allVideos[0] || null
	const trailerUrl = bestTrailer?.url || null
	const trailers = allVideos

	// Game engines
	const gameEngines = game.game_engines?.map(e => e.name) || []

	// Collection / Saga — IGDB has both `collection` (deprecated → `collections`) and `franchise`/`franchises`.
	// Many games only have `franchise` set, not `collection`. We try all sources.
	const collection =
		game.collection?.name || game.collections?.[0]?.name || game.franchise?.name || game.franchises?.[0]?.name || null

	// Similar games
	const similarGames =
		game.similar_games?.slice(0, 6).map(sg => ({
			name: sg.name,
			coverUrl: sg.cover ? getIGDBImageUrl(sg.cover.image_id, 'cover_big') : null,
		})) || []

	// DLCs
	const dlcs = game.dlcs?.map(d => d.name) || []

	// Time to beat
	const timeToBeatHastily = timeToBeat?.hastily ? formatTimeToBeat(timeToBeat.hastily) : null
	const timeToBeatNormally = timeToBeat?.normally ? formatTimeToBeat(timeToBeat.normally) : null
	const timeToBeatCompletely = timeToBeat?.completely ? formatTimeToBeat(timeToBeat.completely) : null

	// Game status
	const status = game.status !== undefined ? GAME_STATUS_LABELS[game.status] || null : null

	// Get websites
	const websites =
		game.websites?.map(w => ({
			category: getCategoryLabel(w.category),
			url: w.url,
		})) || []

	// External games (store/service links)
	const externalLinkByStore: Record<'steam', string | null> = {
		steam: null,
	}

	const externalGames =
		game.external_games?.map(external => {
			const source = external.external_game_source?.name || 'External'
			const platform = external.platform?.name
			const label = platform ? `${source} (${platform})` : source
			const link = external.url || external.uid || external.name || null

			const sourceKey = normalizeExternalSourceKey(source)
			if (sourceKey && link && !externalLinkByStore[sourceKey]) {
				externalLinkByStore[sourceKey] = link
			}

			if (external.url) return `${label}: ${external.url}`
			if (external.uid) return `${label}: ${external.uid}`
			if (external.name) return `${label}: ${external.name}`
			return label
		}) || []

	// =========================================================================
	// Fetch Spanish description from Steam (if available)
	// IGDB only provides English summaries. Steam Store API supports localized
	// descriptions via the `l=spanish` parameter. We extract the Steam App ID
	// from external_games first, then fall back to websites with Steam category.
	// =========================================================================
	let steamDescription: string | null = null
	let steamScreenshots: string[] = []
	let steamLibraryHeaderUrl: string | null = null
	let steamAppId: number | null = null

	// Try external_games first (most reliable source)
	const steamLink = externalLinkByStore.steam
	if (steamLink) {
		steamAppId = extractSteamAppId(steamLink) || parseNumericId(steamLink)
	}

	// Fallback: extract from websites with Steam category
	if (!steamAppId) {
		const steamWebsite = websites.find(w => w.category === 'steam')
		if (steamWebsite) {
			steamAppId = extractSteamAppId(steamWebsite.url)
		}
	}

	if (steamAppId) {
		try {
			onProgress?.('steam')
			const steamGame = await fetchSteamGameDetailsViaBackground(steamAppId)
			if (steamGame?.description) {
				steamDescription = steamGame.description
			}
			if (steamGame?.screenshots && steamGame.screenshots.length > 0) {
				steamScreenshots = steamGame.screenshots
			}
			if (steamGame) {
				steamLibraryHeaderUrl = steamGame.steamLibraryHeaderUrl
			}
		} catch (error) {
			logger.debug('Failed to fetch Steam Spanish description for game', gameId, error)
		}
	}

	// Language supports
	const languageSupportsRaw =
		game.language_supports?.map(ls => {
			const language = ls.language?.native_name || ls.language?.name || 'Idioma'
			const supportType = ls.language_support_type?.name || 'Soporte'
			return `${language} (${supportType})`
		}) || []
	const languageSupports = [...languageSupportsRaw].sort(sortLanguageSupports)

	// Get age rating (prefer PEGI)
	let ageRating: string | null = null
	const pegiRating = game.age_ratings?.find(ar => ar.category === IGDBAgeRatingCategory.PEGI)
	if (pegiRating) {
		ageRating = PEGI_RATING_LABELS[pegiRating.rating] || null
	}

	// Format release date (e.g. "19 de septiembre de 2025")
	let releaseDate: string | null = null
	let releaseYear: string | null = null
	if (game.first_release_date) {
		const date = new Date(game.first_release_date * 1000)
		const year = date.getFullYear()
		releaseDate = `${date.getDate()} de ${SPANISH_MONTHS[date.getMonth()]} de ${year}`
		releaseYear = String(year)
	}

	// Release dates per platform
	const releaseDates =
		game.release_dates?.map(rd => {
			const platformName = rd.platform?.name || 'Sin plataforma'
			let humanDate: string | undefined
			if (rd.date) {
				const date = new Date(rd.date * 1000)
				humanDate = `${date.getDate()} de ${SPANISH_MONTHS[date.getMonth()]} de ${date.getFullYear()}`
			} else if (rd.human) {
				humanDate = rd.human
			}
			return `${platformName}: ${humanDate || '—'}`
		}) || []

	onProgress?.('done')
	return {
		name: localizedName || game.name,
		originalName: game.name,
		releaseDate,
		releaseYear,
		releaseDates,
		status,
		developers,
		publishers,
		platforms,
		genres,
		themes,
		gameModes,
		playerPerspectives,
		gameEngines,
		collection,
		// Use Steam's Spanish description when available, fall back to IGDB's English summary
		summary: steamDescription || game.summary || '',
		detailedDescription: null,
		storyline: game.storyline || null,
		coverUrl,
		steamLibraryHeaderUrl,
		screenshots,
		steamScreenshots,
		artworks,
		trailerUrl,
		trailers,
		similarGames,
		dlcs,
		timeToBeatHastily,
		timeToBeatNormally,
		timeToBeatCompletely,
		websites,
		externalGames,
		steamStoreUrl: steamAppId ? `https://store.steampowered.com/app/${steamAppId}` : null,
		languageSupports,
		rating: game.rating ? Math.round(game.rating) : null,
		aggregatedRating: game.aggregated_rating ? Math.round(game.aggregated_rating) : null,
		totalRating: game.total_rating ? Math.round(game.total_rating) : null,
		ageRating,
	}
}

function normalizeExternalSourceKey(source: string): 'steam' | null {
	const normalized = source.toLowerCase()
	if (normalized.includes('steam')) return 'steam'
	return null
}

/**
 * Parse a plain numeric string as a Steam App ID
 * Used when IGDB stores UID instead of a full URL
 */
function parseNumericId(value: string): number | null {
	const trimmed = value.trim()
	if (!/^\d+$/.test(trimmed)) return null
	const num = parseInt(trimmed, 10)
	return num > 0 ? num : null
}

/**
 * Get category label for website
 */
function getCategoryLabel(category: number): string {
	const labels: Record<number, string> = {
		[IGDBWebsiteCategory.Official]: 'official',
		[IGDBWebsiteCategory.Steam]: 'steam',
		[IGDBWebsiteCategory.GOG]: 'gog',
		[IGDBWebsiteCategory.EpicGames]: 'epic',
		[IGDBWebsiteCategory.Itch]: 'itch',
		[IGDBWebsiteCategory.Wikipedia]: 'wikipedia',
		[IGDBWebsiteCategory.Twitter]: 'twitter',
		[IGDBWebsiteCategory.YouTube]: 'youtube',
		[IGDBWebsiteCategory.Twitch]: 'twitch',
		[IGDBWebsiteCategory.Discord]: 'discord',
		[IGDBWebsiteCategory.Reddit]: 'reddit',
	}
	return labels[category] || 'other'
}

// =============================================================================
// Template Generation
// =============================================================================

/**
 * Get the active game template
 */
function getActiveGameTemplate(): MediaTemplate {
	const { mediaTemplates } = useSettingsStore.getState()
	const customTemplate = mediaTemplates.game
	return customTemplate || getDefaultTemplate('game')
}

async function getActiveGameTemplateForThread(): Promise<MediaTemplate> {
	const storeTemplate = useSettingsStore.getState().mediaTemplates.game
	if (storeTemplate) return storeTemplate

	const persistedSettings = await getSettings()
	const persistedTemplate = persistedSettings.mediaTemplates?.game
	return persistedTemplate || getDefaultTemplate('game')
}

/**
 * Generate BBCode template for a game
 */
export function generateGameTemplate(data: GameTemplateDataInput): string {
	const template = getActiveGameTemplate()
	return renderTemplate(template, data)
}

/**
 * Fetch game data and generate template in one call
 */
export async function getGameTemplateString(gameId: number): Promise<string | null> {
	const data = await getGameTemplateData(gameId)
	if (!data) return null
	const template = await getActiveGameTemplateForThread()
	return renderTemplate(template, data)
}
