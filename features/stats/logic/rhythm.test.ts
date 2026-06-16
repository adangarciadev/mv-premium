import { describe, it, expect } from 'vitest'
import { accumulateRhythm, createEmptyRhythm, getDayKey, getWeekKey, getWeekStart, normalizeRhythm } from './rhythm-model'
import {
	getActiveBand,
	getActiveDayCount,
	getAverageRhythmHours,
	getAverageSubforumTimes,
	getArchetype,
	getPeakHour,
	getPeakHours,
	getPeakWeekday,
	getRhythmAverageWeekdays,
	getRhythmCalendarWeeks,
	getRhythmDailyAverageHours,
	getRhythmDailyAverageMs,
	getRhythmWeekDays,
	getRhythmWeeklySeries,
	getRhythmTopDailySubforum,
	getSubforumTotals,
	getWeekdayCounts,
	getWeekdaySubforums,
	getTopSubforumsForHour,
	getTotalRhythmMs,
	hasEnoughRhythmData,
	hasWeeklyData,
} from './rhythm-insights'

describe('createEmptyRhythm', () => {
	it('returns zeroed 24-hour and 7-weekday arrays and an empty weeks map', () => {
		const empty = createEmptyRhythm()
		expect(empty.hours).toHaveLength(24)
		expect(empty.weekdays).toHaveLength(7)
		expect(empty.hours.every(v => v === 0)).toBe(true)
		expect(empty.weekdays.every(v => v === 0)).toBe(true)
		expect(empty.weeks).toEqual({})
		expect(empty.hourSubforums).toEqual({})
		expect(empty.weekdayHours).toEqual({})
		expect(empty.weekdaySubforums).toEqual({})
		expect(empty.days).toEqual({})
		expect(empty.daySubforums).toEqual({})
	})
})

describe('getRhythmWeeklySeries', () => {
	it('returns the last N weeks ending at the current week, oldest first', () => {
		const now = new Date(2026, 0, 7) // week of Mon Jan 5
		const series = getRhythmWeeklySeries({ '2026-01-05': 1000 }, 2, now)
		expect(series).toHaveLength(2)
		expect(series[0].key).toBe('2025-12-29')
		expect(series[0].ms).toBe(0)
		expect(series[1].key).toBe('2026-01-05')
		expect(series[1].ms).toBe(1000)
	})
})

describe('hasWeeklyData', () => {
	it('is true only once at least two distinct weeks have data', () => {
		expect(hasWeeklyData({})).toBe(false)
		expect(hasWeeklyData({ '2026-01-05': 10 })).toBe(false)
		expect(hasWeeklyData({ '2026-01-05': 10, '2026-01-12': 5 })).toBe(true)
	})
})

describe('normalizeRhythm', () => {
	it('returns an empty rhythm for null/undefined', () => {
		expect(normalizeRhythm(null)).toEqual(createEmptyRhythm())
		expect(normalizeRhythm(undefined)).toEqual(createEmptyRhythm())
	})

	it('pads short arrays and coerces non-numeric values to 0', () => {
		const result = normalizeRhythm({ hours: [5, undefined as never, 'x' as never], weekdays: [1] })
		expect(result.hours).toHaveLength(24)
		expect(result.weekdays).toHaveLength(7)
		expect(result.hours[0]).toBe(5)
		expect(result.hours[1]).toBe(0)
		expect(result.hours[2]).toBe(0)
		expect(result.weekdays[0]).toBe(1)
		expect(result.weekdays[6]).toBe(0)
	})
})

