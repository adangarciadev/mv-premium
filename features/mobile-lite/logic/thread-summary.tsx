/**
 * Mobile Lite — Thread Summary Module
 *
 * Spike: injects a "Resumir hilo" affordance on thread pages, calls the
 * existing desktop AI engine (summarizeCurrentThread), and renders the result
 * in a mobile bottom sheet following the DESIGN.md token system.
 *
 * Gated on: context.isThreadPage (via registry.ts shouldRun)
 * Feature flag: MobileLite (enforced centrally by initMobileLite)
 */

import { useEffect, useState } from 'react'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import {
	createContainer,
	isFeatureMounted,
	mountFeatureWithBoundary,
	unmountFeature,
} from '@/lib/content-modules/utils/react-helpers'
import { summarizeCurrentThread } from '@/features/thread-summarizer/logic/summarize'
import { getCurrentPageNumber } from '@/features/thread-summarizer/logic/extract-posts'
import {
	getCachedSingleSummary,
	setCachedSingleSummary,
} from '@/features/thread-summarizer/logic/summary-cache'
import { toThreadSummaryBBCode, toThreadSummaryViewModel, type ThreadSummaryViewModel } from './thread-summary-view-model'
import { getPremiumPillButtonCss } from './native-button-styles'
import { ThreadSummarySheet } from '../components/thread-summary-sheet'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Custom event fired by the Light-DOM button to trigger the React root. */
export const THREAD_SUMMARY_TRIGGER_EVENT = 'mvp-mobile-lite-thread-summary:trigger'

const FEATURE_ID = 'mobile-lite-thread-summary'
const CONTAINER_ID = 'mvp-mobile-lite-thread-summary-root'
const BUTTON_ID = 'mvp-mobile-lite-summarize-button'
const BUTTON_ATTR = 'data-mvp-mobile-lite-summarize-btn'
const STYLE_ID = 'mvp-mobile-lite-thread-summary-styles'

// =============================================================================
// MODULE STATE
// =============================================================================

let initialized = false

// =============================================================================
// GUARD
// =============================================================================

function isMobileLiteThreadSummaryAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

// =============================================================================
// REACT ROOT COMPONENT
// =============================================================================

/**
 * Mounted in its own ShadowWrapper so Tailwind classes work inside the sheet.
 * Listens for THREAD_SUMMARY_TRIGGER_EVENT from the Light-DOM button.
 */
function ThreadSummaryReactRoot() {
	const [isLoading, setIsLoading] = useState(false)
	const [isOpen, setIsOpen] = useState(false)
	const [viewModel, setViewModel] = useState<ThreadSummaryViewModel | null>(null)

	useEffect(() => {
		const handler = async () => {
			// Ignore if a request is already in flight — prevents duplicate AI calls.
			if (isLoading) return

			const pageNumber = getPageNumberSafe()

			// Serve from cache when available — avoids redundant AI calls / quota burn.
			const cached = getCachedSingleSummary(pageNumber)
			if (cached) {
				logger.debug('[MobileLite] ThreadSummary: serving from cache')
				setViewModel(toThreadSummaryViewModel(cached))
				setIsOpen(true)
				return
			}

			setIsLoading(true)
			setIsOpen(true)
			setViewModel(null)

			try {
				logger.debug('[MobileLite] ThreadSummary: calling summarizeCurrentThread')
				const summary = await summarizeCurrentThread()
				const vm = toThreadSummaryViewModel(summary)
				setViewModel(vm)

				// Cache successful results to avoid follow-up re-generation.
				if (!summary.error) {
					setCachedSingleSummary(pageNumber, summary)
				}
			} catch (error) {
				logger.error('[MobileLite] ThreadSummary: unexpected error', error)
				setViewModel({
					title: '',
					topic: '',
					keyPoints: [],
					participants: [],
					status: '',
					hasError: true,
					errorMessage: 'Error inesperado al generar el resumen.',
					postsAnalyzed: 0,
					pageNumber,
				})
			} finally {
				setIsLoading(false)
			}
		}

		window.addEventListener(THREAD_SUMMARY_TRIGGER_EVENT, handler)
		return () => window.removeEventListener(THREAD_SUMMARY_TRIGGER_EVENT, handler)
		// isLoading intentionally excluded: the handler reads the closure value.
		// Adding it would re-register on every state flip without benefit.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	if (!isOpen) return null

	const bbcode = viewModel && !viewModel.hasError ? toThreadSummaryBBCode(viewModel) : null

	return (
		<ThreadSummarySheet
			isLoading={isLoading}
			viewModel={viewModel}
			bbcode={bbcode}
			onClose={() => setIsOpen(false)}
		/>
	)
}

// =============================================================================
// LIGHT-DOM BUTTON (injected into MV's thread-companion area)
// =============================================================================

function injectSummarizeButton(): void {
	if (document.getElementById(BUTTON_ID)) return

	// Prefer the companion's action area; fall back to the companion element itself.
	const companion = document.querySelector<HTMLElement>('#thread-companion, .thread-companion')
	if (!companion) return

	const actionsContainer = companion.querySelector<HTMLElement>('.more-actions, .actions, #more-actions')
	const insertTarget = actionsContainer ?? companion

	const button = document.createElement('a')
	button.id = BUTTON_ID
	button.href = '#mvp-summarize'
	button.setAttribute(BUTTON_ATTR, 'true')
	button.setAttribute('aria-label', 'Resumir hilo con IA')
	button.className = 'btn'
	button.innerHTML = '<i class="fa fa-magic" aria-hidden="true"></i> <span>Resumir</span>'

	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		window.dispatchEvent(new CustomEvent(THREAD_SUMMARY_TRIGGER_EVENT))
	})

	insertTarget.appendChild(button)
}

function removeSummarizeButton(): void {
	document.getElementById(BUTTON_ID)?.remove()
	document.querySelectorAll(`[${BUTTON_ATTR}="true"]`).forEach(el => el.remove())
}

function ensureButtonStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		${getPremiumPillButtonCss(`#${BUTTON_ID}.btn`)}
		#${BUTTON_ID}.btn {
			margin-left: 4px !important;
		}
	`
	document.head.appendChild(style)
}

// =============================================================================
// UTILS
// =============================================================================

function getPageNumberSafe(): number {
	try {
		return getCurrentPageNumber()
	} catch {
		return 1
	}
}

// =============================================================================
// MODULE INIT / TEARDOWN
// =============================================================================

export function initMobileLiteThreadSummary(): void {
	if (!isMobileLiteThreadSummaryAllowed()) return
	if (initialized) return

	initialized = true

	// Mount the React root (Shadow DOM — houses the result sheet).
	if (!isFeatureMounted(FEATURE_ID)) {
		const container = createContainer({ id: CONTAINER_ID, parent: document.body })
		mountFeatureWithBoundary(
			FEATURE_ID,
			container,
			<ShadowWrapper>
				<ThreadSummaryReactRoot />
			</ShadowWrapper>,
			'Mobile Lite Thread Summary'
		)
	}

	// Inject the native Light-DOM trigger button.
	ensureButtonStyles()
	injectSummarizeButton()
}

export function teardownMobileLiteThreadSummary(): void {
	removeSummarizeButton()
	document.getElementById(STYLE_ID)?.remove()
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
	initialized = false
}
