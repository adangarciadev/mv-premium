import { getPlatformKind } from '@/lib/platform'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { useSettingsStore } from '@/store/settings-store'
import { startTwitterLiteEmbedGuard, stopTwitterLiteEmbedGuard } from '@/lib/content-modules/utils/reinitialize-embeds'

let initialized = false
let startTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleStart(): void {
	if (!initialized || startTimeout !== null) return
	// Match desktop Firefox: let Mediavida finish preparing its native embeds.
	startTimeout = setTimeout(() => {
		startTimeout = null
		if (initialized) startTwitterLiteEmbedGuard()
	}, 150)
}

/** Settings changes apply on reload, as explained by the mobile panel. */
export function initMobileLiteTwitterLite(): void {
	if (initialized || getPlatformKind() !== 'firefox-android' || !isFeatureEnabled(FeatureFlag.MobileLite)) return
	if (useSettingsStore.getState().twitterLiteEmbedsEnabled !== true) return
	initialized = true
	document.documentElement.setAttribute('data-mvp-mobile-twitter-lite', 'true')
	if (document.readyState === 'complete') {
		scheduleStart()
	} else {
		window.addEventListener('load', scheduleStart, { once: true })
	}
}

export function teardownMobileLiteTwitterLite(): void {
	if (!initialized) return
	initialized = false
	document.documentElement.removeAttribute('data-mvp-mobile-twitter-lite')
	window.removeEventListener('load', scheduleStart)
	if (startTimeout !== null) clearTimeout(startTimeout)
	startTimeout = null
	stopTwitterLiteEmbedGuard()
}
