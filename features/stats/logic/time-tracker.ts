/**
 * Time Tracker Logic
 * Tracks the amount of time a user visually spends in each subforum.
 */
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { getSubforumInfo, getThreadId } from '@/lib/url-helpers'
import { STORAGE_KEYS } from '@/constants'
import { getSettings } from '@/store'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'
import { sendMessage } from '@/lib/messaging'

const STORAGE_KEY = `local:${STORAGE_KEYS.TIME_STATS}` as `local:${string}`
const RHYTHM_KEY = `local:${STORAGE_KEYS.RHYTHM_STATS}` as `local:${string}`
const SYNC_INTERVAL_MS = 30_000 // Sync to storage every 30s
const TRACK_INTERVAL_MS = 1_000 // Tick every 1s

// In-memory counter to minimize storage writes
let unsavedSeconds = 0
let currentSubforum = ''
let saveQueue: Promise<void> = Promise.resolve()

export interface TimeStats {
	[subforumSlug: string]: number // Total milliseconds
}

/**
 * Browsing time bucketed by local hour-of-day and weekday, powering the
 * "Tiempo en Mediavida" clock. Reliable because it derives from the same 1s visible tick
 * as TimeStats — no DOM-event capture involved.
 */
export interface RhythmStats {
	hours: number[] // length 24 (0–23), milliseconds
	weekdays: number[] // length 7 (0 = Sunday), milliseconds
	weeks: Record<string, number> // weekKey (Monday's date) → milliseconds
	hourSubforums: Record<string, Record<string, number>> // hour ('0'–'23') → { subforumSlug → ms }
	weekdayHours: Record<string, number[]> // weekday ('0'–'6') → length-24 hours ms (clock per day)
	weekdaySubforums: Record<string, Record<string, number>> // weekday ('0'–'6') → { subforumSlug → ms }
	days: Record<string, number> // dayKey ('YYYY-MM-DD') → ms (for active-day count / averages)
	daySubforums: Record<string, Record<string, number>> // dayKey ('YYYY-MM-DD') → { subforumSlug → ms } (per-period subforum breakdown)
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
 * hour's subforum breakdown (powers the clock's "dónde" panel). Pure for tests.
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

// Define storage item for better watching/typing
export const timeStatsStorage = storage.defineItem<TimeStats>(STORAGE_KEY, {
	defaultValue: {},
})

const rhythmStatsStorage = storage.defineItem<RhythmStats | string>(RHYTHM_KEY, {
	defaultValue: createEmptyRhythm(),
})

async function writeRhythmStats(stats: RhythmStats): Promise<void> {
	await setCompressed(RHYTHM_KEY, prepareRhythmStatsForStorage(stats))
}

/**
 * Persist accumulated time to storage
 */
async function saveTime(): Promise<void> {
	saveQueue = saveQueue
		.then(async () => {
			if (unsavedSeconds === 0 || !currentSubforum) return

			const secondsToSave = unsavedSeconds
			unsavedSeconds = 0

			try {
				const settings = await getSettings()
				if (!settings.enableRhythmTracking) return

				const result = await sendMessage('recordRhythmTimeChunk', {
					subforum: currentSubforum,
					ms: secondsToSave * 1000,
					at: Date.now(),
				})

				if (!result.success) {
					unsavedSeconds += secondsToSave
					logger.error('Failed to save time stats:', result.error || 'Unknown background error')
				}
			} catch (err) {
				unsavedSeconds += secondsToSave
				logger.error('Failed to save time stats:', err)
			}
		})
		.catch(error => {
			logger.error('Failed to process time stats save queue:', error)
		})

	return saveQueue
}

/**
 * Initialize the time tracker
 */
export function initTimeTracker(): void {
	// 1. Identify context
	const threadId = getThreadId() // Gets path like /foro/cine or /foro/cine/hilo
	const info = getSubforumInfo(threadId)

	if (!info.slug || info.slug === 'unknown') return

	currentSubforum = info.slug

	// 2. Setup Tracking Interval
	setInterval(() => {
		// Only track if document is visible (tab is active/visible on screen)
		if (document.visibilityState === 'visible') {
			unsavedSeconds++
		}
	}, TRACK_INTERVAL_MS)

	// 3. Setup Sync Interval
	setInterval(() => {
		void saveTime()
	}, SYNC_INTERVAL_MS)

	// 4. Save on exit/visibility change (attempt)
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			void saveTime()
		}
	})

	window.addEventListener('beforeunload', () => {
		void saveTime()
	})
}

/**
 * Retrieve time stats
 */
export async function getTimeStats(): Promise<TimeStats> {
	return await timeStatsStorage.getValue()
}

/**
 * Watch for changes in time stats
 */
export function watchTimeStats(callback: (stats: TimeStats) => void): () => void {
	return timeStatsStorage.watch(newStats => {
		if (newStats) callback(newStats)
	})
}

/**
 * Retrieve the navigation rhythm (time per hour-of-day and weekday).
 */
