/**
 * Early Post Font Size Injection Script
 *
 * Runs at document_start (before DOM is parsed) to apply
 * the custom post font size immediately, preventing the "flash of default size".
 *
 * CRITICAL: Uses localStorage as SYNCHRONOUS cache for instant access.
 * browser.storage.local is async and causes visual flash even at document_start.
 *
 * Flow:
 * 1. Read from localStorage (sync, instant) -> apply CSS variable + data attribute
 * 2. Verify with browser.storage (async) -> update cache if different
 *
 * The main feature (init-post-font-size.ts) handles:
 * - Reactivity to setting changes
 * - Keeping localStorage cache in sync
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'

const CACHE_KEY = RUNTIME_CACHE_KEYS.POST_FONT_SIZE
const DATA_ATTR = 'data-mvp-font-scaled'
const CSS_VAR = '--mvp-post-font-size'
const DEFAULT_SIZE = 100

/**
 * Applies the font size CSS variable and data attribute to the document root
 */
function applyFontSize(size: number): void {
	const target = document.documentElement
	if (!target) return

	if (size === DEFAULT_SIZE) {
		target.removeAttribute(DATA_ATTR)
		target.style.removeProperty(CSS_VAR)
	} else {
		target.setAttribute(DATA_ATTR, '')
		target.style.setProperty(CSS_VAR, `${size}%`)
	}
}

/**
 * Updates the localStorage cache
 */
function updateCache(size: number): void {
	try {
		if (size === DEFAULT_SIZE) {
			localStorage.removeItem(CACHE_KEY)
		} else {
			localStorage.setItem(CACHE_KEY, String(size))
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
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached) {
				const size = Number(cached)
				if (!Number.isNaN(size) && size !== DEFAULT_SIZE) {
					applyFontSize(size)
				}
			}
		} catch {
			// localStorage might be disabled
		}

		// STEP 2: Verify with browser.storage (async) and update cache if needed
		browser.storage.local
			.get([STORAGE_KEYS.POST_FONT_SIZE])
			.then(data => {
				const size = (data[STORAGE_KEYS.POST_FONT_SIZE] as number) ?? DEFAULT_SIZE

				// Update cache for next page load
				updateCache(size)

				// Apply the actual values (may differ from cache on first load)
				applyFontSize(size)
			})
			.catch(() => {
				// Silent fail
			})
	},
})
