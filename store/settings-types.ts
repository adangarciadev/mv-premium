/**
 * Settings Types - Pure TypeScript types for extension settings
 *
 * This module contains ONLY types (no runtime code).
 * It's used by the content script to avoid importing Zod.
 *
 * IMPORTANT: Keep in sync with settings-schema.ts
 */

import type { UserTemplates } from '@/types/templates'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Theme options */
export type ThemeMode = 'light' | 'dark' | 'system'

/** AI Model options - Gemini */
export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite'

/** Combined AI model type */
export type AIModel = GeminiModel

/** Ultrawide mode levels */
export type UltrawideMode = 'off' | 'wide' | 'extra-wide' | 'full'

/** Dashboard icon options */
export type DashboardIcon = 'logo' | 'user-shield' | 'dashboard' | 'rocket' | 'gears'

/** Centered posts control bar position */
export type CenteredControlsPosition = 'top' | 'side'

/** Game release calendar display mode */
export type GameReleaseCalendarLayout = 'showcase' | 'minimal' | 'bottom'

/** Work mode sub-options */
export interface WorkModeOptions {
	hideAvatars: boolean
	hideImages: boolean
	hideVideos: boolean
	hideSocialEmbeds: boolean
	hideSteamCards: boolean
	hideForumIcons: boolean
	disguiseTab: boolean
}

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
	aiModel: GeminiModel

	// Sync
	syncEnabled: boolean

	// Feature Toggles - Navigation
	infiniteScrollEnabled: boolean
	autoInfiniteScrollEnabled: boolean
	liveThreadEnabled: boolean
	newHomepageEnabled: boolean
	galleryButtonEnabled: boolean
	nativeLiveDelayEnabled: boolean
	liveThreadDelayEnabled: boolean
	navbarSearchEnabled: boolean

	// Feature Toggles - Editor
	cinemaButtonEnabled: boolean
	gameButtonEnabled: boolean
	gifPickerEnabled: boolean
	draftsButtonEnabled: boolean
	templateButtonEnabled: boolean

	// Feature Toggles - Content
	mediaHoverCardsEnabled: boolean
	steamBundleInlineCardsEnabled: boolean
	itadSubforumSearchEnabled: boolean
	itadSubforumSearchJuegosEnabled: boolean
	itadSubforumSearchHuchaEnabled: boolean
	gameReleaseCalendarEnabled: boolean
	gameReleaseCalendarJuegosEnabled: boolean
	gameReleaseCalendarLayout: GameReleaseCalendarLayout
	threadClipperSubforums: string[]
	twitterLiteEmbedsEnabled: boolean
	pinnedPostsEnabled: boolean
	threadSummarizerEnabled: boolean
	postSummaryEnabled: boolean
	saveThreadEnabled: boolean
	hideThreadEnabled: boolean
	hideIgnoredUserThreadsEnabled: boolean

	// Feature Toggles - Users
	mutedWordsEnabled: boolean
	mutedWords: string[]

	// Privacy & Storage
	enableActivityTracking: boolean

	// UI State
	settingsActiveTab: string
	variablesSidebarExpandedGroups: string[]

	// Work Mode
	workModeEnabled: boolean
	workModeOptions: WorkModeOptions
	workModeTabTitle: string

	// Layout
	hideHeaderEnabled: boolean
	ultrawideMode: UltrawideMode
	centeredPostsEnabled: boolean
	centeredControlsSticky: boolean
	centeredControlsPosition: CenteredControlsPosition

	// Keyboard Shortcuts
	shortcuts: Record<string, string | null>

	// Media Templates (null = use default)
	mediaTemplates: UserTemplates
}

/** Partial settings for updates */
export type SettingsUpdate = Partial<Settings>

/** Keys of settings (for selectors) */
export type SettingsKey = keyof Settings
