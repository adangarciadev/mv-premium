/**
 * Early Centered Posts Injection Script
 *
 * This script runs at document_start (before DOM is parsed) to apply
 * the centered posts mode immediately, preventing the "flash of sidebar".
 *
 * CRITICAL: Uses localStorage as SYNCHRONOUS cache for instant access.
 * browser.storage.local is async and causes visual flash even at document_start.
 *
 * The main centered-posts feature (features/centered-posts/index.ts) handles:
 * - Control bar creation and element moving
 * - Reactivity to setting changes
 * - Keeping localStorage cache in sync
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'

interface SettingsState {
	state: {
		centeredPostsEnabled: boolean
	}
}

const STYLE_ID = EARLY_STYLE_IDS.CENTERED_POSTS
const CACHE_KEY = RUNTIME_CACHE_KEYS.CENTERED_POSTS

/**
 * Check if current page is a thread page
 * Pattern: /foro/{subforum}/{thread-slug}
 */
function isThreadPage(): boolean {
	const pathname = window.location.pathname
	const segments = pathname.split('/').filter(Boolean)
	return segments.length >= 3 && segments[0] === 'foro'
}

/**
 * CSS selectors for Mediavida layout elements
 */
const SELECTORS = {
	C_SIDE: '.c-side',
	CONTENT_WRAPPER: '.wrw',
	MAIN_CONTENT: '.c-main',
}

/**
 * Generates CSS to hide sidebar and expand content
 * Uses 100% width - same as main script to prevent layout shift
 */
function generateStyles(): string {
	return `
		/* MVP Centered Posts Early Inject */

		/* Hide Sidebar immediately */
		${SELECTORS.C_SIDE},
		.wrw > .c-side,
		#main .c-side {
			display: none !important;
		}

		/* Content wrapper - force full width */
		${SELECTORS.CONTENT_WRAPPER},
		.wrw,
		#main > .wrw,
		#main.wrp > .wrw {
			display: block !important;
			width: 100% !important;
			max-width: none !important;
		}

		/* Main Content Area - expand to full width */
		${SELECTORS.MAIN_CONTENT},
		.c-main,
		#post-container,
		.wrw > .c-main,
		#main .wrw .c-main,
		#main.wrp .wrw .c-main,
		div.c-main#post-container {
			width: 100% !important;
			max-width: none !important;
			padding-right: 0 !important;
			padding-left: 0 !important;
			float: none !important;
			display: block !important;
			margin-left: auto !important;
			margin-right: auto !important;
			flex: unset !important;
			box-sizing: border-box !important;
		}

		/* Inner content container */
		.wpx,
		.c-main > .wpx,
		#post-container > .wpx {
			width: 100% !important;
			max-width: none !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			box-sizing: border-box !important;
		}

		/* Posts and containers */
		#topic,
		#posts-wrap,
		.post,
		#postit.postit,
		.postit {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* Postit toggle button area */
		#postit.postit,
		.postit {
			position: relative !important;
			padding-top: 40px !important;
		}

		#postit.postit.oculto,
		.postit.oculto {
			padding-top: 0 !important;
		}

		#postit.postit > a.toggle,
		.postit > a.toggle {
			position: absolute !important;
			top: 8px !important;
			right: 8px !important;
			z-index: 10 !important;
		}

		/* Side navigation - align with content edge (always, not just when affix) */
		#side-nav {
			transform: translateX(-11px) !important;
		}
	`
}

/**
 * Injects the style element into the document
 */
function injectStyle(): void {
	document.getElementById(STYLE_ID)?.remove()

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = generateStyles()

	const target = document.head || document.documentElement
	if (target) {
		target.appendChild(style)
	}
}

/**
 * Updates the localStorage cache
 */
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
	matches: ['*://www.mediavida.com/foro/*/*'],
	runAt: 'document_start',

	main() {
		if (!isThreadPage()) {
			return
		}

		// Read from localStorage SYNCHRONOUSLY
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached === 'true') {
				injectStyle()
			}
		} catch {
			// localStorage might be disabled
		}

		// Verify with browser.storage (async)
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
				const enabled = parsed?.state?.centeredPostsEnabled ?? false

				updateCache(enabled)

				const wasCached = localStorage.getItem(CACHE_KEY) === 'true'
				if (enabled !== wasCached) {
					if (!enabled) {
						document.getElementById(STYLE_ID)?.remove()
					} else {
						injectStyle()
					}
				}
			})
			.catch(() => {
				// Silent fail
			})
	},
})
