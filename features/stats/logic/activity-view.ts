/**
 * Activity view-mode preference for the dashboard's main activity card.
 *
 * 'rhythm'  → the "Tiempo en Mediavida" 24h clock (default — reliable, time-based)
 * 'heatmap' → the classic GitHub-style contributions calendar
 *
 * Stored as its own lightweight key (mirrors BOOKMARKS_VIEW_MODE) instead of
 * the global settings store, since it's a dashboard-only UI preference.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

export type ActivityViewMode = 'rhythm' | 'heatmap'

const ACTIVITY_VIEW_KEY = `local:${STORAGE_KEYS.ACTIVITY_VIEW_MODE}` as `local:${string}`

export const activityViewModeStorage = storage.defineItem<ActivityViewMode>(ACTIVITY_VIEW_KEY, {
	defaultValue: 'rhythm',
})

export async function getActivityViewMode(): Promise<ActivityViewMode> {
	const value = await activityViewModeStorage.getValue()
	return value === 'heatmap' ? 'heatmap' : 'rhythm'
}

export async function setActivityViewMode(mode: ActivityViewMode): Promise<void> {
	await activityViewModeStorage.setValue(mode)
}
