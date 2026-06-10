import { MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'

const STYLE_ID = 'mvp-mobile-lite-thread-companion-styles'

let initialized = false

function isMobileLiteThreadCompanionAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

export function initMobileLiteThreadCompanion(): void {
	if (!isMobileLiteThreadCompanionAllowed()) return
	if (initialized) return

	initialized = true
	if (document.getElementById(STYLE_ID)) return

	// Mediavida's desktop sticky-sidebar logic keeps #thread-companion at
	// position: fixed and writes an inline `top` in DOCUMENT coordinates (the end
	// of the thread). On the narrow mobile viewport nothing compensates for that,
	// so the companion — and every action inside it (Favorito, Ignorar, our Live
	// button…) — sits thousands of pixels below the screen on every page except
	// the last one. Force it back into the document flow, like the last page.
	// (!important in a stylesheet beats MV's non-important inline `top`.)
	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		${MV_SELECTORS.GLOBAL.THREAD_COMPANION} {
			position: static !important;
			top: auto !important;
			width: auto !important;
			transform: none !important;
			opacity: 1 !important;
		}
	`
	document.head.appendChild(style)
}

export function teardownMobileLiteThreadCompanion(): void {
	document.getElementById(STYLE_ID)?.remove()
	initialized = false
}
