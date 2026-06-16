/**
 * Pure derivations for the "Tiempo en Mediavida" clock. No DOM / storage here so they can
 * be unit-tested in isolation.
 */
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from './time-tracker'

const HOUR_BUCKET_MAX_MS = 3_600_000
const MIN_VISIBLE_SUBFORUM_MS = 1000

export interface Archetype {
	key: 'night' | 'morning' | 'day' | 'evening'
	label: string
	emoji: string
}

/** Total tracked browsing time across all hour buckets (ms). */
export function getTotalRhythmMs(stats: RhythmStats): number {
	return stats.hours.reduce((acc, v) => acc + v, 0)
}

/** Whether there's enough data to draw a meaningful clock (default ≥ 1 min). */
export function hasEnoughRhythmData(stats: RhythmStats, minMs = 60_000): boolean {
	return getTotalRhythmMs(stats) >= minMs
}

/** Average hour buckets by day/occurrence, capped to 1h per bucket. */
export function getAverageRhythmHours(hours: number[], denominator: number): number[] {
	const safeDenominator = Math.max(1, Number(denominator) || 1)
	return Array.from({ length: 24 }, (_, index) => {
		const ms = Math.max(0, Number(hours[index]) || 0)
		return Math.min(ms / safeDenominator, HOUR_BUCKET_MAX_MS)
	})
}

/** Average 24h rhythm for a typical active day. */
export function getRhythmDailyAverageHours(stats: RhythmStats): number[] {
	return getAverageRhythmHours(stats.hours, getActiveDayCount(stats.days))
}

/** Total average time spent on Mediavida during a typical active day. */
export function getRhythmDailyAverageMs(stats: RhythmStats): number {
	return getRhythmDailyAverageHours(stats).reduce((acc, ms) => acc + ms, 0)
}

/** Average weekday totals per occurrence of that weekday. */
export function getRhythmAverageWeekdays(stats: RhythmStats): number[] {
	const counts = getWeekdayCounts(stats.days)
	return stats.weekdays.map((ms, index) => (Number(ms) || 0) / Math.max(1, counts[index]))
}

/**
 * All hour indices at (or within `tolerance` of) the maximum — i.e. tied/near-tied
 * peak hours (common once several hours hit the 1h-per-day cap). Empty when no data.
 */
export function getPeakHours(hours: number[], tolerance = 0.98): number[] {
	const max = Math.max(...hours, 0)
	if (max <= 0) return []
	const threshold = max * tolerance
	const peaks: number[] = []
	hours.forEach((v, i) => {
		if (v >= threshold) peaks.push(i)
	})
	return peaks
}

/** Index (0–23) of the busiest hour. Returns 0 when there's no data. */
export function getPeakHour(hours: number[]): number {
	let idx = 0
	let max = -1
	hours.forEach((v, i) => {
		if (v > max) {
			max = v
			idx = i
		}
	})
	return idx
}

export interface WeekBucket {
	/** Stable week key (Monday's date). */
	key: string
	/** Monday of the week (local). */
	weekStart: Date
	/** Milliseconds tracked that week. */
	ms: number
}

export interface DayBucket {
	/** Stable day key ('YYYY-MM-DD'). */
	key: string
	date: Date
	/** 0 = Sunday. */
	weekday: number
	/** Milliseconds tracked that day. */
	ms: number
}

/**
 * The last `count` weeks (oldest→newest, including empty ones), ending at the
 * week containing `now`. Powers the "por semana" bar view.
 */
export function getRhythmWeeklySeries(
	weeks: Record<string, number>,
	count = 6,
	now: Date = new Date()
): WeekBucket[] {
	const start = getWeekStart(now)
	const series: WeekBucket[] = []
	for (let i = count - 1; i >= 0; i--) {
		const weekStart = new Date(start)
		weekStart.setDate(start.getDate() - i * 7)
		const key = getWeekKey(weekStart)
		series.push({ key, weekStart, ms: weeks[key] || 0 })
	}
	return series
}

