/**
 * Toast constants
 * Centralized IDs and timing windows used by toast notifications.
 */

export const TOAST_IDS = {
	CONTEXT_ACTION: 'mvp-context-toast',
	THREAD_SAVE_ACTION: 'mvp-thread-save-action',
	HOMEPAGE_THREAD_ACTION: 'mvp-homepage-thread-action',
} as const

export const TOAST_TIMINGS = {
	DEDUP_MS: 650,
} as const
