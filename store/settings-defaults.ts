/**
 * Settings Defaults - Default values for all settings
 *
 * This module contains ONLY default values (no Zod).
 * Used by settings-store.ts for initialization.
 *
 * IMPORTANT: Keep in sync with settings-schema.ts
 */
import type { Settings } from './settings-types'

/** Default settings values */
export const DEFAULT_SETTINGS: Settings = {
	// Theme & Appearance
	theme: 'dark',
	boldColor: '#c9a227',
	codeTheme: 'github-dark',

	// API Keys
	imgbbApiKey: '',
	tmdbApiKey: '',
	giphyApiKey: '',

	// AI Settings
	geminiApiKey: '',
	aiModel: 'gemini-2.5-flash',

	// Sync
	syncEnabled: false,

	// Feature Toggles - Navigation
	infiniteScrollEnabled: false,
	liveThreadEnabled: false,
	nativeLiveDelayEnabled: true,
	galleryButtonEnabled: true,

	// Feature Toggles - Editor
	cinemaButtonEnabled: true,
	gifPickerEnabled: true,
	draftsButtonEnabled: true,
	templateButtonEnabled: true,

	// Feature Toggles - Content
	mediaHoverCardsEnabled: true,
	pinnedPostsEnabled: true,
	threadSummarizerEnabled: true,
	postSummaryEnabled: true,
	saveThreadEnabled: true,
	// Feature Toggles - Users
	mutedWordsEnabled: false,
	mutedWords: [],

	// Privacy & Storage
	enableActivityTracking: true,

	// UI State
	settingsActiveTab: 'integrations',

	// Layout
	ultrawideMode: 'off',

	// Keyboard Shortcuts
	shortcuts: {},
}

/**
 * Get default value for a specific setting
 */
export function getDefaultValue<K extends keyof Settings>(key: K): Settings[K] {
	return DEFAULT_SETTINGS[key]
}
