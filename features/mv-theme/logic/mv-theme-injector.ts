/**
 * MV Theme Injector - Runtime listener for content scripts
 *
 * Watches for storage changes and updates the injected <style> tag
 * in real-time when the user modifies theme settings in the dashboard.
 *
 * The early content script handles initial injection at document_start.
 * This module handles live updates during the page session.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { EARLY_STYLE_IDS } from '@/constants/runtime-cache'
import { getCompressed } from '@/lib/storage/compressed-storage'

const STYLE_ID = EARLY_STYLE_IDS.MV_THEME

/**
 * Initialize MV theme listener for live updates.
 * Call once from entrypoints/content/main.ts.
 */
export function initMvThemeListener(): void {
	const themeStorage = storage.defineItem<{ enabled: boolean }>(`local:${STORAGE_KEYS.MV_THEME}`, {
		defaultValue: { enabled: false },
	})
	const cssStorageKey = `local:${STORAGE_KEYS.MV_THEME_CSS}` as const
	const cssStorageWatcher = storage.defineItem<string>(cssStorageKey, {
		defaultValue: '',
	})

	// Watch for theme state changes (enabled/disabled)
	themeStorage.watch(async (newValue) => {
		if (!newValue?.enabled) {
			// Remove override styles
			document.getElementById(STYLE_ID)?.remove()
			return
		}

		// Re-read CSS (compressed-aware) and inject
		const css = (await getCompressed<string>(cssStorageKey)) || ''
		if (css) {
			injectOrUpdateStyle(css)
		}
	})

	// Watch for CSS changes (color edits from dashboard)
	cssStorageWatcher.watch(async () => {
		const state = await themeStorage.getValue()
		if (!state?.enabled) return

		const newCSS = (await getCompressed<string>(cssStorageKey)) || ''
		if (newCSS) {
			injectOrUpdateStyle(newCSS)
		} else {
			document.getElementById(STYLE_ID)?.remove()
		}
	})
}

/**
 * Insert or update the MV theme style element.
 */
function injectOrUpdateStyle(css: string): void {
	let style = document.getElementById(STYLE_ID)
	if (style) {
		style.textContent = css
	} else {
		style = document.createElement('style')
		style.id = STYLE_ID
		style.textContent = css
		;(document.head || document.documentElement).appendChild(style)
	}
}