describe('getWeekStart / getWeekKey', () => {
	it('snaps to the Monday of the week', () => {
		const monday = getWeekStart(new Date(2026, 0, 7)) // Wed Jan 7 2026
		expect(monday.getFullYear()).toBe(2026)
		expect(monday.getMonth()).toBe(0)
		expect(monday.getDate()).toBe(5) // Mon Jan 5
		expect(monday.getDay()).toBe(1)
	})

	it('produces a stable key for any day in the same week', () => {
		expect(getWeekKey(new Date(2026, 0, 5))).toBe('2026-01-05')
		expect(getWeekKey(new Date(2026, 0, 7))).toBe('2026-01-05')
		expect(getWeekKey(new Date(2026, 0, 11))).toBe('2026-01-05') // Sunday still same week
	})
})

describe('accumulateRhythm', () => {
	it('adds ms to the hour, weekday and week buckets for the given date', () => {
		const date = new Date(2026, 0, 5, 23, 30) // local time, Monday
		const result = accumulateRhythm(createEmptyRhythm(), 1000, date)
		expect(result.hours[date.getHours()]).toBe(1000)
		expect(result.weekdays[date.getDay()]).toBe(1000)
		expect(result.weeks[getWeekKey(date)]).toBe(1000)
		// nothing else touched
		expect(getTotalRhythmMs(result)).toBe(1000)
	})

	it('accumulates across multiple calls without mutating the input', () => {
		const base = createEmptyRhythm()
		const date = new Date(2026, 0, 5, 10, 0)
		const once = accumulateRhythm(base, 500, date)
		const twice = accumulateRhythm(once, 500, date)
		expect(twice.hours[date.getHours()]).toBe(1000)
		// original stays zeroed (immutability)
		expect(base.hours[date.getHours()]).toBe(0)
	})

	it('records the subforum under the hour bucket when provided', () => {
		const date = new Date(2026, 0, 5, 10, 0)
		let stats = accumulateRhythm(createEmptyRhythm(), 500, date, 'off-topic')
		stats = accumulateRhythm(stats, 300, date, 'off-topic')
		stats = accumulateRhythm(stats, 200, date, 'cine')
		expect(stats.hourSubforums['10']['off-topic']).toBe(800)
		expect(stats.hourSubforums['10']['cine']).toBe(200)
	})

	it('does not touch hourSubforums when no subforum is given', () => {
		const stats = accumulateRhythm(createEmptyRhythm(), 500, new Date(2026, 0, 5, 10, 0))
		expect(stats.hourSubforums).toEqual({})
	})

	it('records per-weekday hours and per-weekday subforums', () => {
		const date = new Date(2026, 0, 5, 10, 0) // Monday → getDay() === 1
		const stats = accumulateRhythm(createEmptyRhythm(), 500, date, 'cine')
		expect(stats.weekdayHours['1'][10]).toBe(500)
		expect(stats.weekdaySubforums['1'].cine).toBe(500)
	})

	it('records per-day subforums under the day key', () => {
		const date = new Date(2026, 0, 5, 10, 0)
		const stats = accumulateRhythm(createEmptyRhythm(), 500, date, 'cine')
		expect(stats.daySubforums[getDayKey(date)].cine).toBe(500)
	})

	it('records the active day bucket', () => {
		const date = new Date(2026, 0, 5, 10, 0)
		const stats = accumulateRhythm(createEmptyRhythm(), 500, date)
		expect(stats.days[getDayKey(date)]).toBe(500)
	})
})

describe('getActiveDayCount / getWeekdayCounts', () => {
	it('counts distinct active days (min 1)', () => {
		expect(getActiveDayCount({})).toBe(1)
		expect(getActiveDayCount({ '2026-01-05': 10, '2026-01-06': 20 })).toBe(2)
	})

	it('counts how many times each weekday occurred', () => {
		// 2026-01-05 Mon, 2026-01-12 Mon, 2026-01-06 Tue
		const counts = getWeekdayCounts({ '2026-01-05': 1, '2026-01-12': 1, '2026-01-06': 1 })
		expect(counts[1]).toBe(2) // Monday
		expect(counts[2]).toBe(1) // Tuesday
		expect(counts[0]).toBe(0) // Sunday
	})
})

