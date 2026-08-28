import type { FootballMatch } from '@/services'

/**
 * How far along a match is. A fixture only ever moves forward: it is scheduled,
 * then it is being played, then it is over.
 */
function getProgress(status: FootballMatch['status']): number {
	if (status === 'FINISHED') return 2
	if (status === 'IN_PLAY' || status === 'PAUSED') return 1

	return 0
}

/**
 * Merge a fresh response over what is already on screen, never letting a match
 * go backwards.
 *
 * football-data.org has been observed answering consecutive requests with
 * different snapshots: a match reported as finished with a score comes back as
 * merely scheduled a minute later, and then finished again. Rendering each
 * response as-is made results appear and disappear. Since a real fixture never
 * regresses, the more advanced of the two versions wins, and a score already
 * seen is never dropped for a version that has none.
 */
export function mergeMatchProgress(
	previous: FootballMatch[] | null,
	incoming: FootballMatch[]
): FootballMatch[] {
	if (previous === null || previous.length === 0) return incoming

	const seen = new Map(previous.map(match => [match.id, match]))

	return incoming.map(match => {
		const known = seen.get(match.id)
		if (known === undefined) return match

		if (getProgress(known.status) > getProgress(match.status)) return known
		if (known.score !== null && match.score === null) return { ...match, score: known.score }

		return match
	})
}
