/**
 * Settings Store - Unified storage for all extension settings.
 *
 * This is the SINGLE SOURCE OF TRUTH for settings. Uses Zustand with persist
 * middleware for automatic storage synchronization.
 *
 * Storage Backend: @wxt-dev/storage (WXT unified storage API)
 *
 * ARCHITECTURE:
 * - Types: Pure TypeScript (settings-types.ts) - no runtime deps
 * - Defaults: Simple JS (settings-defaults.ts) - no Zod
 * - Persistence: WXT storage API with Zustand persist middleware
 *
 * NOTE: Zod validation is NOT used here to keep the bundle small.
 * Validation can be added in options page if needed.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS } from '@/constants'
import type { Settings, SettingsKey } from './settings-types'
import { DEFAULT_SETTINGS } from './settings-defaults'

// Re-export for backwards compatibility
export { DEFAULT_SETTINGS }

// =============================================================================
// TYPES
// =============================================================================

/** Settings actions (setters) */
interface SettingsActions {
	// Generic setter for any setting key
	setSetting: <K extends SettingsKey>(key: K, value: Settings[K]) => void

	// Individual setters for backward compatibility with existing components
	// Theme & Appearance
	setTheme: (theme: Settings['theme']) => void
	setBoldColor: (color: string) => void
	setCodeTheme: (theme: string) => void

	// API Keys
	setImgbbApiKey: (key: string) => void
	setTmdbApiKey: (key: string) => void
	setGiphyApiKey: (key: string) => void

	// AI Settings
	setGeminiApiKey: (key: string) => void
	setAIModel: (model: Settings['aiModel']) => void

	// Sync
	setSyncEnabled: (enabled: boolean) => void

	// Navigation
	setInfiniteScrollEnabled: (enabled: boolean) => void
	setLiveThreadEnabled: (enabled: boolean) => void
	setNativeLiveDelayEnabled: (enabled: boolean) => void

	// Users
	setMutedWordsEnabled: (enabled: boolean) => void
	setMutedWords: (words: string[]) => void

	// UI State
	setSettingsActiveTab: (tab: string) => void

	// Layout
	setUltrawideMode: (mode: Settings['ultrawideMode']) => void

	// Keyboard Shortcuts
	setShortcut: (actionId: string, keyCombo: string | null) => void

	// Batch operations
	updateSettings: (updates: Partial<Settings>) => void
	resetSettings: () => void
}

/** Complete store state = Settings data + Actions */
export type SettingsState = Settings & SettingsActions

/** Settings data without actions (for partial updates) */
export type SettingsData = Settings

// =============================================================================
// STORAGE ADAPTER - Uses WXT Storage API
// =============================================================================

/**
 * WXT Storage Item for the settings store.
 * Using local: prefix for browser.storage.local
 */
const settingsStorageItem = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
	fallback: null,
})

/**
 * Creates a storage adapter for Zustand persist middleware.
 * Uses WXT storage API for unified cross-context storage.
 */
const createWxtStorageAdapter = () => ({
	getItem: async (name: string): Promise<string | null> => {
		try {
			if (name === STORAGE_KEYS.SETTINGS) {
				return await settingsStorageItem.getValue()
			}
			return await storage.getItem<string>(`local:${name}`)
		} catch (error) {
			logger.warn('WXT storage.getItem failed:', error)
			return null
		}
	},
	setItem: async (name: string, value: string): Promise<void> => {
		try {
			if (name === STORAGE_KEYS.SETTINGS) {
				await settingsStorageItem.setValue(value)
			} else {
				await storage.setItem(`local:${name}`, value)
			}
		} catch (error) {
			logger.warn('WXT storage.setItem failed:', error)
		}
	},
	removeItem: async (name: string): Promise<void> => {
		try {
			if (name === STORAGE_KEYS.SETTINGS) {
				await settingsStorageItem.removeValue()
			} else {
				await storage.removeItem(`local:${name}`)
			}
		} catch (error) {
			logger.warn('WXT storage.removeItem failed:', error)
		}
	},
})

const storageAdapter = createWxtStorageAdapter()

// =============================================================================
// STORE
// =============================================================================

