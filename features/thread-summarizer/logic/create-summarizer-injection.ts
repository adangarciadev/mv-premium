/**
 * Summarizer Injection Factory
 *
 * Creates standardized inject/cleanup functions for summarizer buttons.
 * Both single-page and multi-page summarizers share 95%+ identical injection logic.
 */

import { isThreadPage } from '@/features/gallery/lib/thread-scraper'
import { mountFeatureWithBoundary, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import {
	createThreadActionButton,
	isThreadActionButtonInjected,
	removeThreadActionButton,
	type ThreadActionButtonResult,
} from '@/lib/content-modules/utils/thread-action-button'
import { createElement, type ComponentType } from 'react'

interface SummarizerInjectionConfig {
	buttonId: string
	modalFeatureId: string
	modalContainerId: string
	ModalComponent: ComponentType<{ isOpen: boolean; onClose: () => void }>
	button: {
		icon: string
		text: string
		tooltip: string
		ariaLabel: string
	}
}

interface SummarizerInjection {
	inject: () => void
	cleanup: () => void
}

export function createSummarizerInjection(config: SummarizerInjectionConfig): SummarizerInjection {
	const { buttonId, modalFeatureId, modalContainerId, ModalComponent, button } = config
	let buttonResult: ThreadActionButtonResult | null = null

	function ModalWrapper({ onClose }: { onClose: () => void }) {
		return createElement(ModalComponent, { isOpen: true, onClose })
	}

	function openModal(): void {
		if (isFeatureMounted(modalFeatureId)) return

		let container = document.getElementById(modalContainerId)
		if (!container) {
			container = document.createElement('div')
			container.id = modalContainerId
			document.body.appendChild(container)
		}

		mountFeatureWithBoundary(
			modalFeatureId,
			container,
			createElement(ModalWrapper, { onClose: () => closeModal() }),
			'Resumen de Hilo'
		)
	}

	function closeModal(): void {
		unmountFeature(modalFeatureId)
		const container = document.getElementById(modalContainerId)
		if (container) container.remove()
	}

	function inject(): void {
		if (isThreadActionButtonInjected(buttonId)) return
		if (!isThreadPage()) return

		buttonResult = createThreadActionButton({
			id: buttonId,
			icon: button.icon,
			text: button.text,
			tooltip: button.tooltip,
			ariaLabel: button.ariaLabel,
			onClick: () => openModal(),
		})
	}

	function cleanup(): void {
		if (buttonResult) {
			buttonResult.remove()
			buttonResult = null
		} else {
			removeThreadActionButton(buttonId)
		}
		closeModal()
	}

	return { inject, cleanup }
}
