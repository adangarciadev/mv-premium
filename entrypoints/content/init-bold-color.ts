/**
 * Bold Color Module
 * Applies custom bold text color from storage when enabled
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 *
 * NOTE: This module works with bold-color-early.content.ts which handles
 * instant application at document_start using localStorage cache.
 */
import { storage } from '#imports'
import { browser, type Browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants'

// localStorage cache keys (must match bold-color-early.content.ts)
const CACHE_KEY_ENABLED = 'mvp-bold-color-enabled-cache'
const CACHE_KEY_COLOR = 'mvp-bold-color-cache'

// Storage items for bold color settings
const boldColorStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.BOLD_COLOR}`, {
	defaultValue: null,
})

const boldColorEnabledStorage = storage.defineItem<boolean>(`local:${STORAGE_KEYS.BOLD_COLOR_ENABLED}`, {
	defaultValue: false,
})

/**
 * Updates the localStorage cache for instant access on next page load.
 */
function updateCache(enabled: boolean, color: string | null): void {
	try {
		localStorage.setItem(CACHE_KEY_ENABLED, String(enabled))
		if (color) {
			localStorage.setItem(CACHE_KEY_COLOR, color)
		} else {
			localStorage.removeItem(CACHE_KEY_COLOR)
		}
	} catch {
		// localStorage might be disabled
	}
}

/**
 * Apply custom bold text color from storage (only if enabled)
 * Sets the --mvp-bold-color CSS variable on the document root
 */
export async function applyBoldColor(): Promise<void> {
	try {
		const isEnabled = await boldColorEnabledStorage.getValue()
		const savedColor = await boldColorStorage.getValue()

		// Update localStorage cache for next page load
		updateCache(!!isEnabled, savedColor)

		if (!isEnabled) {
			// Set to 'inherit' to use native styling (overrides CSS fallback)
			document.documentElement.style.setProperty('--mvp-bold-color', 'inherit')
			return
		}

		if (savedColor) {
			document.documentElement.style.setProperty('--mvp-bold-color', savedColor)
		}
	} catch {
		// Ignore if storage is unavailable
	}
}

/**
 * Watch for bold color changes and apply instantly
 * Uses native browser.storage.onChanged for cross-context support
 */
export function watchBoldColor(): void {
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName !== 'local') return

		// Watch for enabled toggle changes
		if (changes[STORAGE_KEYS.BOLD_COLOR_ENABLED]) {
			const isEnabled = changes[STORAGE_KEYS.BOLD_COLOR_ENABLED].newValue as boolean

			// Update cache
			boldColorStorage.getValue().then(color => {
				updateCache(!!isEnabled, color)
			})

			if (!isEnabled) {
				document.documentElement.style.setProperty('--mvp-bold-color', 'inherit')
			} else {
				// Re-apply color when enabled
				void applyBoldColor()
			}
		}

		// Watch for color changes (only apply if enabled)
		if (changes[STORAGE_KEYS.BOLD_COLOR]) {
			const newColor = changes[STORAGE_KEYS.BOLD_COLOR].newValue as string | undefined

			// Check if enabled before applying
			boldColorEnabledStorage.getValue().then(isEnabled => {
				// Update cache
				updateCache(!!isEnabled, newColor ?? null)

				if (isEnabled && newColor) {
					document.documentElement.style.setProperty('--mvp-bold-color', newColor)
				}
			})
		}
	}
	browser.storage.onChanged.addListener(listener)
}

// Export storage items for external use if needed
export { boldColorStorage, boldColorEnabledStorage }
