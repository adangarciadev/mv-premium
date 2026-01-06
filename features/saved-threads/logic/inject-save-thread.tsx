import { mountFeature, unmountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { getExtraActionsRow } from '@/lib/content-modules/utils/extra-actions-row'
import { isThreadPage } from '@/features/gallery/lib/thread-scraper'
import { SaveThreadButton } from '../components/save-thread-button'
import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

// =============================================================================
// CONSTANTS
// =============================================================================

const FEATURE_ID = FEATURE_IDS.SAVE_THREAD_BUTTON
const CONTAINER_ID = DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER

// =============================================================================
// INJECTION
// =============================================================================

/**
 * Inject the save thread button into the thread page.
 * Places it in the shared extra-actions row below #more-actions.
 */
export function injectSaveThreadButton(): void {
	// Only inject on thread pages
	if (!isThreadPage()) return

	// Check if already mounted
	if (isFeatureMounted(FEATURE_ID)) return

	// Get or create the extra actions row
	const extraActions = getExtraActionsRow()
	if (!extraActions) return

	// Create container for React component
	const container = document.createElement('span')
	container.id = CONTAINER_ID
	container.style.display = 'inline-flex'

	// Insert as first button in the row
	extraActions.insertAdjacentElement('afterbegin', container)

	// Mount React component (Directly in Light DOM for native styling)
	mountFeature(FEATURE_ID, container, <SaveThreadButton />)
}

/**
 * Cleanup save thread button and unmount React component
 */
export function cleanupSaveThreadButton(): void {
	unmountFeature(FEATURE_ID)

	const container = document.getElementById(CONTAINER_ID)
	if (container) {
		container.remove()
	}
}
