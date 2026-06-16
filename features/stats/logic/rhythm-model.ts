/**
 * Pure model helpers for the "Tiempo en Mediavida" rhythm clock.
 *
 * No storage, DOM, messaging or React imports here; this module is safe to use
 * from content, background, options UI and tests.
 */

/**
 * Browsing time bucketed by local hour-of-day and weekday, powering the
 * "Tiempo en Mediavida" clock. Reliable because it derives from the same 1s visible tick
 * as TimeStats - no DOM-event capture involved.
 */
export interface RhythmStats {
	hours: number[] // length 24 (0-23), milliseconds
	weekdays: number[] // length 7 (0 = Sunday), milliseconds
	weeks: Record<string, number> // weekKey (Monday's date) -> milliseconds
	hourSubforums: Record<string, Record<string, number>> // hour ('0'-'23') -> { subforumSlug -> ms }
	weekdayHours: Record<string, number[]> // weekday ('0'-'6') -> length-24 hours ms (clock per day)
	weekdaySubforums: Record<string, Record<string, number>> // weekday ('0'-'6') -> { subforumSlug -> ms }
	days: Record<string, number> // dayKey ('YYYY-MM-DD') -> ms (for active-day count / averages)
	daySubforums: Record<string, Record<string, number>> // dayKey ('YYYY-MM-DD') -> { subforumSlug -> ms } (per-period subforum breakdown)
}