export const useSettingsStore = create<SettingsState>()(
	persist(
		set => ({
			...DEFAULT_SETTINGS,

			// Generic setter for any setting key
			setSetting: (key, value) => set({ [key]: value } as Partial<Settings>),

			// Theme & Appearance
			setTheme: theme => set({ theme }),
			setBoldColor: color => {
			set({ boldColor: color })
			// Also write to the separate key that content script watches
			storage.setItem(`local:${STORAGE_KEYS.BOLD_COLOR}`, color)
		},
			setCodeTheme: theme => set({ codeTheme: theme }),

			// API Keys (all persisted via Zustand persist middleware)
			setImgbbApiKey: key => set({ imgbbApiKey: key }),
			setTmdbApiKey: key => set({ tmdbApiKey: key }),
			setGiphyApiKey: key => set({ giphyApiKey: key }),

			// AI Settings
			setGeminiApiKey: key => set({ geminiApiKey: key }),
			setAIModel: model => set({ aiModel: model }),

			// Sync
			setSyncEnabled: enabled => set({ syncEnabled: enabled }),

			// Navigation
			// Both can be enabled in settings - mutual exclusion happens at button level in threads
			setInfiniteScrollEnabled: enabled => set({ infiniteScrollEnabled: enabled }),
			setLiveThreadEnabled: enabled => set({ liveThreadEnabled: enabled }),
			setNativeLiveDelayEnabled: enabled => set({ nativeLiveDelayEnabled: enabled }),

			// Users
			setMutedWordsEnabled: enabled => set({ mutedWordsEnabled: enabled }),
			setMutedWords: words => set({ mutedWords: words }),

			// UI State
			setSettingsActiveTab: tab => set({ settingsActiveTab: tab }),

			// Layout
			setUltrawideMode: mode => set({ ultrawideMode: mode }),

			// Keyboard Shortcuts
			setShortcut: (actionId, keyCombo) =>
				set(state => ({
					shortcuts: { ...state.shortcuts, [actionId]: keyCombo },
				})),

			// Batch update for multiple settings at once
			updateSettings: updates => {
				const safeUpdates = Object.fromEntries(
					Object.entries(updates).filter(([, value]) => typeof value !== 'function')
				)
				set(safeUpdates as Partial<Settings>)
			},

			resetSettings: () => set(DEFAULT_SETTINGS),
		}),
		{
			name: STORAGE_KEYS.SETTINGS,
			storage: createJSONStorage(() => storageAdapter),
			skipHydration: true,

			// Simple merge without Zod validation (for smaller bundle)
			// Just merge persisted state with defaults
			merge: (persistedState, currentState) => {
				if (persistedState && typeof persistedState === 'object') {
					// Only merge known settings keys to avoid polluting state
					const validKeys = Object.keys(DEFAULT_SETTINGS) as SettingsKey[]
					const persisted = persistedState as Record<string, unknown>

					const validatedState = Object.fromEntries(
						validKeys.filter((key): boolean => key in persisted).map(key => [key, persisted[key]] as const)
					) as Partial<Settings>

					return { ...currentState, ...validatedState }
				}

				return currentState
			},

			onRehydrateStorage: () => {
				return () => {
					_hasHydrated = true
					_hydrationPromiseResolve?.()
				}
			},
		}
	)
)

// =============================================================================
// HYDRATION HELPERS
// =============================================================================

let _hasHydrated = false
let _hydrationPromiseResolve: (() => void) | null = null
let _hydrationPromise: Promise<void> | null = null

/** Check if store has been hydrated from storage */
export function hasHydrated(): boolean {
	return _hasHydrated
}

/** Wait for hydration to complete (use in useEffect) */
export function waitForHydration(): Promise<void> {
	if (_hasHydrated) return Promise.resolve()
	if (!_hydrationPromise) {
		_hydrationPromise = new Promise(resolve => {
			_hydrationPromiseResolve = resolve
		})
	}
	return _hydrationPromise
}

// =============================================================================
// HELPER FUNCTIONS (for use outside React)
// =============================================================================

/** Get settings state outside React contexts */
export async function getSettings(): Promise<Partial<Settings>> {
	try {
		const raw = await storageAdapter.getItem(STORAGE_KEYS.SETTINGS)
		if (raw && typeof raw === 'string') {
			const parsed = JSON.parse(raw)
			const state = parsed.state || {}
			// Simple validation - only return known keys
			const validKeys = Object.keys(DEFAULT_SETTINGS) as SettingsKey[]
			const validated: Partial<Settings> = {}
			for (const key of validKeys) {
				if (key in state) {
					validated[key] = state[key]
				}
			}
			return validated
		}
	} catch {
		// Ignore parse errors
	}
	return {}
}

/**
 * Get storage usage info.
 * Estimates based on JSON stringified data size.
 */
export async function getSyncStorageInfo(): Promise<{ bytesUsed: number; bytesQuota: number }> {
	try {
		const data = await settingsStorageItem.getValue()
		const bytesUsed = data ? new Blob([data]).size : 0
		return {
			bytesUsed,
			bytesQuota: 5242880, // 5MB for local storage
		}
	} catch {
		return { bytesUsed: 0, bytesQuota: 5242880 }
	}
}

// =============================================================================
// CROSS-TAB SYNCHRONIZATION
// =============================================================================

/**
 * Watch for settings changes from other tabs/contexts.
 * Uses WXT storage.watch() for real-time cross-tab sync.
 * Call this in content scripts or options page to keep state in sync.
 */
export function initCrossTabSync(): () => void {
	const unwatch = settingsStorageItem.watch(newValue => {
		if (!newValue) return

		try {
			const parsed = JSON.parse(newValue)
			const newState = parsed.state
			if (!newState || typeof newState !== 'object') return

			// Simple validation - only use known keys
			const validKeys = Object.keys(DEFAULT_SETTINGS) as SettingsKey[]
			const currentState = useSettingsStore.getState()
			const updates: Partial<Settings> = {}

			for (const key of validKeys) {
				if (key in newState) {
					const currentValue = currentState[key]
					if (JSON.stringify(currentValue) !== JSON.stringify(newState[key])) {
						updates[key] = newState[key] as never
					}
				}
			}

			if (Object.keys(updates).length > 0) {
				useSettingsStore.setState(updates)
			}
		} catch (error) {
			logger.warn('Cross-tab sync parse error:', error)
		}
	})

	return unwatch
}

// =============================================================================
// CONVENIENCE SELECTORS
// =============================================================================

// Note: Individual setters removed - use useSettingsStore().setSetting(key, value) directly
// This reduces file size by ~70 lines and avoids maintaining duplicate code.