/** Whether at least two distinct weeks have data (i.e. a week has passed). */
export function hasWeeklyData(weeks: Record<string, number>): boolean {
	return Object.keys(weeks).length >= 2
}

/**
 * Visible weeks of the CURRENT calendar year (Jan → Dec), regardless of when
 * tracking started. Weeks without data come back at 0; a leading week that
 * starts in December is intentionally skipped so the strip starts in January.
 */
export function getRhythmCalendarWeeks(weeks: Record<string, number>, now: Date = new Date()): WeekBucket[] {
	const year = now.getFullYear()
	const start = getWeekStart(new Date(year, 0, 1))
	if (start.getFullYear() < year) start.setDate(start.getDate() + 7)
	const lastStart = getWeekStart(new Date(year, 11, 31))
	const series: WeekBucket[] = []
	const d = new Date(start)
	while (d.getTime() <= lastStart.getTime()) {
		const key = getWeekKey(d)
		series.push({ key, weekStart: new Date(d), ms: weeks[key] || 0 })
		d.setDate(d.getDate() + 7)
	}
	return series
}

/** The seven day buckets of the week containing `weekStart` (Monday→Sunday). */
export function getRhythmWeekDays(days: Record<string, number>, weekStart: Date): DayBucket[] {
	const start = getWeekStart(weekStart)
	return Array.from({ length: 7 }, (_, offset) => {
		const date = new Date(start)
		date.setDate(start.getDate() + offset)
		const key = getDayKey(date)
		return {
			key,
			date,
			weekday: date.getDay(),
			ms: Math.max(0, Number(days[key]) || 0),
		}
	})
}

export interface SubforumTime {
	slug: string
	ms: number
}

function sortedSubforumTimes(totals: Record<string, number>, limit: number): SubforumTime[] {
	return Object.entries(totals)
		.map(([slug, ms]) => ({ slug, ms: Number(ms) || 0 }))
		.filter(s => s.ms > 0)
		.sort((a, b) => b.ms - a.ms)
		.slice(0, limit)
}

/** Converts subforum totals into per-day/per-occurrence averages and hides sub-second noise. */
export function getAverageSubforumTimes(
	subforums: SubforumTime[],
	denominator: number,
	limit = 50,
	minMs = MIN_VISIBLE_SUBFORUM_MS
): SubforumTime[] {
	const safeDenominator = Math.max(1, Number(denominator) || 1)
	return subforums
		.map(s => ({ slug: s.slug, ms: Math.max(0, Number(s.ms) || 0) / safeDenominator }))
		.filter(s => s.ms >= minMs)
		.sort((a, b) => b.ms - a.ms)
		.slice(0, limit)
}

/** Top subforums (by time) for a given hour-of-day, busiest first. */
export function getTopSubforumsForHour(
	hourSubforums: Record<string, Record<string, number>>,
	hour: number,
	limit = 4
): SubforumTime[] {
	return sortedSubforumTimes(hourSubforums[String(hour)] || {}, limit)
}

/**
 * Subforum totals accumulated across a specific set of day keys (e.g. the days of
 * the current year, the last 30 days, or one week). Powers period-consistent
 * subforum rankings. Busiest first.
 */
export function getSubforumTotalsForDays(
	daySubforums: Record<string, Record<string, number>>,
	dayKeys: Iterable<string>,
	limit = 50
): SubforumTime[] {
	const totals: Record<string, number> = {}
	for (const key of dayKeys) {
		const subs = daySubforums[key]
		if (!subs) continue
		for (const [slug, ms] of Object.entries(subs)) {
			totals[slug] = (totals[slug] || 0) + (Number(ms) || 0)
		}
	}
	return sortedSubforumTimes(totals, limit)
}

/** Subforum totals aggregated across ALL hours (the all-day breakdown). */
export function getSubforumTotals(
	hourSubforums: Record<string, Record<string, number>>,
	limit = 50
): SubforumTime[] {
	const totals: Record<string, number> = {}
	for (const subs of Object.values(hourSubforums)) {
		if (!subs) continue
		for (const [slug, ms] of Object.entries(subs)) {
			totals[slug] = (totals[slug] || 0) + (Number(ms) || 0)
		}
	}
	return sortedSubforumTimes(totals, limit)
}

