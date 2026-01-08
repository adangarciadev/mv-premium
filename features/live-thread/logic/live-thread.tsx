/**
 * Live Thread Mode - Smart Polling with Enhanced UX
 *
 * Main orchestration file for live thread functionality.
 * Feature modules are separated for maintainability:
 * - live-thread-state.ts: State persistence
 * - live-thread-dom.ts: DOM manipulation
 * - live-thread-polling.ts: Fetch and polling logic
 * - live-thread-editor.ts: Form interception
 */
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { mountFeature, unmountFeature, isFeatureMounted, updateFeature } from '@/lib/content-modules/utils/react-helpers'
import { getStatusActionsRow } from '@/lib/content-modules/utils/extra-actions-row'
import { isThreadPage, getThreadIdFromUrl } from '@/lib/content-modules/utils/page-detection'
import { applyStoredTheme } from '@/lib/theme-sync'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { MV_SELECTORS, FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

// Import modularized logic
import { type LiveStatus, setCurrentThreadId, clearLiveState } from './live-thread-state'
import {
	hideNativeElements,
	showNativeElements,
	moveFormToTop,
	restoreForm,
	toggleFormVisibility,
	setReplyStateCallback,
} from './live-thread-dom'
import {
	setIsLiveActive,
	getIsLiveActive,
	setStatusCallback,
	loadInitialPosts,
	startPolling,
	stopPolling,
	resetPollingState,
} from './live-thread-polling'
import { setupFormInterceptor, cleanupFormInterceptor } from './live-thread-editor'

// Import CSS for live thread (injected globally)
import '../styles/live-thread.css'

// =============================================================================
// CONSTANTS
// =============================================================================

const BUTTON_FEATURE_ID = FEATURE_IDS.LIVE_THREAD_BUTTON
const HEADER_FEATURE_ID = FEATURE_IDS.LIVE_THREAD_HEADER

// =============================================================================
// STATE (Mutual Exclusion)
// =============================================================================

let isInfiniteScrollActive = false // Whether infinite scroll is currently active

// =============================================================================
// REACT COMPONENTS
// =============================================================================

/**
 * LiveHeader component - Displays the status indicator and action controls for Live mode.
 */
function LiveHeader({ onStop }: { onStop: () => void }) {
	const [status, setStatus] = useState<LiveStatus>('connected')
	const [isReplyOpen, setIsReplyOpen] = useState(false)

	useEffect(() => {
		setStatusCallback(setStatus)
		setReplyStateCallback(setIsReplyOpen)
		return () => {
			setStatusCallback(null)
			setReplyStateCallback(null)
		}
	}, [])

	const handleToggleReply = () => {
		const newState = !isReplyOpen
		setIsReplyOpen(newState)
		toggleFormVisibility(newState)
	}

	return (
		<div className={cn('mvp-live-header', isReplyOpen && 'rounded-b-none')}>
			{/* Left: Status indicator */}
			<div className="mvp-live-status">
				<div className={cn('mvp-live-dot', status)} />
				<span className="mvp-live-label">LIVE</span>
			</div>

			{/* Right: Actions */}
			<div className="mvp-live-actions">
				<button onClick={handleToggleReply} className={cn('mvp-live-btn', isReplyOpen ? 'btn-active' : 'btn-primary')}>
					{isReplyOpen ? 'Cerrar' : 'Responder'}
				</button>

				<button onClick={onStop} className="mvp-live-btn btn-ghost">
					⏸ Salir
				</button>
			</div>
		</div>
	)
}

interface LiveButtonProps {
	isActive: boolean
	isDisabled: boolean
	onToggle: () => void
}

function LiveButton({ isActive, isDisabled, onToggle }: LiveButtonProps) {
	const disabledStyles = 'opacity-40 cursor-not-allowed pointer-events-none'

	return (
		<button
			onClick={isDisabled ? undefined : onToggle}
			disabled={isDisabled}
			className={cn(
				'mvp-live-toggle-btn',
				'flex items-center justify-center gap-2 px-3 h-[30px] relative shadow-sm transition-all border',
				isDisabled ? disabledStyles : 'cursor-pointer'
			)}
			title={isDisabled ? 'Desactivado (Scroll Infinito activo)' : isActive ? 'Desactivar modo Live' : 'Activar modo Live'}
			aria-label={isActive ? 'Desactivar modo Live' : 'Activar modo Live'}
		>
			<div className="mvp-live-dot connected" />
			<span className="mvp-live-label">LIVE</span>
		</button>
	)
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Switches the current thread view to Live mode.
 * Replaces the native post container with a smart-polling view and enables real-time updates.
 */
async function startLiveMode(): Promise<void> {
	if (getIsLiveActive()) return

	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	// Step 1: Start transition - fade out current posts
	postsWrap.classList.add(DOM_MARKERS.LIVE_THREAD.TRANSITIONING)

	// Wait for fade-out animation
	await new Promise(resolve => setTimeout(resolve, 250))

	hideNativeElements()

	// Create main container
	let mainContainer = document.getElementById(DOM_MARKERS.IDS.LIVE_MAIN_CONTAINER)
	if (!mainContainer) {
		mainContainer = document.createElement('div')
		mainContainer.id = DOM_MARKERS.IDS.LIVE_MAIN_CONTAINER
		mainContainer.style.cssText = `
			width: 100%;
			position: relative;
			display: flex;
			flex-direction: column;
			margin-bottom: 0;
			background: transparent;
			min-height: auto;
		`
		postsWrap.parentNode?.insertBefore(mainContainer, postsWrap)
	}

	// Create React UI container (header)
	let appContainer = document.getElementById(DOM_MARKERS.IDS.LIVE_HEADER_UI)
	if (!appContainer) {
		appContainer = document.createElement('div')
		appContainer.id = DOM_MARKERS.IDS.LIVE_HEADER_UI
		applyStoredTheme(appContainer)
		mainContainer.appendChild(appContainer)
	}

	// Create editor wrapper
	let editorWrapper = document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)
	if (!editorWrapper) {
		editorWrapper = document.createElement('div')
		editorWrapper.id = DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER
		mainContainer.appendChild(editorWrapper)
	}
	if (!editorWrapper.firstElementChild) {
		editorWrapper.innerHTML = '<div style="min-height: 0;"></div>'
	}

	// Mount React header
	mountFeature(HEADER_FEATURE_ID, appContainer, <LiveHeader onStop={stopLiveMode} />)

	setIsLiveActive(true)

	// Dispatch event to notify other features (Infinite Scroll)
	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.LIVE_MODE_CHANGED, {
			detail: { active: true },
		})
	)

	moveFormToTop()
	toggleFormVisibility(false)
	setupFormInterceptor()

	// Step 2: Load posts (this clears postsWrap.innerHTML)
	await loadInitialPosts()

	// Step 3: Remove transitioning class and add ready class for fade-in
	postsWrap.classList.remove(DOM_MARKERS.LIVE_THREAD.TRANSITIONING)
	postsWrap.classList.add(DOM_MARKERS.LIVE_THREAD.READY)

	startPolling()

	window.history.pushState({ live: true }, '', window.location.href)
}

