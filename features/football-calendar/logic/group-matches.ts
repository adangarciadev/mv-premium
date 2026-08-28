import { formatIsoDateKey } from '@/lib/date-utils'
import type { FootballMatch } from '@/services'

export interface MatchDayGroup {
	/** Local calendar day, YYYY-MM-DD. */
	dayKey: string
	matches: FootballMatch[]
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

	return (
		Array.from(buckets, ([key, bucket]) => ({
			key,
			matchday: bucket.matchday,
			stage: bucket.stage,
			days: groupByLocalDay(bucket.matches),
		}))
			// Numbered matchdays run in league order: a fixture moved forward must not
			// place matchday 6 before matchday 5. Knockout stages keep their
			// chronological order through the stable sort.
			.sort((left, right) =>
				left.matchday !== null && right.matchday !== null ? left.matchday - right.matchday : 0,
			)
	)
}

export function findCurrentMatchdayIndex(groups: MatchdayGroup[], now: Date = new Date()): number {
	if (groups.length === 0) return 0

	const todayKey = formatIsoDateKey(now)
	const todayIndex = groups.findIndex(group => group.days.some(day => day.dayKey === todayKey))
	if (todayIndex >= 0) return todayIndex

	const futureIndex = groups.findIndex(group => group.days.some(day => day.dayKey > todayKey))
	return futureIndex >= 0 ? futureIndex : groups.length - 1
}
