/**
 * Settings Types - Pure TypeScript types for extension settings
 *
 * This module contains ONLY types (no runtime code).
 * It's used by the content script to avoid importing Zod.
 *
 * IMPORTANT: Keep in sync with settings-schema.ts
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Theme options */
export type ThemeMode = 'light' | 'dark' | 'system'

/** AI Model options */
export type AIModel = 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gemini-1.5-flash' | 'gemini-1.5-pro'

/** Ultrawide mode levels */
export type UltrawideMode = 'off' | 'wide' | 'extra-wide' | 'full'

/** Dashboard icon options */
export type DashboardIcon = 'logo' | 'user-shield' | 'dashboard' | 'rocket' | 'gears'

/** Full settings object type */
export interface Settings {
	// Theme & Appearance
	theme: ThemeMode
	boldColor: string
	boldColorEnabled: boolean
	codeTheme: string
	dashboardIcon: DashboardIcon

	// API Keys
	imgbbApiKey: string
	tmdbApiKey: string
	giphyApiKey: string

	// AI Settings
	geminiApiKey: string
	aiModel: AIModel

	// Sync
	syncEnabled: boolean

	// Feature Toggles - Navigation
	infiniteScrollEnabled: boolean
	autoInfiniteScrollEnabled: boolean
	liveThreadEnabled: boolean
	galleryButtonEnabled: boolean
	nativeLiveDelayEnabled: boolean
	navbarSearchEnabled: boolean

	// Feature Toggles - Editor
	cinemaButtonEnabled: boolean
	gifPickerEnabled: boolean
	draftsButtonEnabled: boolean
	templateButtonEnabled: boolean

	// Feature Toggles - Content
	mediaHoverCardsEnabled: boolean
	pinnedPostsEnabled: boolean
	threadSummarizerEnabled: boolean
	postSummaryEnabled: boolean
	saveThreadEnabled: boolean

	// Feature Toggles - Users
	mutedWordsEnabled: boolean
	mutedWords: string[]

	// Privacy & Storage
	enableActivityTracking: boolean

	// UI State
	settingsActiveTab: string

	// Layout
	ultrawideMode: UltrawideMode
	centeredPostsEnabled: boolean
	centeredControlsSticky: boolean

	// Keyboard Shortcuts
	shortcuts: Record<string, string | null>
}

/** Partial settings for updates */
export type SettingsUpdate = Partial<Settings>

/** Keys of settings (for selectors) */
export type SettingsKey = keyof Settings
