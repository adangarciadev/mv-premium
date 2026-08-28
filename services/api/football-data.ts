/**
 * Football Data API service.
 *
 * This module runs in the content script. It keeps the API payload
 * normalization and manual cache separate from the background network proxy.
 */

import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'
import { formatIsoDateKey } from '@/lib/date-utils'
import { CACHE_TTL, createCacheKey, getCached, setCache } from '@/services/media'
import type { FootballDataResult, FootballStandingsResult } from '@/lib/messaging'

// =============================================================================
// Public Types
// =============================================================================

export type FootballCompetitionCode = 'PD' | 'CL'

export interface FootballTeam {
	id: number
	name: string
	shortName: string
	tla: string
	crest: string
}

export interface FootballScore {
	home: number
	away: number
	/** True when the tie was decided in extra time or on penalties. */
	decidedBeyondRegularTime: boolean
	/** Shootout result, only when the match went to penalties. */
	penalties: { home: number; away: number } | null
}

export interface FootballMatch {
	id: number
	utcDate: string
	status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED'
	competition: FootballCompetitionCode
	matchday: number | null
	stage: string
	/** Live minute, when the API reports one. Absent on most listing payloads. */
	minute: number | null
	home: FootballTeam
	away: FootballTeam
	score: FootballScore | null
}

export interface FootballStandingRow {
	position: number
	team: FootballTeam
	playedGames: number
	won: number
	draw: number
	lost: number
	points: number
	goalsFor: number
	goalsAgainst: number
	goalDifference: number
}

export interface FootballStandings {
	/** Competition stage the table belongs to, e.g. REGULAR_SEASON or LEAGUE_STAGE. */
	stage: string
	/**
	 * Calendar year the table's season started in, or null when the payload
	 * omits it. A competition whose new season has not kicked off still answers
	 * with the previous one, so the table has to say which season it is.
	 */
	seasonStartYear: number | null
	rows: FootballStandingRow[]
}

export type FootballStandingsFetchResult =
	| { ok: true; standings: FootballStandings }
	| { ok: false; reason: Extract<FootballStandingsResult, { ok: false }>['reason'] }

export type FootballFetchResult =
	| { ok: true; matches: FootballMatch[] }
	| { ok: false; reason: 'no-key' | 'invalid-key' | 'quota-exceeded' | 'network' }

// =============================================================================
// Constants
// =============================================================================

const CACHE_PREFIX = 'mv-football-v2'
/**
 * Kept deliberately below the calendar's 60s poll interval. When the two were
 * equal the cache was written a few milliseconds after each tick, so the next
 * tick still found it valid, returned stale matches and did not even rewrite
 * it: scores only moved every other minute.
 */
const LIVE_CACHE_TTL = 30 * 1000
const ACTIVE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
/** Never let a cached snapshot outlive the next kickoff by more than this. */
const KICKOFF_GRACE = 30 * 1000
const STABLE_CACHE_TTL = CACHE_TTL.HOUR * 6
/** A table only moves when matches finish, so an hour is plenty. */
const STANDINGS_CACHE_TTL = CACHE_TTL.HOUR

const FOOTBALL_MATCH_STATUSES = new Set<FootballMatch['status']>([
	'SCHEDULED',
	'TIMED',
	'IN_PLAY',
	'PAUSED',
	'FINISHED',
	'POSTPONED',
	'SUSPENDED',
	'CANCELLED',
])

type RawRecord = Record<string, unknown>

// =============================================================================
// Raw Payload Normalization
// =============================================================================

function isRecord(value: unknown): value is RawRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFootballMatchStatus(value: unknown): value is FootballMatch['status'] {
	return typeof value === 'string' && FOOTBALL_MATCH_STATUSES.has(value as FootballMatch['status'])
}

function readScorePair(value: unknown): { home: number; away: number } | null {
	if (!isRecord(value)) return null
	if (
		typeof value.home !== 'number' ||
		!Number.isFinite(value.home) ||
		typeof value.away !== 'number' ||
		!Number.isFinite(value.away)
	) {
		return null
	}

	return { home: value.home, away: value.away }
}

