import { describe, expect, it } from 'vitest'
import type { FootballMatch, FootballScore } from '@/services'
import { mergeMatchProgress } from './merge-matches'

function createMatch(
	id: number,
	status: FootballMatch['status'],
	score: FootballScore | null = null
): FootballMatch {
	return {
		id,
		utcDate: '2026-08-28T17:00:00.000Z',
		status,
		competition: 'PD',
		matchday: 3,
		stage: 'REGULAR_SEASON',
		minute: null,
		home: { id: 1, name: 'Casa FC', shortName: 'Casa', tla: 'CAS', crest: 'https://example.com/1.png' },
		away: { id: 2, name: 'Fuera FC', shortName: 'Fuera', tla: 'FUE', crest: 'https://example.com/2.png' },
		score,
	}
}

const result: FootballScore = { home: 3, away: 2, decidedBeyondRegularTime: false, penalties: null }

describe('mergeMatchProgress', () => {
	it('takes the response as-is on the first load', () => {
		const incoming = [createMatch(1, 'TIMED')]

		expect(mergeMatchProgress(null, incoming)).toBe(incoming)
		expect(mergeMatchProgress([], incoming)).toBe(incoming)
	})

	// The bug this exists for: consecutive responses disagreed, so a finished
	// match reverted to its kickoff time and back again every minute.
	it('keeps a finished match when the API sends it back as scheduled', () => {
		const merged = mergeMatchProgress([createMatch(1, 'FINISHED', result)], [createMatch(1, 'TIMED')])

		expect(merged[0].status).toBe('FINISHED')
		expect(merged[0].score).toEqual(result)
	})

	it('keeps a live match when the API sends it back as scheduled', () => {
		const merged = mergeMatchProgress([createMatch(1, 'IN_PLAY', result)], [createMatch(1, 'TIMED')])

		expect(merged[0].status).toBe('IN_PLAY')
	})

	it('lets a match move forward', () => {
		expect(mergeMatchProgress([createMatch(1, 'TIMED')], [createMatch(1, 'IN_PLAY')])[0].status).toBe('IN_PLAY')
		expect(mergeMatchProgress([createMatch(1, 'IN_PLAY')], [createMatch(1, 'FINISHED', result)])[0].status).toBe(
			'FINISHED'
		)
	})

	it('keeps a score already seen when the newer version has none', () => {
		const merged = mergeMatchProgress([createMatch(1, 'IN_PLAY', result)], [createMatch(1, 'IN_PLAY')])

		expect(merged[0].score).toEqual(result)
	})

	it('still accepts a postponement of a match that has not started', () => {
		expect(mergeMatchProgress([createMatch(1, 'TIMED')], [createMatch(1, 'POSTPONED')])[0].status).toBe('POSTPONED')
	})

	it('passes through fixtures it has never seen', () => {
		const merged = mergeMatchProgress([createMatch(1, 'FINISHED', result)], [createMatch(2, 'TIMED')])

		expect(merged).toHaveLength(1)
		expect(merged[0].id).toBe(2)
	})
})
