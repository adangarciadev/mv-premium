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

/** AI Model options - Groq */
export type GroqModel = 'llama-3.3-70b-versatile' | 'moonshotai/kimi-k2-instruct'

/** AI Provider options */
export type AIProvider = 'gemini' | 'groq'

/** Combined AI model type */
export type AIModel = GeminiModel | GroqModel

/** Ultrawide mode levels */
export type UltrawideMode = 'off' | 'wide' | 'extra-wide' | 'full'

/** Dashboard icon options */
export type DashboardIcon = 'logo' | 'user-shield' | 'dashboard' | 'rocket' | 'gears'

/** Centered posts control bar position */
export type CenteredControlsPosition = 'top' | 'side'

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
	groqApiKey: string
	aiModel: GeminiModel
	groqModel: GroqModel
	aiProvider: AIProvider

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
	twitterLiteEmbedsEnabled: boolean
	pinnedPostsEnabled: boolean
	threadSummarizerEnabled: boolean
	postSummaryEnabled: boolean
	saveThreadEnabled: boolean
	hideThreadEnabled: boolean

	// Feature Toggles - Users
	mutedWordsEnabled: boolean
	mutedWords: string[]

	// Privacy & Storage
	enableActivityTracking: boolean

	// UI State
	settingsActiveTab: string
	variablesSidebarExpandedGroups: string[]

	// Layout
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