function normalizeScore(value: unknown): FootballScore | null {
	if (!isRecord(value)) return null

	const fullTime = readScorePair(value.fullTime)
	if (!fullTime) return null

	if (value.duration === 'PENALTY_SHOOTOUT') {
		const regularTime = readScorePair(value.regularTime) ?? fullTime
		const extraTime = readScorePair(value.extraTime)
		const penalties = readScorePair(value.penalties)

		return {
			home: regularTime.home + (extraTime?.home ?? 0),
			away: regularTime.away + (extraTime?.away ?? 0),
			decidedBeyondRegularTime: true,
			penalties,
		}
	}

	if (value.duration === 'EXTRA_TIME') {
		return {
			...fullTime,
			decidedBeyondRegularTime: true,
			penalties: null,
		}
	}

	return {
		...fullTime,
		decidedBeyondRegularTime: false,
		penalties: null,
	}
}

function normalizeTeam(value: unknown): FootballTeam | null {
	if (!isRecord(value)) return null
	if (
		typeof value.id !== 'number' ||
		!Number.isFinite(value.id) ||
		typeof value.name !== 'string' ||
		typeof value.shortName !== 'string' ||
		typeof value.tla !== 'string' ||
		typeof value.crest !== 'string'
	) {
		return null
	}

	return {
		id: value.id,
		name: value.name,
		shortName: value.shortName,
		tla: value.tla,
		crest: value.crest,
	}
}

function normalizeMatch(value: unknown, competition: FootballCompetitionCode): FootballMatch | null {
	if (!isRecord(value)) return null
	if (
		typeof value.id !== 'number' ||
		!Number.isFinite(value.id) ||
		typeof value.utcDate !== 'string' ||
		!isFootballMatchStatus(value.status)
	) {
		return null
	}

	const home = normalizeTeam(value.homeTeam)
	const away = normalizeTeam(value.awayTeam)
	if (!home || !away) return null

	const matchday = typeof value.matchday === 'number' && Number.isFinite(value.matchday) ? value.matchday : null
	const stage = typeof value.stage === 'string' ? value.stage : ''
	const minute = typeof value.minute === 'number' && Number.isFinite(value.minute) ? value.minute : null

	return {
		id: value.id,
		utcDate: value.utcDate,
		status: value.status,
		competition,
		matchday,
		stage,
		minute,
		home,
		away,
		score: normalizeScore(value.score),
	}
}

/**
 * Normalize the raw football-data.org response into the service's flat shape.
 * Invalid match entries are skipped so one malformed item cannot hide valid data.
 */
export function normalizeMatches(payload: unknown, competition: FootballCompetitionCode): FootballMatch[] {
	if (!isRecord(payload) || !Array.isArray(payload.matches)) return []

	const matches: FootballMatch[] = []
	let discardedCount = 0

	for (const rawMatch of payload.matches) {
		const match = normalizeMatch(rawMatch, competition)
		if (match) {
			matches.push(match)
		} else {
			discardedCount += 1
		}
	}

	if (discardedCount > 0) {
		logger.warn(`Discarded ${discardedCount} invalid football match entr${discardedCount === 1 ? 'y' : 'ies'}`)
	}

	return matches
}

// =============================================================================
// Date Window and Cache TTL
// =============================================================================

/**
 * Return the full European season window (1 July to 30 June) containing the
 * given date.
 *
 * The calendar navigates by matchday, so a narrow window around today would
 * only hold whichever matchdays happen to fall inside it: rescheduled fixtures
 * make those numbers jump (1, then 3, then 6). Requesting the whole season
 * costs the same single request and keeps matchdays consecutive.
 */
