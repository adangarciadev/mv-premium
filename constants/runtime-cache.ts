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
	POST_FONT_SIZE: 'mvp-post-font-size-cache',
	MV_THEME_ENABLED: 'mvp-mv-theme-enabled-cache',
	MV_THEME_CSS: 'mvp-mv-theme-css-cache',
	HIDE_HEADER: 'mvp-hide-header-cache',
	WORK_MODE: 'mvp-work-mode-cache',
	WORK_MODE_OPTIONS: 'mvp-work-mode-options-cache',
	WORK_MODE_TAB_TITLE: 'mvp-work-mode-tab-title-cache',
} as const

export const EARLY_STYLE_IDS = {
	ULTRAWIDE: 'mvp-ultrawide-early',
	CENTERED_POSTS: 'mvp-centered-posts-early',
	HIDDEN_THREADS: 'mvp-hidden-threads-early',
	HIDDEN_THREADS_FALLBACK: 'mvp-hidden-threads-early-fallback',
	MV_THEME: 'mvp-mv-theme-early',
	HIDE_HEADER: 'mvp-hide-header-early',
	WORK_MODE: 'mvp-work-mode-early',
} as const

