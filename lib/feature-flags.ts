/**
 * Feature Flags System
 *
 * Centralized feature flag management for enabling/disabling features.
 * Integrates with the settings store for user-controlled toggles.
 *
 * @example
 * ```ts
 * import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'
 *
 * if (isFeatureEnabled(FeatureFlag.InfiniteScroll)) {
 *   initInfiniteScroll()
 * }
 * ```
 */

import { useSettingsStore } from '@/store/settings-store'

// =============================================================================
// FEATURE FLAG DEFINITIONS
// =============================================================================

/**
 * All available feature flags in the extension.
 * Use these constants to check feature availability.
 */
export const FeatureFlag = {
	// Core Features (always enabled)
	Editor: 'editor',
	CommandMenu: 'command-menu',
	Bookmarks: 'bookmarks',
	Favorites: 'favorites',

	// User-controlled Features (via settings)
	InfiniteScroll: 'infinite-scroll',
	LiveThread: 'live-thread',
	MutedWords: 'muted-words',

	// Premium/Advanced Features (enabled by default)
	Gallery: 'gallery',
	PostSummary: 'post-summary',
	ThreadSummarizer: 'thread-summarizer',
	CinemaCards: 'cinema-cards',
	MediaHoverCards: 'media-hover-cards',
	PinnedPosts: 'pinned-posts',
	SavedThreads: 'saved-threads',

	// Experimental Features (may require debug mode)
	ThemeEditor: 'theme-editor',
	NewThread: 'new-thread',
	TableEditor: 'table-editor',
} as const

export type FeatureFlagKey = typeof FeatureFlag[keyof typeof FeatureFlag]

// =============================================================================
// FEATURE FLAG CONFIGURATION
// =============================================================================

interface FeatureConfig {
	/** Feature is always enabled (no user toggle) */
	alwaysEnabled?: boolean
	/** Settings key that controls this feature */
	settingsKey?: string
	/** Requires debug mode to be enabled */
	requiresDebug?: boolean
	/** Requires specific API key to be set */
	requiresApiKey?: string
	/** Custom check function */
	customCheck?: () => boolean
}

const FEATURE_CONFIG: Record<FeatureFlagKey, FeatureConfig> = {
	// Core Features
	[FeatureFlag.Editor]: { alwaysEnabled: true },
	[FeatureFlag.CommandMenu]: { alwaysEnabled: true },
	[FeatureFlag.Bookmarks]: { alwaysEnabled: true },
	[FeatureFlag.Favorites]: { alwaysEnabled: true },

	// User-controlled Features
	[FeatureFlag.InfiniteScroll]: { settingsKey: 'infiniteScrollEnabled' },
	[FeatureFlag.LiveThread]: { settingsKey: 'liveThreadEnabled' },
	[FeatureFlag.MutedWords]: { settingsKey: 'mutedWordsEnabled' },

	// Premium Features (always enabled by default, some need API keys)
	[FeatureFlag.Gallery]: { alwaysEnabled: true },
	[FeatureFlag.PostSummary]: { alwaysEnabled: true },
	[FeatureFlag.ThreadSummarizer]: { requiresApiKey: 'geminiApiKey' },
	[FeatureFlag.CinemaCards]: { requiresApiKey: 'tmdbApiKey' },
	[FeatureFlag.MediaHoverCards]: { alwaysEnabled: true },
	[FeatureFlag.PinnedPosts]: { alwaysEnabled: true },
	[FeatureFlag.SavedThreads]: { alwaysEnabled: true },

	// Experimental Features
	[FeatureFlag.ThemeEditor]: { alwaysEnabled: true },
	[FeatureFlag.NewThread]: { alwaysEnabled: true },
	[FeatureFlag.TableEditor]: { alwaysEnabled: true },
}

// =============================================================================
// FEATURE FLAG CHECKS
// =============================================================================

/**
 * Check if a feature is enabled.
 * This is a synchronous check that reads from the settings store.
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
	const config = FEATURE_CONFIG[flag]
	if (!config) return false

	// Always enabled features
	if (config.alwaysEnabled) return true

	const state = useSettingsStore.getState()

	// Check debug mode requirement
	if (config.requiresDebug && !state.debugMode) return false

	// Check API key requirement
	if (config.requiresApiKey) {
		const apiKey = state[config.requiresApiKey as keyof typeof state]
		if (!apiKey || (typeof apiKey === 'string' && apiKey.trim() === '')) {
			return false
		}
	}

	// Check settings toggle
	if (config.settingsKey) {
		return Boolean(state[config.settingsKey as keyof typeof state])
	}

	// Custom check
	if (config.customCheck) {
		return config.customCheck()
	}

	return true
}

/**
 * React hook to subscribe to a feature flag.
 * Re-renders when the feature's enabled state changes.
 *
 * @param flag - The feature flag to watch
 * @returns true if the feature is enabled
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
	const config = FEATURE_CONFIG[flag]
	if (!config) return false

	// Always enabled features don't need store subscription
	if (config.alwaysEnabled) return true

	// Subscribe to relevant settings
	const settingsKey = config.settingsKey
	const requiresApiKey = config.requiresApiKey
	const requiresDebug = config.requiresDebug

	// Use Zustand selector to only re-render on relevant changes
	const enabled = useSettingsStore(state => {
		if (requiresDebug && !state.debugMode) return false

		if (requiresApiKey) {
			const apiKey = state[requiresApiKey as keyof typeof state]
			if (!apiKey || (typeof apiKey === 'string' && apiKey.trim() === '')) {
				return false
			}
		}

		if (settingsKey) {
			return Boolean(state[settingsKey as keyof typeof state])
		}

		return true
	})

	return enabled
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all enabled features (useful for debugging/logging)
 */
export function getEnabledFeatures(): FeatureFlagKey[] {
	return Object.values(FeatureFlag).filter(flag => isFeatureEnabled(flag))
}

/**
 * Get all disabled features with reasons
 */
export function getDisabledFeatures(): Array<{ flag: FeatureFlagKey; reason: string }> {
	const disabled: Array<{ flag: FeatureFlagKey; reason: string }> = []

	for (const flag of Object.values(FeatureFlag)) {
		if (isFeatureEnabled(flag)) continue

		const config = FEATURE_CONFIG[flag]
		let reason = 'Unknown'

		if (config.settingsKey) {
			reason = `Setting '${config.settingsKey}' is disabled`
		} else if (config.requiresApiKey) {
			reason = `Missing API key: ${config.requiresApiKey}`
		} else if (config.requiresDebug) {
			reason = 'Debug mode required'
		}

		disabled.push({ flag, reason })
	}

	return disabled
}
