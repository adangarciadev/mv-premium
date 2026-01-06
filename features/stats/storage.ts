/**
 * Activity Stats Storage
 *
 * Tracks user activity (drafts, posts) for the heatmap visualization.
 * Stores detailed entries for each action.
 *
 * Uses lz-string compression to reduce storage footprint.
 */
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { getTodayKey } from '@/lib/date-utils'
import { generateSimpleId } from '@/lib/id-generator'
import { STORAGE_KEYS } from '@/constants'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'
import { getSettings } from '@/store'

// Re-export date utils for backwards compatibility
export { formatDateKey, parseDateKey } from '@/lib/date-utils'

// =============================================================================
// Types
// =============================================================================

export type ActivityType = 'draft' | 'post'

export interface ActivityEntry {
	/** Unique ID for this entry */
	id: string
	/** Type of activity */
	type: ActivityType
	/** Timestamp when this happened */
	timestamp: number
	/** Action performed */
	action: 'create' | 'update' | 'publish'
	/** Optional title/name */
	title?: string
	/** Optional subforum/context */
	context?: string
	/** Optional thread URL (for posts) */
	url?: string
}

/**
 * Activity data structure: date string (DD-MM-YYYY) → list of entries
 */
export type ActivityData = Record<string, ActivityEntry[]>

// =============================================================================
// Storage Key
// =============================================================================
const ACTIVITY_KEY = `local:${STORAGE_KEYS.ACTIVITY}` as const

// Storage item for watching (WXT pattern) - still needed for watch() functionality
const activityStorageWatcher = storage.defineItem<ActivityData>(ACTIVITY_KEY, {
	defaultValue: {},
})

// =============================================================================
// Core Functions (using compressed storage)
// =============================================================================

export interface TrackActivityOptions {
	type: ActivityType
	action?: 'create' | 'update' | 'publish'
	title?: string
	context?: string
	url?: string
}

/**
 * Records a user activity (post creation, update, etc.) into the daily statistics.
 * Supports both a simple activity type string and a complete options object.
 *
 * Respects the enableActivityTracking setting - if disabled, does nothing.
 * @param options - Activity type or detailed configuration object
 */
export async function trackActivity(options: TrackActivityOptions | ActivityType): Promise<void> {
	try {
		// Check if activity tracking is enabled
		const settings = await getSettings()
		if (settings.enableActivityTracking === false) {
			return // User has disabled activity tracking
		}

		// Support both old signature (just type) and new signature (options object)
		const opts: TrackActivityOptions = typeof options === 'string' ? { type: options } : options

		const data = await getActivityData()
		const todayKey = getTodayKey()

		if (!data[todayKey]) {
			data[todayKey] = []
		}

		const entry: ActivityEntry = {
			id: generateSimpleId(),
			type: opts.type,
			action: opts.action || 'create',
			timestamp: Date.now(),
			title: opts.title,
			context: opts.context,
			url: opts.url,
		}

		data[todayKey].push(entry)

		await setCompressed(ACTIVITY_KEY, data)
	} catch (error) {
		logger.error('Failed to track activity:', error)
	}
}

/**
 * Retrieves the entire activity dataset from storage.
 */
export async function getActivityData(): Promise<ActivityData> {
	try {
		const data = await getCompressed<ActivityData>(ACTIVITY_KEY)
		return data || {}
	} catch {
		return {}
	}
}

/**
 * Retrieves a list of activity entries for a specific date key (DD-MM-YYYY).
 */
export async function getActivityForDate(dateKey: string): Promise<ActivityEntry[]> {
	const data = await getActivityData()
	return data[dateKey] || []
}

/**
 * Returns the total activity count for a specific date key.
 */
export function getCountForDate(data: ActivityData, dateKey: string): number {
	return data[dateKey]?.length || 0
}

/**
 * Clear all activity data (for debugging/reset)
 */
export async function clearActivityData(): Promise<void> {
	await activityStorageWatcher.removeValue()
}

/**
 * Subscribes to changes in the activity storage dataset.
 * Note: Watch sees the raw (compressed) data, but WXT handles parsing.
 * For reactive updates with decompressed data, fetch on change.
 * @param callback - Function executed when activity data is updated
 * @returns A cleanup function to stop watching
 */
export function watchActivity(callback: (data: ActivityData) => void): () => void {
	// Watch triggers on any storage change, then fetch decompressed data
	return activityStorageWatcher.watch(async () => {
		const data = await getActivityData()
		callback(data)
	})
}