export async function getRhythmStats(): Promise<RhythmStats> {
	const raw = await storage.getItem<RhythmStats | string>(RHYTHM_KEY)
	const stats = prepareRhythmStatsForStorage(normalizeRhythm(await getCompressed<RhythmStats>(RHYTHM_KEY)))

	if (raw && typeof raw !== 'string') {
		void writeRhythmStats(stats).catch(error => {
			logger.error('Failed to migrate rhythm stats to compressed storage:', error)
		})
	}

	return stats
}

/**
 * Reset the rhythm buckets (used by the "clear" action on the clock widget).
 */
export async function clearRhythmStats(): Promise<void> {
	await writeRhythmStats(createEmptyRhythm())
}

/**
 * DEV ONLY: realistic random rhythm data so the clock widget can be previewed
 * without spending real time browsing. Wired to a dev-only button on the widget.
 */
export function generateRandomRhythm(): RhythmStats {
	const rnd = (a: number, b: number) => Math.floor(a + Math.random() * (b - a))
	const pool = [
		'off-topic', 'deportes', 'cine', 'dev', 'ia', 'juegos', 'politica', 'musica',
		'tv', 'motor', 'criptomonedas', 'pokemon', 'diablo', 'anime-manga', 'fitness', 'wow',
	]

	const r = createEmptyRhythm()

	// One random "typical day" hourly profile (per-hour ms, capped ≤ 58 min/hour so a
	// daily average can never exceed an hour). A single profile = clearer reroll variety.
	const peakHour = rnd(0, 24)
	const width = 2 + Math.random() * 4
	const peakMinutes = rnd(12, 40)
	const typical = Array.from({ length: 24 }, (_, h) => {
		let dist = Math.abs(h - peakHour)
		dist = Math.min(dist, 24 - dist)
		const gauss = Math.exp(-(dist * dist) / (2 * width * width))
		const minutes = Math.min(50, gauss * peakMinutes + (Math.random() < 0.18 ? rnd(0, 3) : 0))
		return Math.round(minutes * 60_000)
	})

	// Each weekday has its own activity level so the weekday bars differ clearly.
	const weekdayFactor = Array.from({ length: 7 }, () => 0.35 + Math.random() * 1.45)

	const addChunk = (ms: number, h: number, wd: number, weekKey: string, dayKey: string, slug: string) => {
		r.hours[h] += ms
		r.weekdays[wd] += ms
		r.weeks[weekKey] = (r.weeks[weekKey] || 0) + ms
		r.days[dayKey] = (r.days[dayKey] || 0) + ms
		const wk = String(wd)
		if (!r.weekdayHours[wk]) r.weekdayHours[wk] = Array(24).fill(0)
		r.weekdayHours[wk][h] += ms
		const hk = String(h)
		if (!r.hourSubforums[hk]) r.hourSubforums[hk] = {}
		r.hourSubforums[hk][slug] = (r.hourSubforums[hk][slug] || 0) + ms
		if (!r.weekdaySubforums[wk]) r.weekdaySubforums[wk] = {}
		r.weekdaySubforums[wk][slug] = (r.weekdaySubforums[wk][slug] || 0) + ms
		if (!r.daySubforums[dayKey]) r.daySubforums[dayKey] = {}
		r.daySubforums[dayKey][slug] = (r.daySubforums[dayKey][slug] || 0) + ms
	}

	// Simulate N active days over the past year. Everything (hours, weekdays, weeks,
	// days, per-day clock, subforums) stays mutually consistent.
	const today = new Date()
	const N = rnd(35, 150)
	// Distinct day offsets so a single calendar day is never generated twice (which
	// could otherwise push a day past 24h).
	const offsets = new Set<number>()
	while (offsets.size < N) offsets.add(rnd(0, 336))
	for (const offset of offsets) {
		const date = new Date(today)
		date.setDate(today.getDate() - offset)
		const wd = date.getDay()
		const weekKey = getWeekKey(date)
		const dayKey = getDayKey(date)
		const dayFactor = 0.5 + Math.random() // daily variation

		for (let h = 0; h < 24; h++) {
			// Clamp to ≤58 min/hour so a day can never exceed ~23h (real ticks are bounded too).
			const ms = Math.min(58 * 60_000, Math.round(typical[h] * dayFactor * weekdayFactor[wd]))
			if (ms <= 0) continue
			const maxPicks = Math.max(1, Math.min(7, Math.floor(ms / 4000)))
			const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, rnd(1, maxPicks + 1))
			let left = ms
			picks.forEach((slug, j) => {
				const remaining = picks.length - 1 - j
				const part =
					j === picks.length - 1
						? left
						: Math.min(left - remaining, Math.max(1, Math.floor(left * (0.3 + Math.random() * 0.3))))
				addChunk(part, h, wd, weekKey, dayKey, slug)
				left -= part
			})
		}
	}

	return r
}

/** DEV ONLY: persist a fresh random rhythm dataset. */
export async function seedRandomRhythmStats(): Promise<void> {
	await writeRhythmStats(generateRandomRhythm())
}

/**
 * Watch for changes in the rhythm stats.
 */
export function watchRhythmStats(callback: (stats: RhythmStats) => void): () => void {
	return rhythmStatsStorage.watch(() => {
		void getRhythmStats().then(callback)
	})
}
