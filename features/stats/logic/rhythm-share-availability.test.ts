import { describe, expect, it } from 'vitest'
import type { RhythmStats } from './rhythm-model'
import {
	getRhythmShareAvailability,
	hasAnyShareableRhythmScope,
	MIN_SHARE_RHYTHM_MS,
} from './rhythm-share-availability'

function createRhythm(): RhythmStats {
	return {
		hours: Array(24).fill(0),
		weekdays: Array(7).fill(0),
		weeks: {},
		hourSubforums: {},
		weekdayHours: {},
		weekdaySubforums: {},
		days: {},
		daySubforums: {},
	}
}

function getDayKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekKey(date: Date): string {
	return getDayKey(date)
}

describe('rhythm share availability', () => {
	const now = new Date(2026, 5, 16, 12, 0)

	it('requires one hour in the selected calendar year', () => {
		const stats = createRhythm()
		stats.days[getDayKey(now)] = MIN_SHARE_RHYTHM_MS - 1

		expect(getRhythmShareAvailability(stats, 'year', getWeekKey(now), 1, now).canShare).toBe(false)

		stats.days[getDayKey(now)] = MIN_SHARE_RHYTHM_MS

		expect(getRhythmShareAvailability(stats, 'year', getWeekKey(now), 1, now).canShare).toBe(true)
	})

	it('uses only the last 30 days for the recent summary', () => {
		const stats = createRhythm()
		const oldDate = new Date(now)
		oldDate.setDate(now.getDate() - 31)
		stats.days[getDayKey(oldDate)] = MIN_SHARE_RHYTHM_MS

		expect(getRhythmShareAvailability(stats, 'last30', getWeekKey(now), 1, now).canShare).toBe(false)

		stats.days[getDayKey(now)] = MIN_SHARE_RHYTHM_MS

		expect(getRhythmShareAvailability(stats, 'last30', getWeekKey(now), 1, now).canShare).toBe(true)
	})

	it('checks the selected week and weekday independently', () => {
		const stats = createRhythm()
		const weekKey = getWeekKey(now)
		stats.weeks[weekKey] = MIN_SHARE_RHYTHM_MS - 1
		stats.weekdays[2] = MIN_SHARE_RHYTHM_MS

		expect(getRhythmShareAvailability(stats, 'week', weekKey, 2, now).canShare).toBe(false)
		expect(getRhythmShareAvailability(stats, 'weekday', weekKey, 2, now).canShare).toBe(true)
	})

	it('reports whether at least one share scope is available', () => {
		const stats = createRhythm()

		expect(hasAnyShareableRhythmScope(stats, now)).toBe(false)

		stats.weekdays[5] = MIN_SHARE_RHYTHM_MS

		expect(hasAnyShareableRhythmScope(stats, now)).toBe(true)
	})
})
