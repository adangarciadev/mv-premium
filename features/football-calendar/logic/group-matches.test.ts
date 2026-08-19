import { describe, expect, it } from 'vitest'
import type { FootballMatch, FootballTeam } from '@/services'
import {
	buildCalendarSections,
	buildMatchTimeline,
	filterFavorites,
	findCurrentMatchdayIndex,
	groupByMatchday,
	groupByLocalDay,
	isFavoriteMatch,
	partitionMatches,
} from './group-matches'

function createTeam(id: number): FootballTeam {
	return {
		id,
		name: `Team ${id}`,
		shortName: `T${id}`,
		tla: `T${id}`,
		crest: `https://example.com/${id}.png`,
	}
}

function createMatch(
	id: number,
	utcDate: string,
	status: FootballMatch['status'],
	homeId = id * 10,
	awayId = id * 10 + 1,
	overrides: Partial<FootballMatch> = {},
): FootballMatch {
	return {
		id,
		utcDate,
		status,
		competition: 'PD',
		matchday: 1,
		stage: 'REGULAR_SEASON',
		home: createTeam(homeId),
		away: createTeam(awayId),
		score: null,
		...overrides,
	}
}

function localIsoDate(year: number, month: number, day: number, hour: number): string {
	return new Date(year, month - 1, day, hour, 0, 0).toISOString()
}

function groupedMatchIds(groups: { matches: FootballMatch[] }[]): number[] {
	return groups.flatMap(group => group.matches.map(match => match.id))
}

