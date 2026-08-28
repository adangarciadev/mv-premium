import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	sendMessage: vi.fn(),
	getCached: vi.fn(),
	setCache: vi.fn(),
	createCacheKey: vi.fn((...parts: (string | number)[]) => parts.join(':')),
	logger: {
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock('@/lib/messaging', () => ({
	sendMessage: mocks.sendMessage,
}))

vi.mock('@/lib/logger', () => ({
	logger: mocks.logger,
}))

vi.mock('@/services/media', () => ({
	getCached: mocks.getCached,
	setCache: mocks.setCache,
	createCacheKey: mocks.createCacheKey,
	CACHE_TTL: {
		HOUR: 60 * 60 * 1000,
	},
}))

import {
	fetchCompetitionMatches,
	getSeasonMatchWindow,
	normalizeStandings,
	shouldPollMatches,
	shouldWatchMatches,
	getFootballCacheTtl,
	normalizeMatches,
	testFootballDataConnection,
	type FootballMatch,
} from './football-data'

const WINDOW = {
	dateFrom: '2026-08-12',
	dateTo: '2026-09-02',
}

const finishedLaLigaMatch = {
	id: 564634,
	utcDate: '2026-08-15T17:30:00Z',
	status: 'FINISHED',
	matchday: 1,
	stage: 'REGULAR_SEASON',
	group: null,
	homeTeam: {
		id: 263,
		name: 'Deportivo Alavés',
		shortName: 'Alavés',
		tla: 'ALA',
		crest: 'https://crests.football-data.org/263.png',
	},
	awayTeam: {
		id: 82,
		name: 'Getafe CF',
		shortName: 'Getafe',
		tla: 'GET',
		crest: 'https://crests.football-data.org/82.png',
	},
	score: {
		winner: 'HOME_TEAM',
		duration: 'REGULAR',
		fullTime: { home: 3, away: 0 },
		halfTime: { home: 0, away: 0 },
	},
}

const unplayedLaLigaMatch = {
	id: 564628,
	utcDate: '2026-08-19T19:00:00Z',
	status: 'TIMED',
	matchday: 1,
	stage: 'REGULAR_SEASON',
	group: null,
	homeTeam: {
		id: 78,
		name: 'Club Atlético de Madrid',
		shortName: 'Atleti',
		tla: 'ATL',
		crest: 'https://crests.football-data.org/78.png',
	},
	awayTeam: {
		id: 84,
		name: 'Málaga CF',
		shortName: 'Málaga',
		tla: 'MAL',
		crest: 'https://crests.football-data.org/84.png',
	},
	score: {
		winner: null,
		duration: 'REGULAR',
		fullTime: { home: null, away: null },
		halfTime: { home: null, away: null },
	},
}

const penaltyShootoutChampionsMatch = {
	id: 552096,
	utcDate: '2026-05-30T16:00:00Z',
	status: 'FINISHED',
	matchday: null,
	stage: 'FINAL',
	group: null,
	homeTeam: {
		id: 524,
		name: 'Paris Saint-Germain FC',
		shortName: 'PSG',
		tla: 'PSG',
		crest: 'https://crests.football-data.org/524.png',
	},
	awayTeam: {
		id: 57,
		name: 'Arsenal FC',
		shortName: 'Arsenal',
		tla: 'ARS',
		crest: 'https://crests.football-data.org/57.png',
	},
	score: {
		winner: 'HOME_TEAM',
		duration: 'PENALTY_SHOOTOUT',
		fullTime: { home: 5, away: 4 },
		halfTime: { home: 0, away: 1 },
		regularTime: { home: 1, away: 1 },
		extraTime: { home: 0, away: 0 },
		penalties: { home: 4, away: 3 },
	},
}

function normalizeFixture(payload: unknown, competition: 'PD' | 'CL' = 'PD'): FootballMatch {
	const [match] = normalizeMatches(payload, competition)
	if (!match) throw new Error('Expected fixture to normalize')
	return match
}

describe('football-data service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getCached.mockResolvedValue(null)
		mocks.setCache.mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('normalizes a regular-time result without penalty metadata', () => {
		const [match] = normalizeMatches({ matches: [finishedLaLigaMatch] }, 'PD')

		expect(match).toMatchObject({
			id: 564634,
			competition: 'PD',
			matchday: 1,
			stage: 'REGULAR_SEASON',
			score: {
				home: 3,
				away: 0,
				decidedBeyondRegularTime: false,
				penalties: null,
			},
		})
	})

	it('normalizes an unplayed match with a null score', () => {
		const [match] = normalizeMatches({ matches: [unplayedLaLigaMatch] }, 'PD')

		expect(match?.score).toBeNull()
		expect(match?.matchday).toBe(1)
	})

	it('uses regular time and separate penalties for a penalty shootout', () => {
		const [match] = normalizeMatches({ matches: [penaltyShootoutChampionsMatch] }, 'CL')

		expect(match?.score).toEqual({
			home: 1,
			away: 1,
			decidedBeyondRegularTime: true,
			penalties: { home: 4, away: 3 },
		})
		expect(match?.score).not.toMatchObject({ home: 5, away: 4 })
		expect(match?.matchday).toBeNull()
	})

	it('adds non-zero extra time to regular time in a shootout score', () => {
		const matchWithExtraTime = {
			...penaltyShootoutChampionsMatch,
			score: {
				...penaltyShootoutChampionsMatch.score,
				regularTime: { home: 1, away: 1 },
				extraTime: { home: 1, away: 0 },
			},
		}
		const [match] = normalizeMatches({ matches: [matchWithExtraTime] }, 'CL')

		expect(match?.score).toEqual({
			home: 2,
			away: 1,
			decidedBeyondRegularTime: true,
			penalties: { home: 4, away: 3 },
		})
	})

	it('uses full time and no penalties for an extra-time decision', () => {
		const extraTimeMatch = {
			...penaltyShootoutChampionsMatch,
			score: {
				...penaltyShootoutChampionsMatch.score,
				duration: 'EXTRA_TIME',
				fullTime: { home: 2, away: 1 },
			},
		}
		const [match] = normalizeMatches({ matches: [extraTimeMatch] }, 'CL')

		expect(match?.score).toEqual({
			home: 2,
			away: 1,
			decidedBeyondRegularTime: true,
			penalties: null,
		})
	})

	it('returns an empty list for invalid payload containers', () => {
		expect(normalizeMatches(null, 'PD')).toEqual([])
		expect(normalizeMatches({ matches: 'not-an-array' }, 'PD')).toEqual([])
	})

	it('discards malformed entries and logs one aggregate warning', () => {
		const result = normalizeMatches(
			{ matches: [{ id: 1 }, finishedLaLigaMatch, unplayedLaLigaMatch] },
			'PD'
		)

		expect(result).toHaveLength(2)
		expect(mocks.logger.warn).toHaveBeenCalledTimes(1)
		expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining('1'))
	})

	it('accepts an empty matches array as a successful empty result', async () => {
		mocks.sendMessage.mockResolvedValue({
			ok: true,
			payload: { matches: [] },
			requestsRemaining: 10,
		})

		const result = await fetchCompetitionMatches('CL', WINDOW)

		expect(result).toEqual({ ok: true, matches: [] })
		expect(mocks.setCache).toHaveBeenCalledTimes(1)
	})

	it('spans the whole season for a date in the first half of the campaign', () => {
		expect(getSeasonMatchWindow(new Date(2026, 7, 19, 12, 0, 0))).toEqual({
			dateFrom: '2026-07-01',
			dateTo: '2027-06-30',
		})
	})

	it('keeps the same season window for a date after the new year', () => {
		expect(getSeasonMatchWindow(new Date(2027, 2, 4, 12, 0, 0))).toEqual({
			dateFrom: '2026-07-01',
			dateTo: '2027-06-30',
		})
	})

	describe('normalizeStandings()', () => {
		const team = (id: number, name: string) => ({
			id,
			name,
			shortName: name,
			tla: name.slice(0, 3).toUpperCase(),
			crest: `https://example.com/${id}.png`,
		})

		const row = (position: number, id: number, name: string, overrides: Record<string, unknown> = {}) => ({
			position,
			team: team(id, name),
			playedGames: 3,
			won: 2,
			draw: 1,
			lost: 0,
			points: 7,
			goalsFor: 5,
			goalsAgainst: 2,
			goalDifference: 3,
			...overrides,
		})

		it('reads the overall table and ignores home and away variants', () => {
			const standings = normalizeStandings({
				standings: [
					{ stage: 'REGULAR_SEASON', type: 'HOME', table: [row(1, 10, 'Casa')] },
					{ stage: 'REGULAR_SEASON', type: 'TOTAL', table: [row(1, 20, 'Total')] },
					{ stage: 'REGULAR_SEASON', type: 'AWAY', table: [row(1, 30, 'Fuera')] },
				],
			})

			expect(standings?.stage).toBe('REGULAR_SEASON')
			expect(standings?.rows.map(entry => entry.team.name)).toEqual(['Total'])
		})

		it('sorts rows by position', () => {
			const standings = normalizeStandings({
				standings: [
					{
						stage: 'LEAGUE_STAGE',
						type: 'TOTAL',
						table: [row(3, 30, 'Tercero'), row(1, 10, 'Primero'), row(2, 20, 'Segundo')],
					},
				],
			})

			expect(standings?.rows.map(entry => entry.position)).toEqual([1, 2, 3])
		})

		it('derives the goal difference when the payload omits it', () => {
			const standings = normalizeStandings({
				standings: [
					{
						stage: 'REGULAR_SEASON',
						type: 'TOTAL',
						table: [row(1, 10, 'Casa', { goalDifference: null, goalsFor: 7, goalsAgainst: 3 })],
					},
				],
			})

			expect(standings?.rows[0].goalDifference).toBe(4)
		})

		it('skips rows without a usable team', () => {
			const standings = normalizeStandings({
				standings: [
					{
						stage: 'REGULAR_SEASON',
						type: 'TOTAL',
						table: [row(1, 10, 'Casa'), { position: 2, team: { id: 'nope' } }],
					},
				],
			})

			expect(standings?.rows).toHaveLength(1)
		})

		it('reads the season the table belongs to', () => {
			const standings = normalizeStandings({
				season: { startDate: '2025-08-15', endDate: '2026-05-24' },
				standings: [{ stage: 'REGULAR_SEASON', type: 'TOTAL', table: [row(1, 10, 'Casa')] }],
			})

			expect(standings?.seasonStartYear).toBe(2025)
		})

		it('leaves the season empty when the payload omits it', () => {
			const standings = normalizeStandings({
				standings: [{ stage: 'REGULAR_SEASON', type: 'TOTAL', table: [row(1, 10, 'Casa')] }],
			})

			expect(standings?.seasonStartYear).toBeNull()
		})

		it('returns null for a payload without an overall table', () => {
			expect(normalizeStandings({ standings: [{ type: 'HOME', table: [row(1, 10, 'Casa')] }] })).toBeNull()
			expect(normalizeStandings({ standings: [] })).toBeNull()
			expect(normalizeStandings(null)).toBeNull()
		})
	})

	it('never caches past the next kickoff', () => {
		const now = new Date(2026, 7, 19, 18, 0, 0)
		const kickoffIn20Minutes = normalizeFixture(
			{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 19, 18, 20, 0).toISOString() }] },
			'PD'
		)

		// The old rule cached this snapshot for six hours and kept showing a
		// kickoff time long after the match had started.
		expect(getFootballCacheTtl([kickoffIn20Minutes], now)).toBe(20 * 60 * 1000 + 30 * 1000)
	})

	it('expires immediately when a kickoff has already passed', () => {
		const now = new Date(2026, 7, 19, 21, 0, 0)
		const startedButStillTimed = normalizeFixture(
			{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 19, 20, 30, 0).toISOString() }] },
			'PD'
		)

		expect(getFootballCacheTtl([startedButStillTimed], now)).toBe(30 * 1000)
	})

	describe('shouldWatchMatches()', () => {
		const now = new Date(2026, 7, 19, 18, 30, 0)

		// The regression: the poll predicate is false half an hour before kickoff,
		// so nothing was left running to notice the match starting. The watch
		// predicate keeps a ticker alive across that gap.
		it('watches a match that has not kicked off yet', () => {
			const inHalfAnHour = normalizeFixture(
				{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 19, 19, 0, 0).toISOString() }] },
				'PD'
			)

			expect(shouldPollMatches([inHalfAnHour], now)).toBe(false)
			expect(shouldWatchMatches([inHalfAnHour], now)).toBe(true)
		})

		it('watches a match that is being played', () => {
			const live = normalizeFixture({ matches: [{ ...unplayedLaLigaMatch, status: 'IN_PLAY' }] }, 'PD')

			expect(shouldWatchMatches([live], now)).toBe(true)
		})

		it('ignores a match still more than six hours away', () => {
			const tomorrow = normalizeFixture(
				{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 20, 19, 0, 0).toISOString() }] },
				'PD'
			)

			expect(shouldWatchMatches([tomorrow], now)).toBe(false)
		})

		it('stops watching once the matchday is over', () => {
			const finished = normalizeFixture({ matches: [finishedLaLigaMatch] }, 'PD')

			expect(shouldWatchMatches([finished], now)).toBe(false)
		})
	})

	describe('shouldPollMatches()', () => {
		const now = new Date(2026, 7, 19, 21, 0, 0)

		it('polls while a match is being played', () => {
			const live = normalizeFixture({ matches: [{ ...unplayedLaLigaMatch, status: 'IN_PLAY' }] }, 'PD')

			expect(shouldPollMatches([live], now)).toBe(true)
		})

		it('polls when a kickoff has passed but the snapshot still shows it as scheduled', () => {
			const stale = normalizeFixture(
				{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 19, 20, 30, 0).toISOString() }] },
				'PD'
			)

			expect(shouldPollMatches([stale], now)).toBe(true)
		})

		it('does not poll for a match that is still hours away', () => {
			const later = normalizeFixture(
				{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 20, 20, 30, 0).toISOString() }] },
				'PD'
			)

			expect(shouldPollMatches([later], now)).toBe(false)
		})

		it('stops polling an abandoned fixture whose kickoff is long past', () => {
			const abandoned = normalizeFixture(
				{ matches: [{ ...unplayedLaLigaMatch, status: 'TIMED', utcDate: new Date(2026, 7, 19, 12, 0, 0).toISOString() }] },
				'PD'
			)

			expect(shouldPollMatches([abandoned], now)).toBe(false)
		})

		it('does not poll a finished matchday', () => {
			const finished = normalizeFixture({ matches: [finishedLaLigaMatch] }, 'PD')

			expect(shouldPollMatches([finished], now)).toBe(false)
		})
	})

	it('selects the short TTL for active or today-finished matches', () => {
		const now = new Date(2026, 7, 19, 12, 0, 0)
		const activeMatch = normalizeFixture(
			{ matches: [{ ...unplayedLaLigaMatch, status: 'IN_PLAY' }] },
			'PD'
		)
		const finishedToday = normalizeFixture(
			{ matches: [{ ...finishedLaLigaMatch, utcDate: '2026-08-19T08:00:00Z' }] },
			'PD'
		)

		expect(getFootballCacheTtl([activeMatch], now)).toBe(30 * 1000)
		expect(getFootballCacheTtl([finishedToday], now)).toBe(10 * 60 * 1000)
	})

	it('selects the long TTL when all matches are in the future', () => {
		const futureMatch = normalizeFixture(
			{ matches: [{ ...unplayedLaLigaMatch, utcDate: '2026-08-20T19:00:00Z' }] },
			'PD'
		)

		expect(getFootballCacheTtl([futureMatch], new Date(2026, 7, 19, 12, 0, 0))).toBe(6 * 60 * 60 * 1000)
	})

	it('returns cached matches without calling the background', async () => {
		const cachedMatches = [normalizeFixture({ matches: [finishedLaLigaMatch] }, 'PD')]
		mocks.getCached.mockResolvedValue(cachedMatches)

		const result = await fetchCompetitionMatches('PD', WINDOW)

		expect(result).toEqual({ ok: true, matches: cachedMatches })
		expect(mocks.createCacheKey).toHaveBeenCalledWith('PD', WINDOW.dateFrom, WINDOW.dateTo)
		expect(mocks.sendMessage).not.toHaveBeenCalled()
		expect(mocks.setCache).not.toHaveBeenCalled()
	})

	it('normalizes, caches, and returns successful background data', async () => {
		mocks.sendMessage.mockResolvedValue({
			ok: true,
			payload: { matches: [finishedLaLigaMatch] },
			requestsRemaining: 10,
		})

		const result = await fetchCompetitionMatches('PD', WINDOW)

		expect(result).toMatchObject({ ok: true })
		expect(mocks.sendMessage).toHaveBeenCalledWith('footballDataRequest', {
			competition: 'PD',
			dateFrom: WINDOW.dateFrom,
			dateTo: WINDOW.dateTo,
		})
		expect(mocks.setCache).toHaveBeenCalledWith(
			'PD:2026-08-12:2026-09-02',
			expect.any(Array),
			expect.objectContaining({ prefix: 'mv-football-v2', ttl: 6 * 60 * 60 * 1000 })
		)
	})

	it('propagates background failures without writing them to cache', async () => {
		mocks.sendMessage.mockResolvedValue({ ok: false, reason: 'quota-exceeded' })

		const result = await fetchCompetitionMatches('PD', WINDOW)

		expect(result).toEqual({ ok: false, reason: 'quota-exceeded' })
		expect(mocks.setCache).not.toHaveBeenCalled()
	})

	it('tests the connection with the current local calendar day without using the cache', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 7, 19, 23, 30, 0))
		mocks.sendMessage.mockResolvedValue({ ok: false, reason: 'invalid-key' })

		const result = await testFootballDataConnection()

		expect(result).toEqual({ ok: false, reason: 'invalid-key' })
		expect(mocks.sendMessage).toHaveBeenCalledWith('footballDataRequest', {
			competition: 'PD',
			dateFrom: '2026-08-19',
			dateTo: '2026-08-19',
		})
		expect(mocks.getCached).not.toHaveBeenCalled()
		expect(mocks.setCache).not.toHaveBeenCalled()
	})
})
