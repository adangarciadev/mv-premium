/**
 * Storage key prefixes used throughout the extension
 * All keys should start with 'mvp-' (Mediavida Premium) to avoid conflicts
 *
 * IMPORTANT: When adding new storage keys, add them here and use the constant
 */
export const STORAGE_KEYS = {
	// Core Settings
	SETTINGS: 'mvp-settings',
	SYNC_SETTINGS: 'mvp-sync-settings',
	PROFILE: 'mvp-profile',
	CURRENT_USER: 'mvp-current-user',

	// Theme
	THEME: 'mvp-ui-theme',
	THEME_RAW: 'mvp-ui-theme-raw',
	THEME_CUSTOM: 'mvp-theme-custom',
	THEME_SAVED_PRESETS: 'mvp-theme-saved-presets',
	CUSTOM_FONT: 'mvp-custom-font',
	APPLY_FONT_GLOBALLY: 'mvp-apply-font-globally',

	// API Keys
	IMGBB_KEY: 'mvp-imgbb-key',
	BOLD_COLOR: 'mvp-bold-color',

	// Features
	MUTED_WORDS: 'mvp-muted-words',
	SAVED_THREADS: 'mvp-saved-threads',
	USER_CUSTOMIZATIONS: 'mvp-user-customizations',
	FAVORITE_SUBFORUMS: 'mvp-favorite-subforums',
	LIVE_THREADS: 'mvp-live-threads',
	ACTIVITY: 'mvp-activity',
	LAST_SEEN_VERSION: 'mvp-last-seen-version',
	DRAFTS: 'mvp-drafts',
	EDITOR_PRESERVE: 'mvp-editor-preserve',
	BOOKMARKS_VIEW_MODE: 'mvp-bookmarks-view-mode',

	// UI State
	LIVE_PREVIEW_ENABLED: 'mvp-live-preview-enabled',
	LIVE_PREVIEW_POSITION: 'mvp-live-preview-position',

	// Prefixes (used for dynamic keys)
	PINNED_PREFIX: 'mvp-pinned-',
	DRAFT_PREFIX: 'mvp-draft-',
	AUTOSAVE_PREFIX: 'mvp-autosave-',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
