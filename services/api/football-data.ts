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
import type { FootballDataResult } from '@/lib/messaging'

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
	home: FootballTeam
	away: FootballTeam
	score: FootballScore | null
}

export type FootballFetchResult =
	| { ok: true; matches: FootballMatch[] }
	| { ok: false; reason: 'no-key' | 'invalid-key' | 'quota-exceeded' | 'network' }

// =============================================================================
// Constants
// =============================================================================

const CACHE_PREFIX = 'mv-football-v1'
const ACTIVE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const STABLE_CACHE_TTL = CACHE_TTL.HOUR * 6

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

	return {
		id: value.id,
		utcDate: value.utcDate,
		status: value.status,
		competition,
		matchday,
		stage,
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

/** Return the default local-calendar request window around the given date. */
export function getDefaultMatchWindow(now: Date = new Date()): { dateFrom: string; dateTo: string } {
	const dateFrom = new Date(now.getTime())
	dateFrom.setDate(dateFrom.getDate() - 7)

	const dateTo = new Date(now.getTime())
	dateTo.setDate(dateTo.getDate() + 14)

	return {
		dateFrom: formatIsoDateKey(dateFrom),
		dateTo: formatIsoDateKey(dateTo),
	}
}

function isToday(utcDate: string, now: Date): boolean {
	const matchDate = new Date(utcDate)
	return !Number.isNaN(matchDate.getTime()) && formatIsoDateKey(matchDate) === formatIsoDateKey(now)
}

/** Choose the cache TTL from already normalized matches. */
export function getFootballCacheTtl(matches: FootballMatch[], now: Date = new Date()): number {
	const needsFrequentRefresh = matches.some(
		match =>
			match.status === 'IN_PLAY' ||
			match.status === 'PAUSED' ||
			(match.status === 'FINISHED' && isToday(match.utcDate, now))
	)

	return needsFrequentRefresh ? ACTIVE_CACHE_TTL : STABLE_CACHE_TTL
}

// =============================================================================
// Fetch and Cache
// =============================================================================

/** Fetch, normalize, and manually cache one competition's match window. */
export async function fetchCompetitionMatches(
	competition: FootballCompetitionCode,
	window?: { dateFrom: string; dateTo: string }
): Promise<FootballFetchResult> {
	const matchWindow = window ?? getDefaultMatchWindow()
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