describe('getWeekdaySubforums', () => {
	it('returns the weekday subforums sorted busiest first', () => {
		const wds = { '1': { cine: 200, 'off-topic': 800 } }
		expect(getWeekdaySubforums(wds, 1)).toEqual([
			{ slug: 'off-topic', ms: 800 },
			{ slug: 'cine', ms: 200 },
		])
	})

	it('returns an empty array for a weekday without data', () => {
		expect(getWeekdaySubforums({}, 3)).toEqual([])
	})
})

describe('getTopSubforumsForHour', () => {
	it('returns subforums for the hour, busiest first, capped to the limit', () => {
		const hourSubforums = { '10': { 'off-topic': 800, cine: 200, deportes: 500 } }
		const top = getTopSubforumsForHour(hourSubforums, 10, 2)
		expect(top).toEqual([
			{ slug: 'off-topic', ms: 800 },
			{ slug: 'deportes', ms: 500 },
		])
	})

	it('returns an empty array for an hour without data', () => {
		expect(getTopSubforumsForHour({}, 3)).toEqual([])
	})
})

describe('getSubforumTotals', () => {
	it('aggregates subforum time across all hours, busiest first', () => {
		const hs = { '10': { 'off-topic': 800, cine: 200 }, '11': { 'off-topic': 100, deportes: 500 } }
		expect(getSubforumTotals(hs)).toEqual([
			{ slug: 'off-topic', ms: 900 },
			{ slug: 'deportes', ms: 500 },
			{ slug: 'cine', ms: 200 },
		])
	})
})

describe('getRhythmCalendarWeeks', () => {
	it('spans the visible calendar year without a leading December week', () => {
		const series = getRhythmCalendarWeeks({}, new Date(2026, 5, 15))
		expect(series.length).toBeGreaterThanOrEqual(52)
		expect(series[0].weekStart.getFullYear()).toBe(2026)
		expect(series[0].weekStart.getMonth()).toBe(0)
		expect(series[series.length - 1].weekStart.getMonth()).toBe(11) // December
	})

	it('fills ms from the weeks map by key', () => {
		const now = new Date(2026, 5, 15)
		const key = getWeekKey(now)
		const series = getRhythmCalendarWeeks({ [key]: 5000 }, now)
		expect(series.find(w => w.key === key)?.ms).toBe(5000)
	})
})

describe('getRhythmWeekDays', () => {
	it('returns Monday to Sunday buckets for the selected week', () => {
		const days = { '2026-01-05': 1000, '2026-01-11': 3000 }
		const series = getRhythmWeekDays(days, new Date(2026, 0, 7))
		expect(series).toHaveLength(7)
		expect(series[0]).toMatchObject({ key: '2026-01-05', weekday: 1, ms: 1000 })
		expect(series[6]).toMatchObject({ key: '2026-01-11', weekday: 0, ms: 3000 })
	})
})

describe('getTotalRhythmMs / hasEnoughRhythmData', () => {
	it('sums the hour buckets', () => {
		const stats = createEmptyRhythm()
		stats.hours[3] = 4000
		stats.hours[10] = 6000
		expect(getTotalRhythmMs(stats)).toBe(10000)
	})

	it('requires at least the minimum to be considered "enough"', () => {
		const stats = createEmptyRhythm()
		stats.hours[0] = 30_000
		expect(hasEnoughRhythmData(stats)).toBe(false)
		stats.hours[0] = 60_000
		expect(hasEnoughRhythmData(stats)).toBe(true)
	})
})

