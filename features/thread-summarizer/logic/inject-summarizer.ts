/**
 * Thread Summarizer Injection
 *
 * Injects the summarizer button into the thread page.
 */

import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { SummaryModal } from '../components/summary-modal'
import { createSummarizerInjection } from './create-summarizer-injection'
import { getActiveUserFilter } from './extract-posts'

const { inject, cleanup } = createSummarizerInjection({
	buttonId: DOM_MARKERS.IDS.SUMMARIZER_BTN,
	modalFeatureId: FEATURE_IDS.THREAD_SUMMARIZER_MODAL,
	modalContainerId: DOM_MARKERS.IDS.SUMMARIZER_MODAL,
	ModalComponent: SummaryModal,
	button: {
		icon: 'fa-magic',
		text: 'Resumir',
		tooltip: 'Resumir página actual con IA',
		ariaLabel: 'Resumir página actual con inteligencia artificial',
	},
	getDynamicButton: () => {
		const filter = getActiveUserFilter()
		if (!filter) return {}
		return {
			text: `Analizar @${filter}`,
			tooltip: `Analizar a ${filter} en este hilo con IA`,
			ariaLabel: `Analizar a ${filter} en este hilo con inteligencia artificial`,
		}
	},
})

export const injectSummarizerButton = inject
export const cleanupSummarizerButton = cleanup
