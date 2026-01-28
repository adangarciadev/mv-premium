/**
 * Early Bold Color Injection Script
 *
 * This script runs at document_start (before DOM is parsed) to apply
 * the custom bold color immediately, preventing the "flash of default color".
 *
 * CRITICAL: Uses localStorage as SYNCHRONOUS cache for instant access.
 * browser.storage.local is async and causes visual flash even at document_start.
 *
 * Flow:
 * 1. Read from localStorage (sync, instant) -> apply CSS variable immediately
 * 2. Verify with browser.storage (async) -> update cache if different
 *
 * The main bold color feature (init-bold-color.ts) handles:
 * - Reactivity to setting changes
 * - Keeping localStorage cache in sync
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'

const CACHE_KEY_ENABLED = 'mvp-bold-color-enabled-cache'
const CACHE_KEY_COLOR = 'mvp-bold-color-cache'
const CSS_VAR = '--mvp-bold-color'

/**
 * Applies the bold color CSS variable to the document root
 */
function applyBoldColor(color: string | null, enabled: boolean): void {
	const target = document.documentElement
	if (!target) return

	if (!enabled || !color) {
		target.style.setProperty(CSS_VAR, 'inherit')
	} else {
		target.style.setProperty(CSS_VAR, color)
	}
}

/**
 * Updates the localStorage cache
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

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		// STEP 1: Read from localStorage SYNCHRONOUSLY (instant, no flash)
		try {
			const cachedEnabled = localStorage.getItem(CACHE_KEY_ENABLED) === 'true'
			const cachedColor = localStorage.getItem(CACHE_KEY_COLOR)

			if (cachedEnabled && cachedColor) {
				applyBoldColor(cachedColor, true)
			}
		} catch {
			// localStorage might be disabled
		}

		// STEP 2: Verify with browser.storage (async) and update cache if needed
		browser.storage.local
			.get(['mvp-bold-color-enabled', 'mvp-bold-color'])
			.then(data => {
				const enabled = data['mvp-bold-color-enabled'] as boolean | undefined
				const color = data['mvp-bold-color'] as string | undefined

				// Update cache for next page load
				updateCache(!!enabled, color ?? null)

				// Apply the actual values (may differ from cache on first load)
				applyBoldColor(color ?? null, !!enabled)
			})
			.catch(() => {
				// Silent fail
			})
	},
})
