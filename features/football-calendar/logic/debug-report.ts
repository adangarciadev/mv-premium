import { shouldPollMatches, shouldWatchMatches, type FootballMatch } from '@/services'

/** Matches the cache prefix used by the football service. */
const CACHE_PREFIX = 'mv-football-v2:'

export interface FootballDebugRow {
	clave: string
	partidos: number
	enJuego: number
	proximoSaque: string
	cacheEscrito: string
	cacheCaduca: string
	deberiaSondear: string
	tickerActivo: string
}

interface CacheEntryLike {
	data: unknown
	timestamp: unknown
	expiresAt: unknown
}

function isCacheEntry(value: unknown): value is CacheEntryLike {
	return value !== null && typeof value === 'object' && 'data' in value && 'expiresAt' in value
}

function isMatchArray(value: unknown): value is FootballMatch[] {
	return Array.isArray(value) && value.every(item => item !== null && typeof item === 'object' && 'utcDate' in item)
}

function formatRelative(ms: number): string {
	const seconds = Math.round(Math.abs(ms) / 1000)
	const rendered = seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`

	return ms < 0 ? `hace ${rendered}` : `en ${rendered}`
}

function describeNextKickoff(matches: FootballMatch[], now: Date): string {
	const upcoming = matches
		.filter(match => match.status === 'SCHEDULED' || match.status === 'TIMED')
		.map(match => Date.parse(match.utcDate))
		.filter(time => !Number.isNaN(time) && time >= now.getTime())
		.sort((left, right) => left - right)

	return upcoming.length === 0 ? '—' : formatRelative(upcoming[0] - now.getTime())
}

/**
 * Summarize the football cache for the `mvpDebug()` support helper.
 *
 * Everything comes from the persisted cache, so a user can run one command and
 * report whether their card is stale, whether the poll should be running, and
 * how much life the cached snapshot has left.
 */
export function buildFootballDebugReport(
	storageSnapshot: Record<string, unknown>,
	now: Date = new Date()
): FootballDebugRow[] {
	return Object.entries(storageSnapshot)
		.filter(([key]) => key.startsWith(CACHE_PREFIX))
		.map(([key, value]) => {
			const shortKey = key.slice(CACHE_PREFIX.length)

			if (!isCacheEntry(value) || !isMatchArray(value.data)) {
				return {
					clave: shortKey,
					partidos: 0,
					enJuego: 0,
					proximoSaque: '—',
					cacheEscrito: '—',
					cacheCaduca: '—',
					deberiaSondear: '—',
					tickerActivo: '—',
				}
			}

			const matches = value.data
			const expiresAt = typeof value.expiresAt === 'number' ? value.expiresAt : null
			const timestamp = typeof value.timestamp === 'number' ? value.timestamp : null

			return {
				clave: shortKey,
				partidos: matches.length,
				enJuego: matches.filter(match => match.status === 'IN_PLAY' || match.status === 'PAUSED').length,
				proximoSaque: describeNextKickoff(matches, now),
				cacheEscrito: timestamp === null ? '—' : formatRelative(timestamp - now.getTime()),
				cacheCaduca:
					expiresAt === null ? '—' : expiresAt <= now.getTime() ? 'caducado' : formatRelative(expiresAt - now.getTime()),
				deberiaSondear: shouldPollMatches(matches, now) ? 'sí' : 'no',
				tickerActivo: shouldWatchMatches(matches, now) ? 'sí' : 'no',
			}
		})
}
