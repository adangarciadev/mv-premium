/**
 * Thread Summarizer Injection
 *
 * Injects the summarizer button into the thread page.
 * Uses createThreadActionButton utility for standardized button injection.
 */

import { isThreadPage } from '@/features/gallery/lib/thread-scraper'
import { mountFeature, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import {
	createThreadActionButton,
	isThreadActionButtonInjected,
	removeThreadActionButton,
	type ThreadActionButtonResult,
} from '@/lib/content-modules/utils/thread-action-button'
import { SummaryModal } from '../components/summary-modal'
import { createElement } from 'react'
import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

// =============================================================================
// CONSTANTS
// =============================================================================

const BUTTON_ID = DOM_MARKERS.IDS.SUMMARIZER_BTN
const MODAL_FEATURE_ID = FEATURE_IDS.THREAD_SUMMARIZER_MODAL
const MODAL_CONTAINER_ID = DOM_MARKERS.IDS.SUMMARIZER_MODAL

// =============================================================================
// STATE
// =============================================================================

let buttonResult: ThreadActionButtonResult | null = null

// =============================================================================
// MODAL WRAPPER
// =============================================================================

function SummaryModalWrapper({ onClose }: { onClose: () => void }) {
	return createElement(SummaryModal, { isOpen: true, onClose })
}

/**
 * Mounts the Thread Summarizer modal into the document body.
 */
function openSummaryModal(): void {
	if (isFeatureMounted(MODAL_FEATURE_ID)) return

	let container = document.getElementById(MODAL_CONTAINER_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = MODAL_CONTAINER_ID
		document.body.appendChild(container)
	}

	mountFeature(
		MODAL_FEATURE_ID,
		container,
		createElement(SummaryModalWrapper, {
			onClose: () => closeSummaryModal(),
		})
	)
}

function closeSummaryModal(): void {
	unmountFeature(MODAL_FEATURE_ID)

	const container = document.getElementById(MODAL_CONTAINER_ID)
	if (container) {
		container.remove()
	}
}

// =============================================================================
// INJECTION
// =============================================================================

/**
 * Injects the AI Thread Summarizer action button into the thread action bar.
 */
export function injectSummarizerButton(): void {
	if (isThreadActionButtonInjected(BUTTON_ID)) return
	if (!isThreadPage()) return

	buttonResult = createThreadActionButton({
		id: BUTTON_ID,
		icon: 'fa-magic',
		text: 'Resumir',
		tooltip: 'Resumir hilo con IA',
		ariaLabel: 'Resumir hilo con inteligencia artificial',
		onClick: () => openSummaryModal(),
	})
}

/**
 * Safely removes the summarizer button and any active modal from the DOM.
 */
export function cleanupSummarizerButton(): void {
	if (buttonResult) {
		buttonResult.remove()
		buttonResult = null
	} else {
		removeThreadActionButton(BUTTON_ID)
	}

	// Also close modal if open
	closeSummaryModal()
}
