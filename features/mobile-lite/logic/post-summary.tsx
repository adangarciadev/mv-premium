/**
 * Mobile Lite — Post Summary Module
 *
 * Adds an AI "summarize this post" button to each post's control row (the
 * native 👍/🔖/🚩/↩ buttons), mirroring the desktop post-summary feature and
 * its rules (isPostLongEnough → witty note for short posts). Reuses the desktop
 * engine; renders the result in the shared mobile bottom sheet.
 *
 * Gated on: context.isThreadPage (via registry.ts shouldRun)
 * Feature flag: MobileLite (enforced centrally by initMobileLite)
 */

import { useEffect, useRef, useState } from 'react'
import { MV_SELECTORS } from '@/constants'
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
import {
	extractPostText,
	getShortPostMessage,
	isPostLongEnough,
	summarizePost,
} from '@/features/post-summary/logic/summarize-post'
import { formatCacheAge } from '@/features/thread-summarizer/logic/summary-cache'
import {
	postSummaryNeedsAiConfig,
	toPostSummaryBBCode,
	toPostSummaryViewModel,
	type PostSummaryViewModel,
} from './post-summary-view-model'
import {
	ensureSummarySheetChromeStyles,
	setSummarySheetOpen,
	teardownSummarySheetChrome,
} from './summary-sheet-chrome'
import { PostSummarySheet } from '../components/post-summary-sheet'
import { MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Custom event fired by a post's button to trigger the React root. */
const POST_SUMMARY_TRIGGER_EVENT = 'mvp-mobile-lite-post-summary:trigger'

const FEATURE_ID = 'mobile-lite-post-summary'
const CONTAINER_ID = 'mvp-mobile-lite-post-summary-root'
const BUTTON_CLASS = 'mvp-mobile-lite-post-summary-btn'
const INJECT_DEBOUNCE_MS = 200
/** Re-viewing the same post within this window serves the cached summary (no AI call). */
const POST_CACHE_TTL_MS = 5 * 60 * 1000

// =============================================================================
// MODULE STATE
// =============================================================================

let initialized = false
let observer: MutationObserver | null = null
let injectTimeout: ReturnType<typeof setTimeout> | null = null

// In-memory per-post cache (keyed by the post's data-num). Cleared on teardown;
// the module re-initialises per page so no pathname prefix is needed.
const postSummaryCache = new Map<string, { vm: PostSummaryViewModel; timestamp: number }>()

function getCachedPostSummary(postId: string): { vm: PostSummaryViewModel; ageMs: number } | null {
	const entry = postSummaryCache.get(postId)
	if (!entry) return null

	const ageMs = Date.now() - entry.timestamp
	if (ageMs > POST_CACHE_TTL_MS) {
		postSummaryCache.delete(postId)
		return null
	}
	return { vm: entry.vm, ageMs }
}

function setCachedPostSummary(postId: string, vm: PostSummaryViewModel): void {
	postSummaryCache.set(postId, { vm, timestamp: Date.now() })
}

// =============================================================================
// GUARD
// =============================================================================

function isMobileLitePostSummaryAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

// =============================================================================
// REACT ROOT COMPONENT
// =============================================================================

function PostSummaryReactRoot() {
	const [isLoading, setIsLoading] = useState(false)
	const [isOpen, setIsOpen] = useState(false)
	const [viewModel, setViewModel] = useState<PostSummaryViewModel | null>(null)
	const [cachedLabel, setCachedLabel] = useState<string | null>(null)
	// Ref guard: prevents concurrent AI calls.
	const busyRef = useRef(false)

	useEffect(() => {
		const handler = async (event: Event) => {
			if (busyRef.current) return

			const detail = (event as CustomEvent<{ text: string; postId: string }>).detail
			const text = detail?.text ?? ''
			const postId = detail?.postId ?? ''
			setIsOpen(true)

			// Same rule as desktop: short posts get a witty note, no AI call.
			if (!isPostLongEnough(text)) {
				setIsLoading(false)
				setCachedLabel(null)
				setViewModel({ summary: getShortPostMessage(), tone: '', hasError: false, errorMessage: '' })
				return
			}

			// Serve from cache when re-viewing the same post — avoids redundant AI calls / quota burn.
			const cached = postId ? getCachedPostSummary(postId) : null
			if (cached) {
				setIsLoading(false)
				setCachedLabel(formatCacheAge(cached.ageMs))
				setViewModel(cached.vm)
				return
			}

			busyRef.current = true
			setIsLoading(true)
			setViewModel(null)
			setCachedLabel(null)
			try {
				const result = await summarizePost(text)
				const vm = toPostSummaryViewModel(result)
				setViewModel(vm)
				// Cache only real AI summaries (a `tone` is present) — not errors/notes.
				if (postId && !vm.hasError && vm.tone) setCachedPostSummary(postId, vm)
			} catch (error) {
				logger.error('[MobileLite] PostSummary: error', error)
				setViewModel(
					toPostSummaryViewModel(null, error instanceof Error ? error.message : 'Error inesperado al generar el resumen.')
				)
			} finally {
				busyRef.current = false
				setIsLoading(false)
			}
		}

		window.addEventListener(POST_SUMMARY_TRIGGER_EVENT, handler)
		return () => window.removeEventListener(POST_SUMMARY_TRIGGER_EVENT, handler)
	}, [])

	// Hide MV's fixed bottom nav while the sheet is open so it can't cover the footer.
	useEffect(() => {
		setSummarySheetOpen(isOpen)
		return () => setSummarySheetOpen(false)
	}, [isOpen])

	const handleConfigureAi = () => {
		setIsOpen(false)
		window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT, { detail: { tab: 'settings' } }))
	}

	if (!isOpen) return null

	// Copy only real AI summaries (a `tone` is present) — not the short-post note.
	const bbcode = viewModel && !viewModel.hasError && viewModel.tone ? toPostSummaryBBCode(viewModel) : null
	const needsAiConfig = viewModel ? postSummaryNeedsAiConfig(viewModel) : false

	return (
		<PostSummarySheet
			isLoading={isLoading}
			viewModel={viewModel}
			bbcode={bbcode}
			cachedLabel={cachedLabel}
			onConfigureAi={needsAiConfig ? handleConfigureAi : undefined}
			onClose={() => setIsOpen(false)}
		/>
	)
}

