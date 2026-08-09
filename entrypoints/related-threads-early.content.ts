/**
 * Early Related Threads Injection Script
 *
 * Runs at document_start and hides related threads before Mediavida paints
 * them. The regular feature replaces this style after reading hydrated state.
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import type { RelatedThreadsDisplay } from '@/store/settings-types'

const STYLE_ID = EARLY_STYLE_IDS.RELATED_THREADS
const CACHE_KEY = RUNTIME_CACHE_KEYS.RELATED_THREADS_DISPLAY

interface SettingsState {
	state: {
		relatedThreadsDisplay?: RelatedThreadsDisplay
	}
}

function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = '.hilos-relacionados { display: none !important; }'
	;(document.head || document.documentElement)?.append(style)
}

function applyMode(mode: RelatedThreadsDisplay): void {
	try {
		localStorage.setItem(CACHE_KEY, mode)
	} catch {
		// localStorage might be disabled
	}

	if (mode === 'hidden') {
		injectStyle()
	} else {
		document.getElementById(STYLE_ID)?.remove()
	}
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/foro/*'],
	runAt: 'document_start',

	main() {
		let cachedMode: RelatedThreadsDisplay = 'hidden'

		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached === 'hidden' || cached === 'collapsible' || cached === 'original') {
				cachedMode = cached
			}
		} catch {
			// localStorage might be disabled
		}

		applyMode(cachedMode)

		browser.storage.local
			.get(STORAGE_KEYS.SETTINGS)
			.then(data => {
				const raw = data[STORAGE_KEYS.SETTINGS] as string | SettingsState | undefined
				if (!raw) {
					applyMode('hidden')
					return
				}

				const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
				applyMode(parsed?.state?.relatedThreadsDisplay ?? 'hidden')
			})
			.catch(() => {
				// Keep the synchronously cached mode when storage is unavailable
			})
	},
})
