/**
 * Time Tracker Logic
 * Tracks the amount of time a user visually spends in each subforum.
 */
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { getSubforumInfo, getThreadId } from '@/lib/url-helpers'
import { STORAGE_KEYS } from '@/constants'
import { getSettings } from '@/store'
import type { Settings } from '@/store/settings-types'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'
import { sendMessage } from '@/lib/messaging'
import {
	createEmptyRhythm,
	getDayKey,
	getWeekKey,
	normalizeRhythm,
	prepareRhythmStatsForStorage,
	type RhythmStats,
} from './rhythm-model'

export {
	accumulateRhythm,
	createEmptyRhythm,
	getDayKey,
	getWeekKey,
	getWeekStart,
	normalizeRhythm,
	prepareRhythmStatsForStorage,
	type RhythmStats,
} from './rhythm-model'

/**
 * Rhythm tracking is enabled by default. `getSettings()` returns only persisted
 * keys, so a missing preference must be treated as enabled (explicit-false
 * semantics) to honor `DEFAULT_SETTINGS.enableRhythmTracking`.
 */
export function isRhythmTrackingEnabled(
	settings: Pick<Partial<Settings>, 'enableRhythmTracking'>
): boolean {
	return settings.enableRhythmTracking !== false
}

const STORAGE_KEY = `local:${STORAGE_KEYS.TIME_STATS}` as `local:${string}`
const RHYTHM_KEY = `local:${STORAGE_KEYS.RHYTHM_STATS}` as `local:${string}`
const SYNC_INTERVAL_MS = 30_000 // Sync to storage every 30s
const TRACK_INTERVAL_MS = 1_000 // Tick every 1s

// In-memory counter to minimize storage writes
let unsavedSeconds = 0
let currentSubforum = ''
let saveQueue: Promise<void> = Promise.resolve()

// Lifecycle guard so repeated bootstraps (HMR, reinjection) don't double-count.
let trackerCleanup: (() => void) | null = null

export interface TimeStats {
	[subforumSlug: string]: number // Total milliseconds
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
 * Persist accumulated time to storage.
 */
async function saveTime(): Promise<void> {
	saveQueue = saveQueue
		.then(async () => {
			if (unsavedSeconds === 0 || !currentSubforum) return

			const secondsToSave = unsavedSeconds
			unsavedSeconds = 0

			try {
				const settings = await getSettings()
				if (!isRhythmTrackingEnabled(settings)) return

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
 * Initialize the time tracker. Idempotent: repeated calls within the same
 * document reuse the active tracker and return its existing cleanup, so time is
 * never double-counted. Returns a cleanup function that clears both intervals
 * and removes both listeners.
 */
export function initTimeTracker(): () => void {
	// 1. Identify context
	const threadId = getThreadId()
	const info = getSubforumInfo(threadId)

	if (!info.slug || info.slug === 'unknown') return () => {}

	// Already running: reuse the existing tracker instead of stacking another.
	if (trackerCleanup) return trackerCleanup

	currentSubforum = info.slug

	// 2. Setup Tracking Interval
	const trackIntervalId = window.setInterval(() => {
		// Only track if document is visible (tab is active/visible on screen)
		if (document.visibilityState === 'visible') {
			unsavedSeconds++
		}
	}, TRACK_INTERVAL_MS)

	// 3. Setup Sync Interval
	const syncIntervalId = window.setInterval(() => {
		void saveTime()
	}, SYNC_INTERVAL_MS)

	// 4. Save on exit/visibility change (attempt)
	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') {
			void saveTime()
		}
	}
	const onBeforeUnload = () => {
		void saveTime()
	}

	document.addEventListener('visibilitychange', onVisibilityChange)
	window.addEventListener('beforeunload', onBeforeUnload)

	trackerCleanup = () => {
		window.clearInterval(trackIntervalId)
		window.clearInterval(syncIntervalId)
		document.removeEventListener('visibilitychange', onVisibilityChange)
		window.removeEventListener('beforeunload', onBeforeUnload)
		trackerCleanup = null
	}

	return trackerCleanup
}

/**
 * TEST ONLY: reset module-level tracker state so each test starts clean.
 * Never call from production code.
 */
export function resetTimeTrackerForTest(): void {
	trackerCleanup?.()
	trackerCleanup = null
	unsavedSeconds = 0
	currentSubforum = ''
	saveQueue = Promise.resolve()
}

/**
 * Retrieve time stats.
 */
export async function getTimeStats(): Promise<TimeStats> {
	return await timeStatsStorage.getValue()
}

/**
 * Watch for changes in time stats.
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

	// One random "typical day" hourly profile (per-hour ms, capped <= 58 min/hour so a
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
			// Clamp to <= 58 min/hour so a day can never exceed ~23h (real ticks are bounded too).
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
