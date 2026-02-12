/**
 * Runtime cache keys and related early-injection style IDs.
 *
 * These values are intentionally centralized because they are shared between
 * "early" entrypoints (document_start) and regular feature modules.
 */

export const RUNTIME_CACHE_KEYS = {
	NEW_HOMEPAGE_ENABLED: 'mvp-new-homepage-enabled-cache',
	HIDDEN_THREADS: 'mvp-hidden-threads-cache',
	ULTRAWIDE_MODE: 'mvp-ultrawide-mode-cache',
	CENTERED_POSTS: 'mvp-centered-posts-cache',
	BOLD_COLOR_ENABLED: 'mvp-bold-color-enabled-cache',
	BOLD_COLOR: 'mvp-bold-color-cache',
} as const

export const EARLY_STYLE_IDS = {
	ULTRAWIDE: 'mvp-ultrawide-early',
	CENTERED_POSTS: 'mvp-centered-posts-early',
	HIDDEN_THREADS: 'mvp-hidden-threads-early',
	HIDDEN_THREADS_FALLBACK: 'mvp-hidden-threads-early-fallback',
} as const