export function createEmptyRhythm(): RhythmStats {
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

/** Cap on how many days of per-subforum breakdown we retain, to bound storage growth. */
const MAX_DAY_SUBFORUM_DAYS = 400
const MAX_SUBFORUMS_PER_DAY = 8
const MAX_SUBFORUMS_PER_HOUR = 16
const MAX_SUBFORUMS_PER_WEEKDAY = 16

function keepTopSubforums(totals: Record<string, number>, limit: number): Record<string, number> {
	return Object.fromEntries(
		Object.entries(totals)
			.map(([slug, ms]) => [slug, Number(ms) || 0] as const)
			.filter(([, ms]) => ms > 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
	)
}

function pruneSubforumBuckets(map: Record<string, Record<string, number>>, limit: number): void {
	for (const [key, totals] of Object.entries(map)) {
		const pruned = keepTopSubforums(totals, limit)
		if (Object.keys(pruned).length > 0) {
			map[key] = pruned
		} else {
			delete map[key]
		}
	}
}

/** Drops the oldest day buckets beyond the cap (keys are 'YYYY-MM-DD', so lexicographic = chronological). */
function pruneDaySubforums(map: Record<string, Record<string, number>>): void {
	const keys = Object.keys(map)
	if (keys.length <= MAX_DAY_SUBFORUM_DAYS) return
	keys.sort()
	for (const key of keys.slice(0, keys.length - MAX_DAY_SUBFORUM_DAYS)) delete map[key]
}

export function prepareRhythmStatsForStorage(stats: RhythmStats): RhythmStats {
	const next = normalizeRhythm(stats)
	pruneDaySubforums(next.daySubforums)
	pruneSubforumBuckets(next.daySubforums, MAX_SUBFORUMS_PER_DAY)
	pruneSubforumBuckets(next.hourSubforums, MAX_SUBFORUMS_PER_HOUR)
	pruneSubforumBuckets(next.weekdaySubforums, MAX_SUBFORUMS_PER_WEEKDAY)
	return next
}

/** Stable key for the local calendar day of `date` ('YYYY-MM-DD'). */
export function getDayKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Monday (local, 00:00) of the week containing `date`. */
export function getWeekStart(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
	const mondayOffset = (d.getDay() + 6) % 7 // 0 = Monday
	d.setDate(d.getDate() - mondayOffset)
	return d
}

/** Stable key for the week containing `date` (the Monday's ISO-ish date). */
export function getWeekKey(date: Date): string {
	const m = getWeekStart(date)
	return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}

/** Ensures the arrays/maps exist and have the right shape (defensive against old/partial data). */
export function normalizeRhythm(stats: Partial<RhythmStats> | null | undefined): RhythmStats {
	const base = createEmptyRhythm()
	if (!stats) return base
	for (let i = 0; i < 24; i++) base.hours[i] = Number(stats.hours?.[i]) || 0
	for (let i = 0; i < 7; i++) base.weekdays[i] = Number(stats.weekdays?.[i]) || 0
	if (stats.weeks) {
		for (const [key, value] of Object.entries(stats.weeks)) {
			const ms = Number(value) || 0
			if (ms > 0) base.weeks[key] = ms
		}
	}
	if (stats.hourSubforums) {
		for (const [hour, subs] of Object.entries(stats.hourSubforums)) {
			if (!subs) continue
			for (const [slug, value] of Object.entries(subs)) {
				const ms = Number(value) || 0
				if (ms <= 0) continue
				if (!base.hourSubforums[hour]) base.hourSubforums[hour] = {}
				base.hourSubforums[hour][slug] = ms
			}
		}
	}
	if (stats.weekdayHours) {
		for (const [wd, arr] of Object.entries(stats.weekdayHours)) {
			const hours = Array(24).fill(0)
			let any = false
			for (let i = 0; i < 24; i++) {
				hours[i] = Number(arr?.[i]) || 0
				if (hours[i] > 0) any = true
			}
			if (any) base.weekdayHours[wd] = hours
		}
	}
	if (stats.weekdaySubforums) {
		for (const [wd, subs] of Object.entries(stats.weekdaySubforums)) {
			if (!subs) continue
			for (const [slug, value] of Object.entries(subs)) {
				const ms = Number(value) || 0
				if (ms <= 0) continue
				if (!base.weekdaySubforums[wd]) base.weekdaySubforums[wd] = {}
				base.weekdaySubforums[wd][slug] = ms
			}
		}
	}
	if (stats.days) {
		for (const [key, value] of Object.entries(stats.days)) {
			const ms = Number(value) || 0
			if (ms > 0) base.days[key] = ms
		}
	}
	if (stats.daySubforums) {
		for (const [day, subs] of Object.entries(stats.daySubforums)) {
			if (!subs) continue
			for (const [slug, value] of Object.entries(subs)) {
				const ms = Number(value) || 0
				if (ms <= 0) continue
				if (!base.daySubforums[day]) base.daySubforums[day] = {}
				base.daySubforums[day][slug] = ms
			}
		}
	}
	return base
}

/**
 * Pure: returns a new RhythmStats with `ms` added to the hour, weekday and week
 * buckets for `date`. When `subforum` is given, also records it under that
 * hour's subforum breakdown (powers the clock's "donde" panel). Pure for tests.
 */
export function accumulateRhythm(stats: RhythmStats, ms: number, date: Date, subforum?: string): RhythmStats {
	const next = normalizeRhythm(stats)
	const hour = date.getHours()
	const wd = String(date.getDay())
	next.hours[hour] += ms
	next.weekdays[date.getDay()] += ms
	const weekKey = getWeekKey(date)
	next.weeks[weekKey] = (next.weeks[weekKey] || 0) + ms
	const dayKey = getDayKey(date)
	next.days[dayKey] = (next.days[dayKey] || 0) + ms

	if (!next.weekdayHours[wd]) next.weekdayHours[wd] = Array(24).fill(0)
	next.weekdayHours[wd][hour] += ms

	if (subforum) {
		const hourKey = String(hour)
		if (!next.hourSubforums[hourKey]) next.hourSubforums[hourKey] = {}
		next.hourSubforums[hourKey][subforum] = (next.hourSubforums[hourKey][subforum] || 0) + ms
		if (!next.weekdaySubforums[wd]) next.weekdaySubforums[wd] = {}
		next.weekdaySubforums[wd][subforum] = (next.weekdaySubforums[wd][subforum] || 0) + ms
		if (!next.daySubforums[dayKey]) next.daySubforums[dayKey] = {}
		next.daySubforums[dayKey][subforum] = (next.daySubforums[dayKey][subforum] || 0) + ms
		pruneDaySubforums(next.daySubforums)
	}
	return next
}
