/**
 * Toast constants
 * Centralized IDs and timing windows used by toast notifications.
 */

export const TOAST_IDS = {
	CONTEXT_ACTION: 'mvp-context-toast',
	THREAD_SAVE_ACTION: 'mvp-thread-save-action',
	THREAD_HIDE_ACTION: 'mvp-thread-hide-action',
	HOMEPAGE_THREAD_ACTION: 'mvp-homepage-thread-action',
	LIVE_AUTO_SUPPRESSED: 'mvp-live-auto-suppressed',
} as const

export const TOAST_TIMINGS = {
	DEDUP_MS: 650,
} as const