describe('group-matches', () => {
	it('separates FINISHED matches from upcoming matches', () => {
		const finished = createMatch(1, '2026-08-19T18:00:00.000Z', 'FINISHED')
		const upcoming = createMatch(2, '2026-08-20T18:00:00.000Z', 'TIMED')

		const result = partitionMatches([finished, upcoming])

		expect(result.results).toEqual([finished])
		expect(result.upcoming).toEqual([upcoming])
	})

	it('sorts results descending and upcoming matches ascending by utcDate', () => {
		const finishedEarlier = createMatch(1, '2026-08-18T18:00:00.000Z', 'FINISHED')
		const finishedLater = createMatch(2, '2026-08-19T18:00:00.000Z', 'FINISHED')
		const upcomingLater = createMatch(3, '2026-08-21T18:00:00.000Z', 'TIMED')
		const upcomingEarlier = createMatch(4, '2026-08-20T18:00:00.000Z', 'SCHEDULED')

		const result = partitionMatches([finishedEarlier, upcomingLater, finishedLater, upcomingEarlier])

		expect(result.results.map(match => match.id)).toEqual([2, 1])
		expect(result.upcoming.map(match => match.id)).toEqual([4, 3])
	})

	it('excludes CANCELLED matches from both sections', () => {
		const cancelled = createMatch(1, '2026-08-19T18:00:00.000Z', 'CANCELLED')

		const result = partitionMatches([cancelled])

		expect(result.results).toEqual([])
		expect(result.upcoming).toEqual([])
	})

	it('keeps POSTPONED and SUSPENDED matches in upcoming', () => {
		const postponed = createMatch(1, '2026-08-20T18:00:00.000Z', 'POSTPONED')
		const suspended = createMatch(2, '2026-08-21T18:00:00.000Z', 'SUSPENDED')

		const result = partitionMatches([postponed, suspended])

		expect(result.upcoming).toEqual([postponed, suspended])
	})

	it('does not mutate the input array or its ordering', () => {
		const matches = [
			createMatch(1, '2026-08-19T18:00:00.000Z', 'FINISHED'),
			createMatch(2, '2026-08-18T18:00:00.000Z', 'TIMED'),
		]
		const original = [...matches]

		partitionMatches(matches)

		expect(matches).toEqual(original)
		expect(matches[0]).toBe(original[0])
		expect(matches[1]).toBe(original[1])
	})

	it('groups matches on the same local calendar day together', () => {
		const first = createMatch(1, localIsoDate(2026, 8, 19, 10), 'TIMED')
		const second = createMatch(2, localIsoDate(2026, 8, 19, 22), 'TIMED')

		const groups = groupByLocalDay([first, second])

		expect(groups).toEqual([{ dayKey: '2026-08-19', matches: [first, second] }])
	})

	it('preserves group order and match order from the input', () => {
		const firstDayFirst = createMatch(1, localIsoDate(2026, 8, 20, 10), 'TIMED')
		const secondDay = createMatch(2, localIsoDate(2026, 8, 19, 10), 'TIMED')
		const firstDaySecond = createMatch(3, localIsoDate(2026, 8, 20, 20), 'TIMED')

		const groups = groupByLocalDay([firstDayFirst, secondDay, firstDaySecond])

		expect(groups.map(group => group.dayKey)).toEqual(['2026-08-20', '2026-08-19'])
		expect(groups[0].matches).toEqual([firstDayFirst, firstDaySecond])
		expect(groups[1].matches).toEqual([secondDay])
	})

	it('recognizes home and away favorites and rejects an empty favorite list', () => {
		const homeFavorite = createMatch(1, '2026-08-19T18:00:00.000Z', 'TIMED', 10, 20)
		const awayFavorite = createMatch(2, '2026-08-20T18:00:00.000Z', 'TIMED', 30, 10)
		const otherMatch = createMatch(3, '2026-08-21T18:00:00.000Z', 'TIMED', 40, 50)

		expect(isFavoriteMatch(homeFavorite, [10])).toBe(true)
		expect(isFavoriteMatch(awayFavorite, [10])).toBe(true)
		expect(isFavoriteMatch(otherMatch, [])).toBe(false)
		expect(filterFavorites([homeFavorite, awayFavorite, otherMatch], [10])).toEqual([
			homeFavorite,
			awayFavorite,
		])
	})

	it('builds upcoming favorite matches separately without duplicating results', () => {
		const finishedFavorite = createMatch(1, '2026-08-18T18:00:00.000Z', 'FINISHED', 10, 20)
		const upcomingFavorite = createMatch(2, '2026-08-20T18:00:00.000Z', 'TIMED', 30, 10)
		const upcomingOther = createMatch(3, '2026-08-21T18:00:00.000Z', 'SCHEDULED', 40, 50)

		const sections = buildCalendarSections([finishedFavorite, upcomingFavorite, upcomingOther], {
			favoriteTeamIds: [10],
			onlyFavorites: false,
		})

		expect(groupedMatchIds(sections.favorites)).toEqual([2])
		expect(groupedMatchIds(sections.results)).toEqual([1])
		expect(groupedMatchIds(sections.upcoming)).toEqual([2, 3])
	})

	it('filters results and upcoming to favorites when onlyFavorites is enabled', () => {
		const finishedFavorite = createMatch(1, '2026-08-18T18:00:00.000Z', 'FINISHED', 10, 20)
		const finishedOther = createMatch(2, '2026-08-19T18:00:00.000Z', 'FINISHED', 30, 40)
		const upcomingFavorite = createMatch(3, '2026-08-20T18:00:00.000Z', 'TIMED', 50, 10)
		const upcomingOther = createMatch(4, '2026-08-21T18:00:00.000Z', 'SCHEDULED', 60, 70)

		const sections = buildCalendarSections(
			[finishedFavorite, finishedOther, upcomingFavorite, upcomingOther],
			{ favoriteTeamIds: [10], onlyFavorites: true },
		)

		expect(sections.favorites).toEqual([])
		expect(groupedMatchIds(sections.results)).toEqual([1])
		expect(groupedMatchIds(sections.upcoming)).toEqual([3])
	})

	describe('buildMatchTimeline()', () => {
		it('sorts every match chronologically', () => {
			const later = createMatch(1, '2026-08-21T18:00:00.000Z', 'TIMED')
			const earlier = createMatch(2, '2026-08-19T18:00:00.000Z', 'FINISHED')

			const groups = buildMatchTimeline([later, earlier], {
				favoriteTeamIds: [],
				onlyFavorites: false,
			})

			expect(groupedMatchIds(groups)).toEqual([2, 1])
		})

		it('excludes CANCELLED matches from the timeline', () => {
			const active = createMatch(1, '2026-08-19T18:00:00.000Z', 'TIMED')
			const cancelled = createMatch(2, '2026-08-20T18:00:00.000Z', 'CANCELLED')

			const groups = buildMatchTimeline([active, cancelled], {
				favoriteTeamIds: [],
				onlyFavorites: false,
			})

			expect(groupedMatchIds(groups)).toEqual([1])
		})

		it('groups matches by their local day', () => {
			const first = createMatch(1, localIsoDate(2026, 8, 19, 10), 'TIMED')
			const second = createMatch(2, localIsoDate(2026, 8, 19, 22), 'FINISHED')
			const third = createMatch(3, localIsoDate(2026, 8, 20, 10), 'TIMED')

			const groups = buildMatchTimeline([third, second, first], {
				favoriteTeamIds: [],
				onlyFavorites: false,
			})

			expect(groups.map(group => group.dayKey)).toEqual(['2026-08-19', '2026-08-20'])
			expect(groupedMatchIds(groups)).toEqual([1, 2, 3])
		})

		it('filters to favourite teams before grouping', () => {
			const favourite = createMatch(1, '2026-08-19T18:00:00.000Z', 'TIMED', 10, 20)
			const other = createMatch(2, '2026-08-20T18:00:00.000Z', 'TIMED', 30, 40)

			const groups = buildMatchTimeline([other, favourite], {
				favoriteTeamIds: [10],
				onlyFavorites: true,
			})

			expect(groupedMatchIds(groups)).toEqual([1])
		})
	})

	describe('groupByMatchday()', () => {
		it('groups league matches by matchday', () => {
			const first = createMatch(1, localIsoDate(2026, 8, 19, 18), 'TIMED', 10, 20, { matchday: 2 })
			const second = createMatch(2, localIsoDate(2026, 8, 20, 18), 'TIMED', 30, 40, { matchday: 2 })
			const third = createMatch(3, localIsoDate(2026, 8, 21, 18), 'TIMED', 50, 60, { matchday: 3 })

			const groups = groupByMatchday([third, second, first], { favoriteTeamIds: [], onlyFavorites: false })

			expect(groups.map(group => group.key)).toEqual(['md-2', 'md-3'])
			expect(groups[0].days.flatMap(day => day.matches.map(match => match.id))).toEqual([1, 2])
		})

		it('groups knockout matches by stage when matchday is null', () => {
			const first = createMatch(1, localIsoDate(2026, 8, 19, 18), 'TIMED', 10, 20, {
				matchday: null,
				stage: 'SEMI_FINALS',
			})
			const second = createMatch(2, localIsoDate(2026, 8, 20, 18), 'TIMED', 30, 40, {
				matchday: null,
				stage: 'SEMI_FINALS',
			})
			const final = createMatch(3, localIsoDate(2026, 8, 21, 18), 'TIMED', 50, 60, {
				matchday: null,
				stage: 'FINAL',
			})

			const groups = groupByMatchday([final, second, first], { favoriteTeamIds: [], onlyFavorites: false })

			expect(groups.map(group => [group.key, group.matchday, group.stage])).toEqual([
				['stage-SEMI_FINALS', null, 'SEMI_FINALS'],
				['stage-FINAL', null, 'FINAL'],
			])
		})

		it('orders groups by the first match date', () => {
			const laterMatchday = createMatch(1, localIsoDate(2026, 8, 21, 18), 'TIMED', 10, 20, { matchday: 5 })
			const earlierMatchday = createMatch(2, localIsoDate(2026, 8, 19, 18), 'TIMED', 30, 40, { matchday: 4 })

			const groups = groupByMatchday([laterMatchday, earlierMatchday], { favoriteTeamIds: [], onlyFavorites: false })

			expect(groups.map(group => group.matchday)).toEqual([4, 5])
		})

		it('filters groups to favourite teams when requested', () => {
			const favourite = createMatch(1, localIsoDate(2026, 8, 19, 18), 'TIMED', 10, 20, { matchday: 2 })
			const other = createMatch(2, localIsoDate(2026, 8, 20, 18), 'TIMED', 30, 40, { matchday: 3 })

			const groups = groupByMatchday([other, favourite], { favoriteTeamIds: [10], onlyFavorites: true })

			expect(groups.map(group => group.key)).toEqual(['md-2'])
		})
	})

	describe('findCurrentMatchdayIndex()', () => {
		it('selects the group containing today', () => {
			const groups = groupByMatchday(
				[
					createMatch(1, localIsoDate(2026, 8, 18, 18), 'TIMED', 10, 20, { matchday: 1 }),
					createMatch(2, localIsoDate(2026, 8, 19, 18), 'TIMED', 30, 40, { matchday: 2 }),
				],
				{ favoriteTeamIds: [], onlyFavorites: false },
			)

			expect(findCurrentMatchdayIndex(groups, new Date(2026, 7, 19, 12))).toBe(1)
		})

		it('selects the next future group when today has no matches', () => {
			const groups = groupByMatchday(
				[
					createMatch(1, localIsoDate(2026, 8, 18, 18), 'TIMED', 10, 20, { matchday: 1 }),
					createMatch(2, localIsoDate(2026, 8, 21, 18), 'TIMED', 30, 40, { matchday: 2 }),
				],
				{ favoriteTeamIds: [], onlyFavorites: false },
			)

			expect(findCurrentMatchdayIndex(groups, new Date(2026, 7, 19, 12))).toBe(1)
		})

		it('selects the last group when every match is in the past', () => {
			const groups = groupByMatchday(
				[
					createMatch(1, localIsoDate(2026, 8, 17, 18), 'TIMED', 10, 20, { matchday: 1 }),
					createMatch(2, localIsoDate(2026, 8, 18, 18), 'TIMED', 30, 40, { matchday: 2 }),
				],
				{ favoriteTeamIds: [], onlyFavorites: false },
			)

			expect(findCurrentMatchdayIndex(groups, new Date(2026, 7, 19, 12))).toBe(1)
		})

		it('returns zero for an empty list', () => {
			expect(findCurrentMatchdayIndex([], new Date(2026, 7, 19, 12))).toBe(0)
		})
	})
})