// =============================================================================
// LIGHT-DOM PER-POST BUTTON
// =============================================================================

function injectPostSummaryButtons(): void {
	const posts = document.querySelectorAll<HTMLElement>(MV_SELECTORS.THREAD.POST)

	posts.forEach(post => {
		const buttons = post.querySelector('.post-controls .buttons')
		if (!buttons || buttons.querySelector(`.${BUTTON_CLASS}`)) return

		const li = document.createElement('li')
		const button = document.createElement('a')
		button.className = `post-btn ${BUTTON_CLASS}`
		button.href = '#mvp-summarize-post'
		button.setAttribute('aria-label', 'Resumir post con IA')
		// fa-android matches the desktop post-summary button (fa-robot is FA5+ only).
		button.innerHTML = '<i class="fa fa-android" aria-hidden="true"></i>'

		button.addEventListener('click', event => {
			event.preventDefault()
			event.stopPropagation()
			const body = post.querySelector(MV_SELECTORS.THREAD.POST_BODY_ALL)
			const text = body ? extractPostText(body) : ''
			const postId = post.getAttribute('data-num') ?? ''
			window.dispatchEvent(new CustomEvent(POST_SUMMARY_TRIGGER_EVENT, { detail: { text, postId } }))
		})

		li.appendChild(button)

		// Place it just before Reply when present, else at the end of the row.
		const replyLi = buttons.querySelector('.btn-reply')?.closest('li')
		if (replyLi) {
			buttons.insertBefore(li, replyLi)
		} else {
			buttons.appendChild(li)
		}
	})
}

function removePostSummaryButtons(): void {
	document.querySelectorAll(`.${BUTTON_CLASS}`).forEach(button => button.closest('li')?.remove())
}

function scheduleInject(): void {
	if (injectTimeout) clearTimeout(injectTimeout)
	injectTimeout = setTimeout(injectPostSummaryButtons, INJECT_DEBOUNCE_MS)
}

// =============================================================================
// MODULE INIT / TEARDOWN
// =============================================================================

export function initMobileLitePostSummary(): void {
	if (!isMobileLitePostSummaryAllowed()) return
	if (initialized) return

	initialized = true

	if (!isFeatureMounted(FEATURE_ID)) {
		const container = createContainer({ id: CONTAINER_ID, parent: document.body })
		mountFeatureWithBoundary(
			FEATURE_ID,
			container,
			<ShadowWrapper>
				<PostSummaryReactRoot />
			</ShadowWrapper>,
			'Mobile Lite Post Summary'
		)
	}

	ensureSummarySheetChromeStyles()
	injectPostSummaryButtons()

	// Re-inject when new posts arrive (infinite scroll / dynamic loads).
	observer = new MutationObserver(mutations => {
		if (mutations.some(mutation => mutation.addedNodes.length > 0)) scheduleInject()
	})
	observer.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLitePostSummary(): void {
	observer?.disconnect()
	observer = null
	if (injectTimeout) {
		clearTimeout(injectTimeout)
		injectTimeout = null
	}
	removePostSummaryButtons()
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
	teardownSummarySheetChrome()
	postSummaryCache.clear()
	initialized = false
}
