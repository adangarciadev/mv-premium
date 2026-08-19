import { describe, expect, it } from 'vitest'
import type { FootballMatch, FootballScore } from '@/services'
import {
	formatDayLabel,
	formatDayLabelParts,
	formatKickoffTime,
	formatScoreText,
	formatStageLabel,
} from './format-match'

function createMatch(overrides: Partial<FootballMatch> = {}): FootballMatch {
	return {
		id: 1,
		utcDate: '2026-08-19T18:30:00.000Z',
		status: 'TIMED',
		competition: 'PD',
		matchday: 3,
		stage: 'REGULAR_SEASON',
		home: {
			id: 263,
			name: 'Deportivo Alavés',
			shortName: 'Alavés',
			tla: 'ALA',
			crest: 'https://crests.football-data.org/263.png',
		},
		away: {
			id: 82,
			name: 'Getafe CF',
			shortName: 'Getafe',
			tla: 'GET',
			crest: 'https://crests.football-data.org/82.png',
		},
		score: null,
		...overrides,
	}
}

describe('format-match', () => {
	describe('formatStageLabel()', () => {
		it('formats every supported stage and the empty fallback', () => {
			expect(formatStageLabel(createMatch({ stage: 'REGULAR_SEASON', matchday: 3 }))).toBe('Jornada 3')
			expect(formatStageLabel(createMatch({ stage: 'REGULAR_SEASON', matchday: null }))).toBe('Jornada')
			expect(formatStageLabel(createMatch({ stage: 'LEAGUE_STAGE', matchday: 2 }))).toBe('Fase de liga · J2')
			expect(formatStageLabel(createMatch({ stage: 'LEAGUE_STAGE', matchday: null }))).toBe('Fase de liga')
			expect(formatStageLabel(createMatch({ stage: 'PLAYOFFS' }))).toBe('Playoffs')
			expect(formatStageLabel(createMatch({ stage: 'LAST_16' }))).toBe('Octavos')
			expect(formatStageLabel(createMatch({ stage: 'QUARTER_FINALS' }))).toBe('Cuartos')
			expect(formatStageLabel(createMatch({ stage: 'SEMI_FINALS' }))).toBe('Semifinales')
			expect(formatStageLabel(createMatch({ stage: 'FINAL' }))).toBe('Final')
			expect(formatStageLabel(createMatch({ stage: 'THIRD_PLACE' }))).toBe('Tercer puesto')
			expect(formatStageLabel(createMatch({ stage: 'UNKNOWN_STAGE' }))).toBe('')
		})
	})

	describe('formatScoreText()', () => {
		const regularScore: FootballScore = {
			home: 3,
			away: 0,
			decidedBeyondRegularTime: false,
			penalties: null,
		}

		it('formats a missing score as null', () => {
			expect(formatScoreText(null)).toBeNull()
		})

		it('formats a regular-time score', () => {
			expect(formatScoreText(regularScore)).toBe('3 - 0')
		})

		it('keeps the regular score and appends the penalty shootout result', () => {
			expect(
				formatScoreText({
					home: 1,
					away: 1,
					decidedBeyondRegularTime: true,
					penalties: { home: 4, away: 3 },
				})
			).toBe('1 - 1 (4-3 pen.)')
		})

		it('marks a match decided in extra time', () => {
			expect(
				formatScoreText({
					home: 2,
					away: 1,
					decidedBeyondRegularTime: true,
					penalties: null,
				})
			).toBe('2 - 1 (pró.)')
		})
	})

	describe('formatKickoffTime()', () => {
		it('formats a valid UTC date in local HH:MM time', () => {
			const date = new Date(2026, 7, 19, 20, 5, 0)

			expect(formatKickoffTime(date.toISOString())).toBe('20:05')
		})

		it('returns an empty string for an invalid date', () => {
			expect(formatKickoffTime('not-a-date')).toBe('')
		})
	})

	describe('formatDayLabel()', () => {
		it('formats today, tomorrow, yesterday, and a regular local date', () => {
			const now = new Date(2026, 7, 19, 12, 0, 0)

			expect(formatDayLabel('2026-08-19', now)).toBe('Hoy')
			expect(formatDayLabel('2026-08-20', now)).toBe('Mañana')
			expect(formatDayLabel('2026-08-18', now)).toBe('Ayer')
			expect(formatDayLabel('2026-08-22', now)).toBe('Sábado 22')
		})

	})

	describe('formatDayLabelParts()', () => {
		const now = new Date(2026, 7, 19, 12, 0, 0)

		it('marks today as a relative label with the today flag', () => {
			expect(formatDayLabelParts('2026-08-19', now)).toEqual({
				weekday: 'Hoy',
				dayNumber: null,
				isRelative: true,
				isToday: true,
			})
		})

		it('marks tomorrow as a relative label without the today flag', () => {
			expect(formatDayLabelParts('2026-08-20', now)).toEqual({
				weekday: 'Mañana',
				dayNumber: null,
				isRelative: true,
				isToday: false,
			})
		})

		it('marks yesterday as a relative label without the today flag', () => {
			expect(formatDayLabelParts('2026-08-18', now)).toEqual({
				weekday: 'Ayer',
				dayNumber: null,
				isRelative: true,
				isToday: false,
			})
		})

		it('returns the full weekday and day number for a regular date', () => {
			expect(formatDayLabelParts('2026-08-22', now)).toEqual({
				weekday: 'Sábado',
				dayNumber: '22',
				isRelative: false,
				isToday: false,
			})
		})
	})
})