export function getCurrentSeasonStartYear(now: Date = new Date()): number {
	return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

export function getSeasonMatchWindow(now: Date = new Date()): { dateFrom: string; dateTo: string } {
	const seasonStartYear = getCurrentSeasonStartYear(now)

	return {
		dateFrom: formatIsoDateKey(new Date(seasonStartYear, 6, 1)),
		dateTo: formatIsoDateKey(new Date(seasonStartYear + 1, 5, 30)),
	}
}

function isToday(utcDate: string, now: Date): boolean {
	const matchDate = new Date(utcDate)
	return !Number.isNaN(matchDate.getTime()) && formatIsoDateKey(matchDate) === formatIsoDateKey(now)
}

function isPending(status: FootballMatch['status']): boolean {
	return status === 'SCHEDULED' || status === 'TIMED'
}

/**
 * Choose the cache TTL from already normalized matches.
 *
 * The snapshot is taken before kickoff, so a table full of `TIMED` matches
 * would otherwise be cached for hours and keep reporting a kickoff time long
 * after the match started. The TTL is therefore capped at the next kickoff.
 */
export function getFootballCacheTtl(matches: FootballMatch[], now: Date = new Date()): number {
	const isLive = matches.some(match => match.status === 'IN_PLAY' || match.status === 'PAUSED')
	if (isLive) return LIVE_CACHE_TTL

	const finishedToday = matches.some(match => match.status === 'FINISHED' && isToday(match.utcDate, now))
	let ttl = finishedToday ? ACTIVE_CACHE_TTL : STABLE_CACHE_TTL

	for (const match of matches) {
		if (!isPending(match.status)) continue

		const kickoff = Date.parse(match.utcDate)
		if (Number.isNaN(kickoff)) continue

		const untilKickoff = kickoff - now.getTime()
		// A kickoff already in the past means this snapshot predates it.
		if (untilKickoff < 0) return LIVE_CACHE_TTL

		ttl = Math.min(ttl, untilKickoff + KICKOFF_GRACE)
	}

	return Math.max(ttl, LIVE_CACHE_TTL)
}

/** How long before kickoff the calendar starts watching for the match to begin. */
const WATCH_AHEAD = 6 * 60 * 60 * 1000
/** A fixture is considered done three hours after kickoff. */
const MATCH_WINDOW = 3 * 60 * 60 * 1000

/**
 * Whether the calendar should keep a ticker alive at all.
 *
 * This is deliberately wider than `shouldPollMatches`: that predicate is false
 * until kickoff, and it is only re-evaluated when the data changes, so with a
 * page left open before kickoff nothing remained running to notice the match
 * starting. The ticker spans the gap and asks `shouldPollMatches` on each tick.
 */
export function shouldWatchMatches(matches: FootballMatch[], now: Date = new Date()): boolean {
	const nowMs = now.getTime()

	return matches.some(match => {
		if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return true
		if (!isPending(match.status)) return false

		const kickoff = Date.parse(match.utcDate)
		if (Number.isNaN(kickoff)) return false

		const sinceKickoff = nowMs - kickoff
		return sinceKickoff >= -WATCH_AHEAD && sinceKickoff <= MATCH_WINDOW
	})
}

/**
 * Whether the calendar should fetch right now: a match is running, or one should
 * have kicked off by now and the snapshot has not caught up yet. Kickoffs older
 * than three hours are ignored so an abandoned fixture cannot poll forever.
 */
export function shouldPollMatches(matches: FootballMatch[], now: Date = new Date()): boolean {
	const nowMs = now.getTime()

	return matches.some(match => {
		if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return true
		if (!isPending(match.status)) return false

		const kickoff = Date.parse(match.utcDate)
		if (Number.isNaN(kickoff)) return false

		const sinceKickoff = nowMs - kickoff
		return sinceKickoff >= -60 * 1000 && sinceKickoff <= MATCH_WINDOW
	})
}

// =============================================================================
// Fetch and Cache
// =============================================================================

/** Fetch, normalize, and manually cache one competition's match window. */
export async function fetchCompetitionMatches(
	competition: FootballCompetitionCode,
	window?: { dateFrom: string; dateTo: string }
): Promise<FootballFetchResult> {
	const matchWindow = window ?? getSeasonMatchWindow()
	const cacheKey = createCacheKey(competition, matchWindow.dateFrom, matchWindow.dateTo)

	try {
		const cached = await getCached<FootballMatch[]>(cacheKey, { prefix: CACHE_PREFIX })
		if (cached !== null) {
			return { ok: true, matches: cached }
		}

		const result = await sendMessage('footballDataRequest', {
			competition,
			dateFrom: matchWindow.dateFrom,
			dateTo: matchWindow.dateTo,
		})

		if (!result.ok) return result

		const matches = normalizeMatches(result.payload, competition)
		const ttl = getFootballCacheTtl(matches)
		await setCache(cacheKey, matches, { prefix: CACHE_PREFIX, ttl })

		return { ok: true, matches }
	} catch (error) {
		logger.error('Football data service request failed', error)
		return { ok: false, reason: 'network' }
	}
}

function readCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeStandingRow(value: unknown): FootballStandingRow | null {
	if (!isRecord(value)) return null

	const team = normalizeTeam(value.team)
	if (!team) return null
	if (typeof value.position !== 'number' || !Number.isFinite(value.position)) return null

	const goalsFor = readCount(value.goalsFor)
	const goalsAgainst = readCount(value.goalsAgainst)

	return {
		position: value.position,
		team,
		playedGames: readCount(value.playedGames),
		won: readCount(value.won),
		draw: readCount(value.draw),
		lost: readCount(value.lost),
		points: readCount(value.points),
		goalsFor,
		goalsAgainst,
		goalDifference:
			typeof value.goalDifference === 'number' && Number.isFinite(value.goalDifference)
				? value.goalDifference
				: goalsFor - goalsAgainst,
	}
}

/** Read the season's starting calendar year from the payload's season block. */
function readSeasonStartYear(payload: RawRecord): number | null {
	if (!isRecord(payload.season)) return null
	if (typeof payload.season.startDate !== 'string') return null

	const startDate = new Date(payload.season.startDate)
	return Number.isNaN(startDate.getTime()) ? null : startDate.getFullYear()
}

/**
 * Normalize the raw standings payload.
 *
 * The API returns one entry per table variant (overall, home, away) and per
 * group. Only the overall table is used, and the first one wins: a competition
 * split into groups would otherwise concatenate unrelated positions.
 */
export function normalizeStandings(payload: unknown): FootballStandings | null {
	if (!isRecord(payload) || !Array.isArray(payload.standings)) return null

	for (const entry of payload.standings) {
		if (!isRecord(entry)) continue
		if (entry.type !== 'TOTAL') continue
		if (!Array.isArray(entry.table)) continue

		const rows: FootballStandingRow[] = []
		for (const rawRow of entry.table) {
			const row = normalizeStandingRow(rawRow)
			if (row) rows.push(row)
		}

		if (rows.length === 0) continue

		return {
			stage: typeof entry.stage === 'string' ? entry.stage : '',
			seasonStartYear: readSeasonStartYear(payload),
			rows: rows.sort((left, right) => left.position - right.position),
		}
	}

	return null
}

/** Fetch, normalize, and cache one competition's current standings table. */
export async function fetchCompetitionStandings(
	competition: FootballCompetitionCode
): Promise<FootballStandingsFetchResult> {
	const cacheKey = createCacheKey('standings', competition)

	try {
		const cached = await getCached<FootballStandings>(cacheKey, { prefix: CACHE_PREFIX })
		if (cached !== null) {
			return { ok: true, standings: cached }
		}

		const result = await sendMessage('footballStandingsRequest', { competition })
		if (!result.ok) return result

		const standings = normalizeStandings(result.payload)
		if (standings === null) {
			return { ok: true, standings: { stage: '', seasonStartYear: null, rows: [] } }
		}

		await setCache(cacheKey, standings, { prefix: CACHE_PREFIX, ttl: STANDINGS_CACHE_TTL })

		return { ok: true, standings }
	} catch (error) {
		logger.error('Football standings service request failed', error)
		return { ok: false, reason: 'network' }
	}
}

/** Test the configured key directly without reading from or writing to the match cache. */
export async function testFootballDataConnection(): Promise<FootballDataResult> {
	const today = formatIsoDateKey(new Date())

	try {
		return await sendMessage('footballDataRequest', {
			competition: 'PD',
			dateFrom: today,
			dateTo: today,
		})
	} catch (error) {
		logger.error('Football data connection test failed', error)
		return { ok: false, reason: 'network' }
	}
}
