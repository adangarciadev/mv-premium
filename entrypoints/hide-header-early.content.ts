/**
 * Early Hide Header Injection Script
 *
 * Runs at document_start (before DOM is parsed) to hide the header
 * immediately, preventing the "flash of visible header".
 *
 * Uses localStorage as SYNCHRONOUS cache for instant access.
 * The main hide-header feature keeps this cache in sync.
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'

const STYLE_ID = EARLY_STYLE_IDS.HIDE_HEADER
const CACHE_KEY = RUNTIME_CACHE_KEYS.HIDE_HEADER

interface SettingsState {
	state: {
		hideHeaderEnabled: boolean
	}
}

function injectStyle(): void {
	document.getElementById(STYLE_ID)?.remove()

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		/* MVP Hide Header Early Inject */
		#header {
			display: none !important;
		}
		body {
			padding-top: 0 !important;
		}
	`

	const target = document.head || document.documentElement
	if (target) {
		target.appendChild(style)
	}
}

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

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		// STEP 1: Read from localStorage SYNCHRONOUSLY (instant, no flash)
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached === 'true') {
				injectStyle()
			}
		} catch {
			// localStorage might be disabled
		}

		// STEP 2: Verify with browser.storage (async) and update cache if needed
		browser.storage.local
			.get(STORAGE_KEYS.SETTINGS)
			.then(data => {
				const raw = data[STORAGE_KEYS.SETTINGS] as string | SettingsState | undefined
				if (!raw) {
					updateCache(false)
					document.getElementById(STYLE_ID)?.remove()
					return
				}

				const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
				const enabled = parsed?.state?.hideHeaderEnabled ?? false

				updateCache(enabled)

				if (enabled) {
					// Ensure style is injected (in case localStorage was empty)
					if (!document.getElementById(STYLE_ID)) {
						injectStyle()
					}
				} else {
					document.getElementById(STYLE_ID)?.remove()
				}
			})
			.catch(() => {
				// Silent fail
			})
	},
})