describe('daily rhythm averages', () => {
	it('averages hour buckets by active days and caps each hour at 1h', () => {
		const stats = createEmptyRhythm()
		stats.days = { '2026-01-05': 1, '2026-01-06': 1 }
		stats.hours[10] = 8_000_000
		stats.hours[11] = 600_000

		expect(getAverageRhythmHours(stats.hours, 2)[10]).toBe(3_600_000)
		expect(getRhythmDailyAverageHours(stats)[11]).toBe(300_000)
		expect(getRhythmDailyAverageMs(stats)).toBe(3_900_000)
	})

	it('averages weekdays by their occurrence count', () => {
		const stats = createEmptyRhythm()
		stats.days = { '2026-01-05': 1, '2026-01-12': 1, '2026-01-06': 1 }
		stats.weekdays[1] = 120_000
		stats.weekdays[2] = 90_000

		expect(getRhythmAverageWeekdays(stats)[1]).toBe(60_000)
		expect(getRhythmAverageWeekdays(stats)[2]).toBe(90_000)
	})

	it('averages subforum totals and filters sub-second noise', () => {
		const average = getAverageSubforumTimes([
			{ slug: 'cine', ms: 1500 },
			{ slug: 'off-topic', ms: 4000 },
		], 2)

		expect(average).toEqual([{ slug: 'off-topic', ms: 2000 }])
	})

	it('returns the top daily average subforum', () => {
		const stats = createEmptyRhythm()
		stats.days = { '2026-01-05': 1, '2026-01-06': 1 }
		stats.hourSubforums = { '10': { cine: 4000, 'off-topic': 6000 } }

		expect(getRhythmTopDailySubforum(stats)).toEqual({ slug: 'off-topic', ms: 3000 })
	})
})

describe('getPeakHour / getPeakWeekday', () => {
	it('returns the index of the busiest bucket', () => {
		const hours = Array(24).fill(0)
		hours[18] = 100
		expect(getPeakHour(hours)).toBe(18)

		const weekdays = Array(7).fill(0)
		weekdays[4] = 50
		expect(getPeakWeekday(weekdays)).toBe(4)
	})

	it('returns 0 when there is no data', () => {
		expect(getPeakHour(Array(24).fill(0))).toBe(0)
		expect(getPeakWeekday(Array(7).fill(0))).toBe(0)
	})
})

describe('getPeakHours', () => {
	it('returns the single peak when there is a clear max', () => {
		const hours = Array(24).fill(0)
		hours[15] = 100
		expect(getPeakHours(hours)).toEqual([15])
	})

	it('returns all tied / near-tied peak hours', () => {
		const hours = Array(24).fill(0)
		hours[15] = 100
		hours[16] = 100
		hours[17] = 99 // within 98% of the max
		expect(getPeakHours(hours)).toEqual([15, 16, 17])
	})

	it('returns an empty array when there is no data', () => {
		expect(getPeakHours(Array(24).fill(0))).toEqual([])
	})
})

describe('getArchetype', () => {
	it('classifies by peak hour', () => {
		expect(getArchetype(23).key).toBe('night')
		expect(getArchetype(2).key).toBe('night')
		expect(getArchetype(8).key).toBe('morning')
		expect(getArchetype(14).key).toBe('day')
		expect(getArchetype(20).key).toBe('evening')
	})
})

describe('getActiveBand', () => {
	it('returns null when there is no data', () => {
		expect(getActiveBand(Array(24).fill(0))).toBeNull()
	})

	it('returns null when activity is uniform all day', () => {
		expect(getActiveBand(Array(24).fill(5))).toBeNull()
	})

	it('returns null for a single active hour (not a meaningful band)', () => {
		const hours = Array(24).fill(0)
		hours[11] = 100
		expect(getActiveBand(hours)).toBeNull()
	})

	it('finds a non-wrapping band', () => {
		const hours = Array(24).fill(0)
		;[9, 10, 11, 12].forEach(h => (hours[h] = 10))
		expect(getActiveBand(hours)).toEqual({ start: 9, end: 12 })
	})

	it('finds a band that wraps across midnight', () => {
		const hours = Array(24).fill(0)
		;[21, 22, 0, 1].forEach(h => (hours[h] = 10))
		hours[23] = 12 // peak
		expect(getActiveBand(hours)).toEqual({ start: 21, end: 1 })
	})
})
