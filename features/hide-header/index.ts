/**
 * Hide Header Feature
 *
 * Allows users to hide the Mediavida top navigation header (#header).
 * Toggleable via settings or keyboard shortcut.
 *
 * Works with hide-header-early.content.ts which applies styles at document_start
 * using a localStorage cache to prevent flash. This module takes over reactivity
 * and keeps the cache in sync.
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

const STYLE_ID = DOM_MARKERS.IDS.HIDE_HEADER_STYLES
const EARLY_STYLE_ID = EARLY_STYLE_IDS.HIDE_HEADER
const CACHE_KEY = RUNTIME_CACHE_KEYS.HIDE_HEADER
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`

interface SettingsState {
	state: {
		hideHeaderEnabled: boolean
	}
}

/**
 * Updates the localStorage cache for instant access on next page load.
 */
function updateCache(enabled: boolean): void {
	try {
		if (enabled) {
			localStorage.setItem(CACHE_KEY, 'true')
		} else {
			localStorage.removeItem(CACHE_KEY)
		}
	} catch {
		// localStorage might be disabled
	}
}

function applyHideHeader(enabled: boolean): void {
	updateCache(enabled)

	// Remove existing styles (both main and early-inject to avoid duplication)
	document.getElementById(STYLE_ID)?.remove()
	document.getElementById(EARLY_STYLE_ID)?.remove()

	if (!enabled) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
    /* MVP Hide Header */
    #header {
      display: none !important;
    }
    body {
      padding-top: 0 !important;
    }
  `
	document.head.appendChild(style)
}

/**
 * Toggle the header visibility. Used by keyboard shortcuts.
 */
export async function toggleHideHeader(): Promise<void> {
	try {
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)
		if (!raw) return

		const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
		const current = parsed?.state?.hideHeaderEnabled ?? false
		const next = !current

		// Update storage — the watcher will apply the change
		parsed.state.hideHeaderEnabled = next
		await storage.setItem(SETTINGS_KEY, typeof raw === 'string' ? JSON.stringify(parsed) : parsed)
	} catch (e) {
		logger.error('Hide header toggle error:', e)
	}
}

export async function initHideHeader(): Promise<void> {
	try {
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
			const enabled = parsed?.state?.hideHeaderEnabled ?? false
			applyHideHeader(enabled)
		}

		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const parsed: SettingsState = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
				const enabled = parsed?.state?.hideHeaderEnabled ?? false
				applyHideHeader(enabled)
			} catch (e) {
				logger.error('Hide header error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('Hide header failed to initialize:', error)
	}
}
