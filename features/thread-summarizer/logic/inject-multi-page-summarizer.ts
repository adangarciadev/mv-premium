/**
 * Multi-Page Summarizer Injection
 *
 * Injects a separate button for multi-page thread summarization.
 */

import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { MultiPageSummaryModal } from '../components/multi-page-summary-modal'
import { createSummarizerInjection } from './create-summarizer-injection'
import { getActiveUserFilter } from './extract-posts'

const { inject, cleanup } = createSummarizerInjection({
	buttonId: DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_BTN,
	modalFeatureId: FEATURE_IDS.MULTI_PAGE_SUMMARIZER_MODAL,
	modalContainerId: DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_MODAL,
	ModalComponent: MultiPageSummaryModal,
	button: {
		icon: 'fa-book',
		text: 'Resumen+',
		tooltip: 'Resumir múltiples páginas con IA',
		ariaLabel: 'Resumir múltiples páginas del hilo con inteligencia artificial',
	},
	getDynamicButton: () => {
		const filter = getActiveUserFilter()
		if (!filter) return {}
		return {
			text: `Analizar+ @${filter}`,
			tooltip: `Analizar a ${filter} en múltiples páginas con IA`,
			ariaLabel: `Analizar a ${filter} en múltiples páginas del hilo con inteligencia artificial`,
		}
	},
})

export const injectMultiPageSummarizerButton = inject
export const cleanupMultiPageSummarizerButton = cleanup
