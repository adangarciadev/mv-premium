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
const AGE_CACHE_KEY = RUNTIME_CACHE_KEYS.RELATED_THREADS_MAX_AGE

interface SettingsState {
	state: {
		relatedThreadsDisplay?: RelatedThreadsDisplay
		relatedThreadsMaxAgeMonths?: number
	}
}

function readCachedMaxAge(): number {
	try {
		const months = Number.parseInt(localStorage.getItem(AGE_CACHE_KEY) ?? '', 10)
		return Number.isFinite(months) && months > 0 ? months : 0
	} catch {
		// localStorage might be disabled
		return 0
	}
}

function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = '.hilos-relacionados { display: none !important; }'
	;(document.head || document.documentElement)?.append(style)
}

function applyMode(mode: RelatedThreadsDisplay, maxAgeMonths: number): void {
	try {
		localStorage.setItem(CACHE_KEY, mode)
		localStorage.setItem(AGE_CACHE_KEY, String(maxAgeMonths))
	} catch {
		// localStorage might be disabled
	}

	// With an age limit the block is hidden too, even in collapsible/original mode: the rows are
	// filtered after hydration, and painting the stale ones first would show them flashing away.
	// The main feature removes this style once it has filtered.
	if (mode === 'hidden' || maxAgeMonths > 0) {
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

		applyMode(cachedMode, readCachedMaxAge())

		browser.storage.local
			.get(STORAGE_KEYS.SETTINGS)
			.then(data => {
				const raw = data[STORAGE_KEYS.SETTINGS] as string | SettingsState | undefined
				if (!raw) {
					applyMode('hidden', 0)
					return
				}

				const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
				applyMode(parsed?.state?.relatedThreadsDisplay ?? 'hidden', parsed?.state?.relatedThreadsMaxAgeMonths ?? 0)
			})
			.catch(() => {
				// Keep the synchronously cached mode when storage is unavailable
			})
	},
})
