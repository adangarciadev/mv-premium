/**
 * Time Tracker Logic
 * Tracks the amount of time a user visually spends in each subforum.
 */
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { getSubforumInfo, getThreadId } from '@/lib/url-helpers'

const STORAGE_KEY = 'local:mvp-time-stats'
const SYNC_INTERVAL_MS = 30_000 // Sync to storage every 30s
const TRACK_INTERVAL_MS = 1_000 // Tick every 1s

// In-memory counter to minimize storage writes
let unsavedSeconds = 0
let currentSubforum = ''

export interface TimeStats {
	[subforumSlug: string]: number // Total milliseconds
}

// Define storage item for better watching/typing
export const timeStatsStorage = storage.defineItem<TimeStats>(STORAGE_KEY, {
	defaultValue: {},
})

/**
 * Persist accumulated time to storage
 */
async function saveTime(): Promise<void> {
	if (unsavedSeconds === 0 || !currentSubforum) return

	try {
		const currentStats = await timeStatsStorage.getValue()
		const previousTotal = currentStats[currentSubforum] || 0

		currentStats[currentSubforum] = previousTotal + unsavedSeconds * 1000

		await timeStatsStorage.setValue(currentStats)
		unsavedSeconds = 0
	} catch (err) {
		logger.error('Failed to save time stats:', err)
	}
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