/**
 * Disables Live mode and restores the native thread pagination and view.
 */
async function stopLiveMode(): Promise<void> {
	if (!getIsLiveActive()) return

	setIsLiveActive(false)

	// Dispatch event to notify other features (Infinite Scroll)
	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.LIVE_MODE_CHANGED, {
			detail: { active: false },
		})
	)

	stopPolling()
	cleanupFormInterceptor()
	restoreForm()

	await clearLiveState()

	unmountFeature(HEADER_FEATURE_ID)
	document.getElementById(DOM_MARKERS.IDS.LIVE_HEADER_UI)?.remove()
	document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)?.remove()
	document.getElementById(DOM_MARKERS.IDS.LIVE_MAIN_CONTAINER)?.remove()

	showNativeElements()
	resetPollingState()
	window.location.reload()
}

// =============================================================================
// BUTTON HELPERS
// =============================================================================

function getButtonElement() {
	return <LiveButton isActive={false} isDisabled={isInfiniteScrollActive} onToggle={startLiveMode} />
}

function updateButton(): void {
	if (!isFeatureMounted(BUTTON_FEATURE_ID)) return
	updateFeature(BUTTON_FEATURE_ID, getButtonElement())
}

// =============================================================================
// INJECTION
// =============================================================================

/**
 * Injects the "LIVE" toggle button into the thread action bar if the feature is enabled.
 */
export async function injectLiveThreadButton(): Promise<void> {
	if (!isThreadPage()) return
	if (isFeatureMounted(BUTTON_FEATURE_ID)) return

	// Check if feature is enabled in settings
	const { getSettings } = await import('@/store/settings-store')
	const settings = await getSettings()
	if (settings.liveThreadEnabled !== true) return

	const threadId = getThreadIdFromUrl() || ''
	if (!threadId) return
	setCurrentThreadId(threadId)

	// Use unified extra actions row (status section)
	const statusRow = getStatusActionsRow()
	if (!statusRow) return

	const CONTAINER_ID = DOM_MARKERS.IDS.LIVE_BUTTON_CONTAINER
	let container = document.getElementById(CONTAINER_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = CONTAINER_ID
		container.style.display = 'inline-flex'
		statusRow.appendChild(container)
	}

	// Setup mutual exclusion listeners
	setupModeExclusionListeners()

	// Mount button
	mountFeature(BUTTON_FEATURE_ID, container, getButtonElement())
}

export function cleanupLiveThreadButton(): void {
	unmountFeature(BUTTON_FEATURE_ID)
	document.getElementById(DOM_MARKERS.IDS.LIVE_BUTTON_CONTAINER)?.remove()
}

// =============================================================================
// MODE EXCLUSION (Mutual exclusion with Infinite Scroll)
// =============================================================================

/**
 * Listen for Infinite Scroll mode changes to disable/enable the Live button
 */
function setupModeExclusionListeners(): void {
	window.addEventListener(DOM_MARKERS.EVENTS.INFINITE_SCROLL_MODE_CHANGED, ((event: CustomEvent<{ active: boolean }>) => {
		isInfiniteScrollActive = event.detail.active
		updateButton()
	}) as EventListener)
}
