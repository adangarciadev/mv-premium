/**
 * Inject Delay Control
 *
 * Injects the delay control widget into native LIVE thread pages.
 * Mounts next to the "LIVE" indicator in the header.
 */

import { FEATURE_IDS } from '@/constants/feature-ids'
import { mountFeatureWithBoundary, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DelayControl } from '../components/delay-control'
import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'

// Import CSS for Light DOM animations (applied globally)
import '../styles/native-live-delay.css'

/**
 * Injects the native live delay control widget.
 * Called when on a native LIVE thread page.
 */
export function injectNativeLiveDelayControl(): void {
	// Check if feature is enabled
	if (!isFeatureEnabled(FeatureFlag.NativeLiveDelay)) {
		return
	}

	// Already injected?
	if (isFeatureMounted(FEATURE_IDS.NATIVE_LIVE_DELAY_CONTROL)) {
		return
	}

	// Find native LIVE header
	const liveHeader = document.querySelector('#live.lv2-t') as HTMLElement | null
	if (!liveHeader) {
		return
	}

	// Find the LIVE indicator span (contains the fa-reload icon and "LIVE" text)
	// Structure: <span title="..."><i class="fa fa-reload"></i> LIVE</span>
	const liveIndicator = liveHeader.querySelector('span[title]') as HTMLElement | null
	
	if (!liveIndicator) {
		return
	}

	// Create container and insert after LIVE indicator span
	const container = createContainer()
	liveIndicator.parentNode?.insertBefore(container, liveIndicator.nextSibling)
	mountControl(container)
}

function createContainer(): HTMLDivElement {
	const container = document.createElement('div')
	container.id = FEATURE_IDS.NATIVE_LIVE_DELAY_CONTROL
	container.style.cssText = 'display: inline-flex; margin-left: 12px; vertical-align: middle;'
	return container
}

function mountControl(container: HTMLElement): void {
	mountFeatureWithBoundary(
		FEATURE_IDS.NATIVE_LIVE_DELAY_CONTROL,
		container,
		<ShadowWrapper className="relative z-50">
			<DelayControl />
		</ShadowWrapper>,
		'Control de Delay LIVE'
	)
}
