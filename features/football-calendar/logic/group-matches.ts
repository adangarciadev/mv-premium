import { formatIsoDateKey } from '@/lib/date-utils'
import type { FootballMatch } from '@/services'

export interface MatchDayGroup {
	/** Local calendar day, YYYY-MM-DD. */
	dayKey: string
	matches: FootballMatch[]
}

export interface CalendarSections {
	/** Fixtures involving favourite teams, upcoming only. Empty when none. */
	favorites: MatchDayGroup[]
	results: MatchDayGroup[]
	upcoming: MatchDayGroup[]
}

/** Partition matches into finished results and non-cancelled upcoming fixtures. */
export function partitionMatches(matches: FootballMatch[]): {
	results: FootballMatch[]
	upcoming: FootballMatch[]
} {
	const results = matches
		.filter(match => match.status === 'FINISHED')
		.slice()
		.sort((left, right) => Date.parse(right.utcDate) - Date.parse(left.utcDate))

	const upcoming = matches
		.filter(match => match.status !== 'FINISHED' && match.status !== 'CANCELLED')
		.slice()
		.sort((left, right) => Date.parse(left.utcDate) - Date.parse(right.utcDate))

	return { results, upcoming }
}

/** Group matches by their local calendar day while preserving input order. */
export function groupByLocalDay(matches: FootballMatch[]): MatchDayGroup[] {
	const groups = new Map<string, FootballMatch[]>()

	for (const match of matches) {
		const dayKey = formatIsoDateKey(new Date(match.utcDate))
		const dayMatches = groups.get(dayKey)

		if (dayMatches) {
			dayMatches.push(match)
		} else {
			groups.set(dayKey, [match])
		}
	}

	return Array.from(groups, ([dayKey, dayMatches]) => ({ dayKey, matches: dayMatches }))
}

export function isFavoriteMatch(match: FootballMatch, favoriteTeamIds: number[]): boolean {
	return favoriteTeamIds.includes(match.home.id) || favoriteTeamIds.includes(match.away.id)
}

export function filterFavorites(matches: FootballMatch[], favoriteTeamIds: number[]): FootballMatch[] {
	return matches.filter(match => isFavoriteMatch(match, favoriteTeamIds))
}

export function buildCalendarSections(
	matches: FootballMatch[],
	options: { favoriteTeamIds: number[]; onlyFavorites: boolean },
): CalendarSections {
	const { results, upcoming } = partitionMatches(matches)
	const favoriteResults = filterFavorites(results, options.favoriteTeamIds)
	const favoriteUpcoming = filterFavorites(upcoming, options.favoriteTeamIds)

	if (options.onlyFavorites) {
		return {
			favorites: [],
			results: groupByLocalDay(favoriteResults),
			upcoming: groupByLocalDay(favoriteUpcoming),
		}
	}

	return {
		favorites: groupByLocalDay(favoriteUpcoming),
		results: groupByLocalDay(results),
		upcoming: groupByLocalDay(upcoming),
	}
}

/** Build one ascending timeline for the horizontal football rail. */
export function buildMatchTimeline(
	matches: FootballMatch[],
	options: { favoriteTeamIds: number[]; onlyFavorites: boolean },
): MatchDayGroup[] {
	const visibleMatches = matches
		.filter(match => match.status !== 'CANCELLED')
		.filter(match => !options.onlyFavorites || isFavoriteMatch(match, options.favoriteTeamIds))
		.slice()
		.sort((left, right) => Date.parse(left.utcDate) - Date.parse(right.utcDate))

	return groupByLocalDay(visibleMatches)
}

export interface MatchdayGroup {
	/** Stable key: md-2 for league matchdays, stage-FINAL otherwise. */
	key: string
	matchday: number | null
	stage: string
	days: MatchDayGroup[]
}

/** Group non-cancelled matches by league matchday or knockout stage. */
export function groupByMatchday(
	matches: FootballMatch[],
	options: { favoriteTeamIds: number[]; onlyFavorites: boolean },
): MatchdayGroup[] {
	const visibleMatches = matches
		.filter(match => match.status !== 'CANCELLED')
		.filter(match => !options.onlyFavorites || isFavoriteMatch(match, options.favoriteTeamIds))
		.slice()
		.sort((left, right) => Date.parse(left.utcDate) - Date.parse(right.utcDate))

	const buckets = new Map<string, { matchday: number | null; stage: string; matches: FootballMatch[] }>()

	for (const match of visibleMatches) {
		const key = match.matchday !== null ? `md-${match.matchday}` : `stage-${match.stage}`
		const bucket = buckets.get(key)

		if (bucket) {
			bucket.matches.push(match)
		} else {
			buckets.set(key, {
				matchday: match.matchday,
				stage: match.stage,
				matches: [match],
			})
		}
	}

	return Array.from(buckets, ([key, bucket]) => ({
		key,
		matchday: bucket.matchday,
		stage: bucket.stage,
		days: groupByLocalDay(bucket.matches),
	}))
}

export function findCurrentMatchdayIndex(groups: MatchdayGroup[], now: Date = new Date()): number {
	if (groups.length === 0) return 0

	const todayKey = formatIsoDateKey(now)
	const todayIndex = groups.findIndex(group => group.days.some(day => day.dayKey === todayKey))
	if (todayIndex >= 0) return todayIndex

	const futureIndex = groups.findIndex(group => group.days.some(day => day.dayKey > todayKey))
	return futureIndex >= 0 ? futureIndex : groups.length - 1
}
