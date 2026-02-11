/**
 * Settings Defaults - Default values for all settings
 *
 * This module contains ONLY default values (no Zod).
 * Used by settings-store.ts for initialization.
 *
 * IMPORTANT: Keep in sync with settings-schema.ts
 */
import type { Settings } from './settings-types'
import { DEFAULT_USER_TEMPLATES } from '@/types/templates'

/** Default settings values */
export const DEFAULT_SETTINGS: Settings = {
	// Theme & Appearance
	theme: 'dark',
	boldColor: '',
	boldColorEnabled: false,
	codeTheme: 'github-dark',
	dashboardIcon: 'logo',

	// API Keys
	imgbbApiKey: '',
	tmdbApiKey: '',
	giphyApiKey: '',

	// AI Settings
	geminiApiKey: '',
	groqApiKey: '',
	aiModel: 'gemini-3-flash-preview',
	groqModel: 'moonshotai/kimi-k2-instruct',
	aiProvider: 'gemini',

	// Sync
	syncEnabled: false,

	// Feature Toggles - Navigation
	infiniteScrollEnabled: false,
	autoInfiniteScrollEnabled: false,
	liveThreadEnabled: false,
	nativeLiveDelayEnabled: true,
	galleryButtonEnabled: true,
	navbarSearchEnabled: true,

	// Feature Toggles - Editor
	cinemaButtonEnabled: true,
	gameButtonEnabled: true,
	gifPickerEnabled: true,
	draftsButtonEnabled: true,
	templateButtonEnabled: true,

	// Feature Toggles - Content
	mediaHoverCardsEnabled: true,
	steamBundleInlineCardsEnabled: true,
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
	variablesSidebarExpandedGroups: [],

	// Layout
	ultrawideMode: 'off',
	centeredPostsEnabled: false,
	centeredControlsSticky: false,

	// Keyboard Shortcuts
	shortcuts: {},

	// Media Templates (null = use default)
	mediaTemplates: DEFAULT_USER_TEMPLATES,
}

/**
 * Get default value for a specific setting
 */
export function getDefaultValue<K extends keyof Settings>(key: K): Settings[K] {
	return DEFAULT_SETTINGS[key]
}
