/**
 * Muted Words Storage
 * Adapts the feature to read from the unified Settings Store
 */
import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS } from '@/constants'

// The key used by Zustand persist middleware
const SETTINGS_STORAGE_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`

interface SettingsStoreState {
	state: {
		mutedWords: string[]
		mutedWordsEnabled: boolean
	}
	version: number
}

/**
 * Retrieves the muted words and enabled status from the centralized settings store.
 * Handles both stringified and object formats due to persistence layers.
 */
export async function getMutedWordsConfig(): Promise<{ words: string[]; enabled: boolean }> {
	try {
		const raw = await storage.getItem<string | SettingsStoreState>(SETTINGS_STORAGE_KEY)

		if (!raw) return { words: [], enabled: false }

		let parsed: SettingsStoreState
		if (typeof raw === 'string') {
			parsed = JSON.parse(raw) as SettingsStoreState
		} else {
			parsed = raw as SettingsStoreState
		}

		return {
			words: parsed?.state?.mutedWords || [],
			enabled: parsed?.state?.mutedWordsEnabled ?? false,
		}
	} catch (e) {
		logger.error('Error reading settings storage:', e)
		return { words: [], enabled: false }
	}
}

/**
 * Subscribes to changes in the settings store and triggers a callback with new muted words config.
 * @param callback - Function to execute when config changes
 * @returns Cleanup function to stop watching
 */
export function watchMutedWordsConfig(callback: (config: { words: string[]; enabled: boolean }) => void): () => void {
	return storage.watch<string | SettingsStoreState>(SETTINGS_STORAGE_KEY, newValue => {
		if (!newValue) {
			callback({ words: [], enabled: false })
			return
		}

		try {
			let parsed: SettingsStoreState
			if (typeof newValue === 'string') {
				parsed = JSON.parse(newValue) as SettingsStoreState
			} else {
				parsed = newValue as SettingsStoreState
			}

			callback({
				words: parsed?.state?.mutedWords || [],
				enabled: parsed?.state?.mutedWordsEnabled ?? false,
			})
		} catch (e) {
			logger.error('Error parsing watched settings:', e)
		}
	})
}
