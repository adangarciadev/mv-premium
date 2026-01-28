/**
 * Early Ultrawide Injection Script
 *
 * This script runs at document_start (before DOM is parsed) to apply
 * the ultrawide mode immediately, preventing the "flash of narrow layout".
 *
 * CRITICAL: Uses localStorage as SYNCHRONOUS cache for instant access.
 * browser.storage.local is async and causes visual flash even at document_start.
 *
 * Flow:
 * 1. Read from localStorage (sync, instant) -> apply CSS immediately
 * 2. Verify with browser.storage (async) -> update cache if different
 *
 * The main ultrawide feature (features/ultrawide/index.ts) handles:
 * - Reactivity to setting changes
 * - Keeping localStorage cache in sync
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'

type UltrawideMode = 'off' | 'wide' | 'extra-wide' | 'full'

interface SettingsState {
	state: {
		ultrawideMode: UltrawideMode
	}
}

const STYLE_ID = 'mvp-ultrawide-early'
const CACHE_KEY = 'mvp-ultrawide-mode-cache'

/**
 * CSS selectors for Mediavida layout elements
 * Duplicated here to avoid import dependencies at document_start
 */
const SELECTORS = {
	MAIN_WRAPPER: '#main.wrp',
	WRAPPER: '.wrp',
	CONTENT_WRAPPER: '.wrw',
	CONTENT_CONTAINER: '.wpx',
	MAIN_CONTENT: '.c-main',
	FULL_WIDTH_TABLE: 'table.mv.full',
	POST_BODY_LEGACY: '.cuerpo',
	POSTS_ALT: '#posts',
}

/**
 * Generates CSS for the selected ultrawide mode
 */
function generateStyles(mode: UltrawideMode): string | null {
	if (mode === 'off') return null

	const widthConfig = {
		wide: { maxWidth: '1400px', padding: '0' },
		'extra-wide': { maxWidth: '1800px', padding: '0' },
		full: { maxWidth: 'none', padding: '30px' },
	}

	const config = widthConfig[mode]

	return `
		/* MVP Ultrawide Early Inject - ${mode} */

		/* Main wrapper */
		${SELECTORS.MAIN_WRAPPER},
		${SELECTORS.WRAPPER} {
			max-width: ${config.maxWidth} !important;
			width: 100% !important;
			padding-left: ${config.padding} !important;
			padding-right: ${config.padding} !important;
		}

		/* Content wrapper */
		${SELECTORS.CONTENT_WRAPPER} {
			max-width: ${config.maxWidth} !important;
		}

		/* Content container */
		${SELECTORS.CONTENT_CONTAINER} {
			max-width: ${config.maxWidth} !important;
			width: 100% !important;
		}

		/* Main content area */
		${SELECTORS.MAIN_CONTENT} {
			max-width: ${config.maxWidth} !important;
			flex: 1 !important;
		}

		/* Full width tables */
		${SELECTORS.FULL_WIDTH_TABLE} {
			width: 100% !important;
		}

		/* Thread content area */
		${SELECTORS.POST_BODY_LEGACY} {
			max-width: ${config.maxWidth} !important;
			width: 100% !important;
			padding-left: ${config.padding} !important;
			padding-right: ${config.padding} !important;
		}

		/* Posts container */
		${SELECTORS.POSTS_ALT} {
			max-width: ${config.maxWidth} !important;
		}
	`
}

/**
 * Injects the style element into the document
 */
function injectStyle(mode: UltrawideMode): void {
	const css = generateStyles(mode)
	if (!css) return

	// Remove existing style if any
	document.getElementById(STYLE_ID)?.remove()

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = css

	// Inject into head or documentElement (whichever exists first)
	const target = document.head || document.documentElement
	if (target) {
		target.appendChild(style)
	}
}

/**
 * Updates the localStorage cache
 */
function updateCache(mode: UltrawideMode): void {
	try {
		if (mode === 'off') {
			localStorage.removeItem(CACHE_KEY)
		} else {
			localStorage.setItem(CACHE_KEY, mode)
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
			const cachedMode = localStorage.getItem(CACHE_KEY) as UltrawideMode | null
			if (cachedMode && cachedMode !== 'off') {
				injectStyle(cachedMode)
			}
		} catch {
			// localStorage might be disabled
		}

		// STEP 2: Verify with browser.storage (async) and update cache if needed
		browser.storage.local
			.get('mvp-settings')
			.then(data => {
				const raw = data['mvp-settings'] as string | SettingsState | undefined
				if (!raw) {
					// No settings = clear cache and remove styles
					updateCache('off')
					document.getElementById(STYLE_ID)?.remove()
					return
				}

				const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
				const mode = parsed?.state?.ultrawideMode ?? 'off'

				// Update cache for next page load
				updateCache(mode)

				// If mode changed from what we applied, update styles
				const cachedMode = localStorage.getItem(CACHE_KEY)
				if (mode !== cachedMode) {
					if (mode === 'off') {
						document.getElementById(STYLE_ID)?.remove()
					} else {
						injectStyle(mode)
					}
				}
			})
			.catch(() => {
				// Silent fail
			})
	},
})
