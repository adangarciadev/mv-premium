/**
 * Bold Color Module
 * Applies custom bold text color from storage
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 */
import { storage } from '#imports'
import { browser, type Browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants'

// Storage item for bold color setting
const boldColorStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.BOLD_COLOR}`, {
	defaultValue: null,
})

/**
 * Apply custom bold text color from storage
 * Sets the --mvp-bold-color CSS variable on the document root
 */
export async function applyBoldColor(): Promise<void> {
	try {
		const savedColor = await boldColorStorage.getValue()
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
		if (areaName === 'local' && changes[STORAGE_KEYS.BOLD_COLOR]) {
			const newColor = changes[STORAGE_KEYS.BOLD_COLOR].newValue
			if (newColor) {
				document.documentElement.style.setProperty('--mvp-bold-color', newColor as string)
			}
		}
	}
	browser.storage.onChanged.addListener(listener)
}

// Export storage item for external use if needed
export { boldColorStorage }
