/**
 * Settings Store - Public API
 *
 * This file re-exports all settings-related utilities for convenience.
 *
 * Usage examples:
 *
 * ```tsx
 * // Basic usage (with selectors for optimal performance)
 * import { useSettingsStore, selectInfiniteScrollEnabled } from '@/store/settings'
 * const infiniteScrollEnabled = useSettingsStore(selectInfiniteScrollEnabled)
 *
 * // With setter
 * const setInfiniteScrollEnabled = useSettingsStore(s => s.setInfiniteScrollEnabled)
 *
 * // Batch update
 * const updateSettings = useSettingsStore(s => s.updateSettings)
 * updateSettings({ infiniteScrollEnabled: true, liveThreadEnabled: true })
 *
 * // Validation
 * import { validateSettingValue } from '@/store/settings'
 * const validColor = validateSettingValue('boldColor', '#ff5912')
 * ```
 */

// Main store and defaults
export {
	useSettingsStore,
	DEFAULT_SETTINGS,
	hasHydrated,
	waitForHydration,
	getSettings,
	getSyncStorageInfo,
	initCrossTabSync,
	type SettingsData,
} from './settings-store'

// Zod schema and validation (only import in options/background, not content script)
export {
	settingsSchema,
	aiModelSchema,
	validateSettings,
	safeValidateSettings,
	validateSettingValue,
	getDefaultValue,
} from './settings-schema'

// Pure types (safe for content script - no runtime deps)
export type { Settings, SettingsUpdate, SettingsKey, ThemeMode, AIModel, UltrawideMode } from './settings-types'

// Granular selectors (for optimal re-renders)
export {
	// Generic
	createSettingSelector,
	// Theme & Appearance
	selectTheme,
	selectBoldColor,
	selectCodeTheme,
	// API Keys
	selectImgbbApiKey,
	selectTmdbApiKey,
	selectGiphyApiKey,
	selectGeminiApiKey,
	selectAIModel,
	// Navigation
	selectInfiniteScrollEnabled,
	selectLiveThreadEnabled,
	// Users
	selectMutedWordsEnabled,
	selectMutedWords,
	// UI State
	selectSettingsActiveTab,
	// Advanced
	selectDebugMode,
	selectSyncEnabled,
	// Composite selectors
	selectApiKeys,
	// Hooks with built-in selectors
	useTheme,
	useDebugMode,
} from './settings-selectors'
