/**
 * Settings Selectors - Granular selectors for optimized re-renders
 *
 * Use these selectors instead of accessing the store directly to avoid
 * re-rendering components when unrelated settings change.
 *
 * Example:
 * ```tsx
 * // ❌ Bad: re-renders on ANY setting change
 * const { infiniteScrollEnabled } = useSettingsStore()
 *
 * // ✅ Good: only re-renders when infiniteScrollEnabled changes
 * const infiniteScrollEnabled = useSettingsStore(selectInfiniteScrollEnabled)
 * ```
 */
import { useSettingsStore } from './settings-store'
import type { Settings, SettingsKey } from './settings-types'

// Type for the store state (settings + actions)
type SettingsStoreState = ReturnType<typeof useSettingsStore.getState>

// =============================================================================
// GENERIC SELECTOR CREATOR
// =============================================================================

/**
 * Creates a type-safe selector for a specific setting.
 * Use this to create custom selectors for settings not listed below.
 */
export function createSettingSelector<K extends SettingsKey>(key: K) {
	return (state: SettingsStoreState): Settings[K] => state[key] as Settings[K]
}

// =============================================================================
// THEME & APPEARANCE SELECTORS
// =============================================================================

export const selectTheme = (state: SettingsStoreState) => state.theme
export const selectBoldColor = (state: SettingsStoreState) => state.boldColor
export const selectCodeTheme = (state: SettingsStoreState) => state.codeTheme

// =============================================================================
// API KEYS SELECTORS
// =============================================================================

export const selectImgbbApiKey = (state: SettingsStoreState) => state.imgbbApiKey
export const selectTmdbApiKey = (state: SettingsStoreState) => state.tmdbApiKey
export const selectGiphyApiKey = (state: SettingsStoreState) => state.giphyApiKey
export const selectGeminiApiKey = (state: SettingsStoreState) => state.geminiApiKey
export const selectAIModel = (state: SettingsStoreState) => state.aiModel

// =============================================================================
// NAVIGATION SELECTORS
// =============================================================================

export const selectInfiniteScrollEnabled = (state: SettingsStoreState) => state.infiniteScrollEnabled
export const selectLiveThreadEnabled = (state: SettingsStoreState) => state.liveThreadEnabled

// =============================================================================
// USERS SELECTORS
// =============================================================================

export const selectMutedWordsEnabled = (state: SettingsStoreState) => state.mutedWordsEnabled
export const selectMutedWords = (state: SettingsStoreState) => state.mutedWords

// =============================================================================
// UI STATE SELECTORS
// =============================================================================

export const selectSettingsActiveTab = (state: SettingsStoreState) => state.settingsActiveTab

// =============================================================================
// ADVANCED SELECTORS
// =============================================================================

export const selectDebugMode = (state: SettingsStoreState) => state.debugMode
export const selectSyncEnabled = (state: SettingsStoreState) => state.syncEnabled

// =============================================================================
// COMPOSITE SELECTORS (for components that need multiple related values)
// =============================================================================





/** Selector for all API keys */
export const selectApiKeys = (state: SettingsStoreState) => ({
	imgbb: state.imgbbApiKey,
	tmdb: state.tmdbApiKey,
	giphy: state.giphyApiKey,
	gemini: state.geminiApiKey,
})

// =============================================================================
// HOOKS WITH BUILT-IN SELECTORS
// =============================================================================

/**
 * Hook that returns only the theme value.
 * More efficient than `useSettingsStore().theme`
 */
export function useTheme() {
	return useSettingsStore(selectTheme)
}

/**
 * Hook that returns debug mode status.
 */
export function useDebugMode() {
	return useSettingsStore(selectDebugMode)
}


