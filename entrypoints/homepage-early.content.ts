import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'

interface SettingsState {
	state?: {
		newHomepageEnabled?: boolean
	}
}

const READY_EVENT = 'mvp:new-homepage-ready'
const HP_ATTR = 'data-mvp-hp'
const FAILSAFE_TIMEOUT_MS = 2500

function isHomepagePath(): boolean {
	const pathname = window.location.pathname
	return pathname === '/' || pathname === '' || /^\/p\d+$/.test(pathname)
}

function getCachedEnabled(): boolean {
	try {
		return localStorage.getItem(RUNTIME_CACHE_KEYS.NEW_HOMEPAGE_ENABLED) === 'true'
	} catch {
		return false
	}
}

function setCachedEnabled(enabled: boolean): void {
	try {
		localStorage.setItem(RUNTIME_CACHE_KEYS.NEW_HOMEPAGE_ENABLED, String(enabled))
	} catch {
		// localStorage may be unavailable
	}
}

function parseNewHomepageEnabled(raw: unknown): boolean {
	if (!raw) return false

	try {
		const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : (raw as SettingsState)
		return Boolean(parsed?.state?.newHomepageEnabled)
	} catch {
		return false
	}
}

const STYLE_ID = 'mvp-hp-style'

function injectHidingStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		html[data-mvp-hp] {
			overflow: hidden;
		}
		html[data-mvp-hp] #content {
			opacity: 0 !important;
			min-height: 100vh;
		}
		html[data-mvp-hp] #main {
			visibility: hidden !important;
			min-height: 100vh;
		}
		@keyframes mvp-hp-reveal {
			from { opacity: 0; }
			to { opacity: 1; }
		}
	`
	document.documentElement.appendChild(style)
}

/**
 * Hide/reveal using a data attribute on <html>.
 * The matching CSS rule lives in app.css (manifest-injected = before any rendering).
 * Setting an attribute on documentElement is faster than creating/appending a <style>.
 */
function hideHomepage(): void {
	injectHidingStyles()
	document.documentElement.setAttribute(HP_ATTR, '')
}

function revealHomepage(): void {
	document.documentElement.removeAttribute(HP_ATTR)

	// Smooth fade-in to mask the hidden→visible transition
	const content = document.getElementById('content')
	if (content) {
		content.style.animation = 'mvp-hp-reveal 0.15s ease-out'
		content.addEventListener('animationend', () => {
			content.style.removeProperty('animation')
		}, { once: true })
	}
}

function isHidden(): boolean {
	return document.documentElement.hasAttribute(HP_ATTR)
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		if (!isHomepagePath()) return

		const cachedEnabled = getCachedEnabled()

		let failSafeTimeout: number | null = null

		const cleanup = () => {
			if (failSafeTimeout) {
				window.clearTimeout(failSafeTimeout)
				failSafeTimeout = null
			}
		}

		const startFailSafe = () => {
			if (failSafeTimeout) return
			failSafeTimeout = window.setTimeout(() => {
				revealHomepage()
				cleanup()
			}, FAILSAFE_TIMEOUT_MS)
		}

		// Phase 1: Optimistic hide based on localStorage cache
		if (cachedEnabled) {
			hideHomepage()
			startFailSafe()
		}

		// Phase 2: Listen for ready event from React component
		document.addEventListener(
			READY_EVENT,
			() => {
				revealHomepage()
				cleanup()
			},
			{ once: true }
		)

		// Phase 3: Verify against actual storage (async)
		browser.storage.local
			.get(STORAGE_KEYS.SETTINGS)
			.then(data => {
				const enabled = parseNewHomepageEnabled(data[STORAGE_KEYS.SETTINGS])
				setCachedEnabled(enabled)

				if (!enabled) {
					revealHomepage()
					cleanup()
					return
				}

				if (!isHidden()) {
					hideHomepage()
					startFailSafe()
				}
			})
			.catch(() => {
				// keep cache-based decision if storage read fails
			})
	},
})
