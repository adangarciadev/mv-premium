import { mountFeature, unmountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { getMainActionsRow } from '@/lib/content-modules/utils/extra-actions-row'
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

	// Always dedupe stale containers first (can happen after layout moves/reinjections).
	const existingContainers = document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`)
	if (existingContainers.length > 1) {
		const [, ...duplicates] = Array.from(existingContainers)
		duplicates.forEach(container => container.remove())
	}

	// Check if already mounted
	if (isFeatureMounted(FEATURE_ID)) return

	// If a previous container exists in DOM, reuse it.
	if (existingContainers.length > 0) {
		const [firstContainer] = Array.from(existingContainers)

		// If content is already present in the first container, avoid reinjecting.
		if (firstContainer.childElementCount > 0) return

		mountFeature(FEATURE_ID, firstContainer, <SaveThreadButton />)
		return
	}

	// Get or create the main actions row
	const mainActions = getMainActionsRow()
	if (!mainActions) return

	// Create container for React component
	const container = document.createElement('span')
	container.id = CONTAINER_ID
	container.style.display = 'inline-flex'

	// Insert as first button in the row
	mainActions.insertAdjacentElement('afterbegin', container)

	// Mount React component (Directly in Light DOM for native styling)
	mountFeature(FEATURE_ID, container, <SaveThreadButton />)
}

/**
 * Cleanup save thread button and unmount React component
 */
export function cleanupSaveThreadButton(): void {
	unmountFeature(FEATURE_ID)
	document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`).forEach(container => container.remove())
}
