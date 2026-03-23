/**
 * Early Work Mode Injection Script
 *
 * Runs at document_start (before DOM is parsed) to hide visual content
 * immediately, preventing flash of images/media.
 *
 * Uses localStorage as SYNCHRONOUS cache for instant access.
 * The main work-mode feature keeps this cache in sync.
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import type { WorkModeOptions } from '@/store/settings-types'
import { DEFAULT_SETTINGS } from '@/store/settings-defaults'
import { buildWorkModeCSS } from '@/features/work-mode'

const STYLE_ID = EARLY_STYLE_IDS.WORK_MODE
const CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE
const OPTIONS_CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE_OPTIONS
const TAB_TITLE_CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE_TAB_TITLE

const DEFAULT_OPTIONS = DEFAULT_SETTINGS.workModeOptions
const DEFAULT_TAB_TITLE = DEFAULT_SETTINGS.workModeTabTitle

interface SettingsState {
	state: {
		workModeEnabled: boolean
		workModeOptions: WorkModeOptions
		workModeTabTitle: string
	}
}

function injectStyle(options: WorkModeOptions): void {
	document.getElementById(STYLE_ID)?.remove()

	const css = buildWorkModeCSS(options)
	if (!css) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = css

	const target = document.head || document.documentElement
	if (target) {
		target.appendChild(style)
	}
}

function updateCache(enabled: boolean, options: WorkModeOptions, tabTitle: string): void {
	try {
		if (enabled) {
			localStorage.setItem(CACHE_KEY, 'true')
			localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify(options))
			localStorage.setItem(TAB_TITLE_CACHE_KEY, tabTitle)
		} else {
			localStorage.removeItem(CACHE_KEY)
			localStorage.removeItem(OPTIONS_CACHE_KEY)
			localStorage.removeItem(TAB_TITLE_CACHE_KEY)
		}
	} catch {
		// localStorage might be disabled
	}
}

function getCachedOptions(): WorkModeOptions {
	try {
		const raw = localStorage.getItem(OPTIONS_CACHE_KEY)
		if (raw) return JSON.parse(raw)
	} catch {
		// Invalid cache
	}
	return DEFAULT_OPTIONS
}

function getCachedTabTitle(): string {
	try {
		return localStorage.getItem(TAB_TITLE_CACHE_KEY) || DEFAULT_TAB_TITLE
	} catch {
		return DEFAULT_TAB_TITLE
	}
}

/** Observer used by early tab disguise — kept as reference so it can be stopped from async verification */
let earlyTitleObserver: MutationObserver | null = null
/** Real page title captured from the parser's <title> element, before we override it */
let earlyOriginalTitle: string | null = null

/**
 * Apply tab title as early as possible via document.title setter.
 * At document_start the <title> element may not exist yet, so we also
 * set it and watch for when the parser creates the element.
 */
function applyEarlyTabDisguise(tabTitle: string): void {
	// Set immediately (works even before <title> exists)
	document.title = tabTitle

	// Also override once <title> appears (the parser may reset it)
	earlyTitleObserver = new MutationObserver(() => {
		const titleEl = document.querySelector('title')
		if (titleEl) {
			earlyTitleObserver?.disconnect()
			earlyTitleObserver = null

			// Save the real page title BEFORE we override it.
			// At this point titleEl.textContent is still what the parser set.
			if (earlyOriginalTitle === null && titleEl.textContent) {
				earlyOriginalTitle = titleEl.textContent
			}

			if (document.title !== tabTitle) {
				document.title = tabTitle
			}
		}
	})
	earlyTitleObserver.observe(document.documentElement, { childList: true, subtree: true })

	// Safety: disconnect after 5s regardless
	setTimeout(() => {
		earlyTitleObserver?.disconnect()
		earlyTitleObserver = null
	}, 5000)
}

/**
 * Undo the early tab disguise: restore the real page title.
 * Called when async verification finds work mode is actually disabled.
 */
function undoEarlyTabDisguise(): void {
	if (earlyTitleObserver) {
		earlyTitleObserver.disconnect()
		earlyTitleObserver = null
	}

	if (earlyOriginalTitle !== null) {
		// We captured the real title before overriding — restore it
		document.title = earlyOriginalTitle
		earlyOriginalTitle = null
	}
	// If earlyOriginalTitle is null, <title> hasn't been parsed yet.
	// The parser will set the correct title when it encounters <title>,
	// and since the observer is now disconnected, it won't be overridden.
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		let earlyDisguiseApplied = false

		// STEP 1: Read from localStorage SYNCHRONOUSLY (instant, no flash)
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached === 'true') {
				const options = getCachedOptions()
				injectStyle(options)

				// Apply tab disguise early
				if (options.disguiseTab) {
					applyEarlyTabDisguise(getCachedTabTitle())
					earlyDisguiseApplied = true
				}
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
					updateCache(false, DEFAULT_OPTIONS, DEFAULT_TAB_TITLE)
					document.getElementById(STYLE_ID)?.remove()
					if (earlyDisguiseApplied) undoEarlyTabDisguise()
					return
				}

				const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
				const enabled = parsed?.state?.workModeEnabled ?? false
				const options = parsed?.state?.workModeOptions ?? DEFAULT_OPTIONS
				const tabTitle = parsed?.state?.workModeTabTitle ?? DEFAULT_TAB_TITLE

				updateCache(enabled, options, tabTitle)

				if (enabled) {
					if (!document.getElementById(STYLE_ID)) {
						injectStyle(options)
					}
				} else {
					document.getElementById(STYLE_ID)?.remove()
					if (earlyDisguiseApplied) undoEarlyTabDisguise()
				}
			})
			.catch(() => {
				// Extension context may be invalidated (extension removed/updated).
				// Clean up stale cache so next page load won't apply the disguise.
				updateCache(false, DEFAULT_OPTIONS, DEFAULT_TAB_TITLE)
				document.getElementById(STYLE_ID)?.remove()
				if (earlyDisguiseApplied) undoEarlyTabDisguise()
			})
	},
})