/** Top subforum by average time during a typical active day. */
export function getRhythmTopDailySubforum(stats: RhythmStats, minMs = MIN_VISIBLE_SUBFORUM_MS): SubforumTime | null {
	return getAverageSubforumTimes(
		getSubforumTotals(stats.hourSubforums, 50),
		getActiveDayCount(stats.days),
		1,
		minMs
	)[0] ?? null
}

/** Subforums for a given weekday (0 = Sunday), busiest first. */
export function getWeekdaySubforums(
	weekdaySubforums: Record<string, Record<string, number>>,
	weekday: number,
	limit = 50
): SubforumTime[] {
	return sortedSubforumTimes(weekdaySubforums[String(weekday)] || {}, limit)
}

/** Number of distinct active days (for per-day averages). At least 1. */
export function getActiveDayCount(days: Record<string, number>): number {
	return Math.max(1, Object.keys(days).length)
}

/** Average ms per ACTIVE day across the given day keys (0 when none were active). */
export function getDailyAverageForDays(days: Record<string, number>, dayKeys: Iterable<string>): number {
	let total = 0
	let active = 0
	for (const key of dayKeys) {
		const ms = Math.max(0, Number(days[key]) || 0)
		if (ms > 0) {
			total += ms
			active++
		}
	}
	return active > 0 ? total / active : 0
}

/** How many times each weekday (0 = Sunday) occurred, from the day keys. */
export function getWeekdayCounts(days: Record<string, number>): number[] {
	const counts = Array(7).fill(0)
	for (const key of Object.keys(days)) {
		const [y, m, d] = key.split('-').map(Number)
		if (!y || !m || !d) continue
		counts[new Date(y, m - 1, d).getDay()]++
	}
	return counts
}

/** Index (0 = Sunday) of the busiest weekday. Returns 0 when there's no data. */
export function getPeakWeekday(weekdays: number[]): number {
	let idx = 0
	let max = -1
	weekdays.forEach((v, i) => {
		if (v > max) {
			max = v
			idx = i
		}
	})
	return idx
}

/** Classifies the user by their busiest hour. */
export function getArchetype(peakHour: number): Archetype {
	if (peakHour >= 22 || peakHour <= 4) return { key: 'night', label: 'Noctámbulo', emoji: '🌙' }
	if (peakHour <= 11) return { key: 'morning', label: 'Madrugador', emoji: '🌅' }
	if (peakHour <= 17) return { key: 'day', label: 'Diurno', emoji: '☀️' }
	return { key: 'evening', label: 'Vespertino', emoji: '🌆' }
}

/**
 * The contiguous window of "busy" hours (≥ 50% of peak), handling wrap across
 * midnight. Returns null when it isn't meaningful (no data, or active all day).
 */
export function getActiveBand(hours: number[]): { start: number; end: number } | null {
	const peak = Math.max(...hours)
	if (peak <= 0) return null

	const threshold = peak * 0.5
	const active = hours.map(v => v >= threshold)
	if (active.every(Boolean)) return null // active all day → not informative

	// Longest inactive run (circular); the active band is its complement.
	const n = 24
	let bestStart = -1
	let bestLen = 0
	let runStart = -1
	let runLen = 0
	for (let k = 0; k < 2 * n; k++) {
		const idx = k % n
		if (!active[idx]) {
			if (runLen === 0) runStart = idx
			runLen++
			if (runLen > bestLen && runLen <= n) {
				bestLen = runLen
				bestStart = runStart
			}
		} else {
			runLen = 0
		}
	}

	if (bestLen === 0) return null
	const start = (bestStart + bestLen) % n
	const end = (bestStart - 1 + n) % n
	// A single active hour isn't a meaningful "band".
	if (start === end) return null
	return { start, end }
}
