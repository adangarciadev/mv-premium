/**
 * Early MV Theme Injection Script
 *
 * Runs at document_start to apply MV site color overrides immediately,
 * preventing flash of the original theme colors.
 *
 * Same localStorage cache pattern as ultrawide-early.content.ts.
 *
 * Flow:
 * 1. Read from localStorage (sync, instant) → inject CSS immediately
 * 2. Verify with browser.storage (async) → update cache if different
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import { getCompressed } from '@/lib/storage/compressed-storage'
import { parseMvThemeEnabled } from '@/features/mv-theme/logic/theme-state'

const STYLE_ID = EARLY_STYLE_IDS.MV_THEME
const CACHE_KEY_ENABLED = RUNTIME_CACHE_KEYS.MV_THEME_ENABLED
const CACHE_KEY_CSS = RUNTIME_CACHE_KEYS.MV_THEME_CSS

/**
 * Injects CSS into the document head (or documentElement if head isn't ready).
 */
function injectStyle(css: string): void {
	if (!css) return

	// Remove existing style if any
	document.getElementById(STYLE_ID)?.remove()

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = css

	const target = document.head || document.documentElement
	if (target) {
		target.appendChild(style)
	}
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		// STEP 1: Read from localStorage SYNCHRONOUSLY (instant, no flash)
		try {
			const enabled = localStorage.getItem(CACHE_KEY_ENABLED)
			if (enabled === 'true') {
				const css = localStorage.getItem(CACHE_KEY_CSS)
				if (css) injectStyle(css)
			}
		} catch {
			// localStorage might be disabled
		}

		// STEP 2: Verify with browser.storage (async) and update cache if needed
		Promise.all([
			browser.storage.local.get(STORAGE_KEYS.MV_THEME),
			getCompressed<string>(`local:${STORAGE_KEYS.MV_THEME_CSS}`),
		])
			.then(([themeData, rawCSS]) => {
				const rawTheme = themeData[STORAGE_KEYS.MV_THEME] as string | { enabled: boolean } | undefined

				// Parse theme state
				const enabled = parseMvThemeEnabled(rawTheme)

				const css = rawCSS || ''

				// Update localStorage cache
				try {
					if (enabled && css) {
						localStorage.setItem(CACHE_KEY_ENABLED, 'true')
						localStorage.setItem(CACHE_KEY_CSS, css)
					} else {
						localStorage.removeItem(CACHE_KEY_ENABLED)
						localStorage.removeItem(CACHE_KEY_CSS)
					}
				} catch {
					// localStorage might be disabled
				}

				// Apply or remove styles
				if (enabled && css) {
					injectStyle(css)
				} else {
					document.getElementById(STYLE_ID)?.remove()
				}
			})
			.catch(() => {
				// Silent fail
			})
	},
})
