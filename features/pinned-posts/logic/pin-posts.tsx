/**
 * Pinned Posts module
 * Handles pin buttons on posts and the pinned posts sidebar
 */
import { browser } from 'wxt/browser'
import { PinnedPostsSidebar } from '@/features/pinned-posts/components/pinned-posts-sidebar'
import {
	isPostPinned,
	togglePinPost,
	extractPostData,
	getThreadId,
	extractThreadMetadata,
	saveThreadMetadata,
} from '@/features/pinned-posts/logic/storage'
import {
	isAlreadyInjected,
	markAsInjected,
	mountFeatureWithBoundary,
	isFeatureMounted,
} from '@/lib/content-modules/utils/react-helpers'
import { toast } from '@/lib/lazy-toast'
import { MV_SELECTORS, FEATURE_IDS, DOM_MARKERS, EVENTS, STORAGE_KEYS } from '@/constants'

const PIN_BUTTON_MARKER = DOM_MARKERS.POST.PIN_INJECTED
const SIDEBAR_CLASS = DOM_MARKERS.CLASSES.PINNED_SIDEBAR
const SIDEBAR_FEATURE_ID = FEATURE_IDS.SIDEBAR_PINNED

// ============================================================================
// CENTRALIZED LISTENER SYSTEM (Idempotent)
// Instead of each button having its own listeners, we use a single global
// listener that notifies all buttons. Much more efficient for pages with
// many posts.
// ============================================================================

// Registry of update callbacks keyed by postNum (for pin buttons)
const pinButtonUpdateCallbacks = new Map<number, () => void>()

// Registry of general subscribers (for sidebar and other React components)
const pinChangesSubscribers = new Set<() => void>()

// Track if global listeners are already initialized
let globalListenersInitialized = false

/**
 * Notify all subscribers of pin state changes
 */
function notifyAllSubscribers(): void {
	pinButtonUpdateCallbacks.forEach(callback => callback())
	pinChangesSubscribers.forEach(callback => callback())
}

/**
 * Initialize global listeners for pin state changes (idempotent)
 */
function initGlobalPinListeners(): void {
	if (globalListenersInitialized) return
	globalListenersInitialized = true

	// Single window listener for internal changes (same page)
	window.addEventListener(EVENTS.PIN_CHANGED, () => {
		notifyAllSubscribers()
	})

	// Single storage listener for external changes (other tabs/dashboard)
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local') return
		const currentThreadKey = `${STORAGE_KEYS.PINNED_PREFIX}${getThreadId()}`
		if (changes[currentThreadKey]) {
			notifyAllSubscribers()
		}
	})
}

/**
 * Subscribes a callback to pin state changes.
 * Returns an unsubscribe function to stop listening.
 */
export function subscribeToPinChanges(callback: () => void): () => void {
	// Ensure global listeners are initialized
	initGlobalPinListeners()

	pinChangesSubscribers.add(callback)
	return () => {
		pinChangesSubscribers.delete(callback)
	}
}

/**
 * Helper: Creates the DOM element for the pin button and initializes its internal logic.
 * Handles state updates, user interaction, and global notifications.
 * @param postEl - The post element associated with the button
 * @param postNum - The unique post number
 */
function createPinButton(postEl: HTMLElement, postNum: number): HTMLLIElement {
	const pinLi = document.createElement('li')
	const pinBtn = document.createElement('a')

	// Basic button configuration
	pinBtn.href = '#'
	pinBtn.className = `${MV_SELECTORS.THREAD.POST_BTN.replace('.', '')} pin-post`
	pinBtn.dataset.postNum = String(postNum)
	pinBtn.setAttribute('role', 'button')
	pinBtn.innerHTML = `<i class="fa fa-thumb-tack"></i>`

	// Function to update visual state (icon and tooltip)
	const updatePinState = async () => {
		const pinned = await isPostPinned(postNum)
		pinBtn.title = pinned ? 'Desanclar post' : 'Anclar post'
		pinBtn.setAttribute('aria-label', pinned ? 'Desanclar post' : 'Anclar post')
		pinBtn.setAttribute('aria-pressed', String(pinned))

		const icon = pinBtn.querySelector('i')
		if (icon) {
			icon.style.color = pinned ? 'var(--primary)' : '' // Theme primary color if pinned
		}
	}

	// Register this button's update callback in the global registry
	pinButtonUpdateCallbacks.set(postNum, updatePinState)

	// Initialize visual state upon creation
	void updatePinState()

	// CLICK Event: Handles user action
	pinBtn.addEventListener('click', async e => {
		e.preventDefault()
		e.stopPropagation()

		const postData = extractPostData(postEl)
		if (!postData) return

		// Toggle state (Pin/Unpin)
		const willPin = !(await isPostPinned(postNum))
		await togglePinPost(postData)

		// If pinning, save thread metadata to preserve the real title
		if (willPin) {
			const threadId = getThreadId()
			const meta = extractThreadMetadata()
			if (meta) {
				await saveThreadMetadata(threadId, meta)
			}
		}

		// Update this button visually
		await updatePinState()

		// Show notification
		const isPinned = await isPostPinned(postNum)
		toast.success(isPinned ? 'Post anclado' : 'Post desanclado', {
			description: isPinned ? `Post #${postNum} guardado en anclados` : `Post #${postNum} eliminado de anclados`,
			duration: 2000,
		})

		// Notify rest of the app (Sidebar and other buttons) about changes
		window.dispatchEvent(new CustomEvent(EVENTS.PIN_CHANGED))
	})

	pinLi.appendChild(pinBtn)
	return pinLi
}

/**
 * Orchestrates the injection of pin buttons into the thread's post control bars.
 */
export function injectPinButtons(): void {
	// Initialize global listeners once (idempotent)
	initGlobalPinListeners()

	const posts = document.querySelectorAll(MV_SELECTORS.THREAD.POST)

	posts.forEach(post => {
		const postEl = post as HTMLElement

		// Prevent double injection
		if (isAlreadyInjected(postEl, PIN_BUTTON_MARKER)) return
		markAsInjected(postEl, PIN_BUTTON_MARKER)

		const controls = postEl.querySelector('.post-controls .buttons')
		if (!controls) return

		const postNum = parseInt(postEl.dataset.num || '0', 10)
		if (!postNum) return

		// Delegate button creation and logic to helper function
		const pinLi = createPinButton(postEl, postNum)

		// Insert into DOM (before reply button or at the end)
		const replyBtn = controls.querySelector('li:last-child')
		if (replyBtn) {
			controls.insertBefore(pinLi, replyBtn)
		} else {
			controls.appendChild(pinLi)
		}
	})
}

/**
 * Detects changes in the thread DOM to support dynamic content like Infinite Scroll.
 * Automatically injects pin buttons into any new posts added to the page.
 */
export function initPinButtonsObserver(): void {
	// 1. Initial injection for existing posts
	injectPinButtons()

	// 2. MutationObserver configuration
	const observer = new MutationObserver(mutations => {
		let shouldInject = false

		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				// Optimization: Only re-inject if added nodes seem relevant
				shouldInject = true
				break
			}
		}

		if (shouldInject) {
			// Fast and safe to call repeatedly due to injection markers
			injectPinButtons()
		}
	})

	// 3. Start observing
	// Target the main posts container for efficiency, fallback to document.body
	const postsContainer = document.querySelector(MV_SELECTORS.GLOBAL.POSTS_ALT) || document.body

	observer.observe(postsContainer, {
		childList: true, // Observe direct children additions/removals
		subtree: true, // Observe deep nested changes
	})
}

/**
 * Injects the Pinned Posts Sidebar component into the thread companion area.
 */
export function injectPinnedPostsSidebar(): void {
	// Insert into the fixed companion section
	const fixedCompanion = document.querySelector(MV_SELECTORS.GLOBAL.THREAD_COMPANION)
	if (!fixedCompanion) return
	if (fixedCompanion.querySelector(`.${SIDEBAR_CLASS}`)) return

	// Check if already mounted
	if (isFeatureMounted(SIDEBAR_FEATURE_ID)) return

	// Create host for React component
	const host = document.createElement('div')
	host.className = SIDEBAR_CLASS
	host.style.marginTop = '10px'

	// Append to the fixed companion
	fixedCompanion.appendChild(host)

	mountFeatureWithBoundary(SIDEBAR_FEATURE_ID, host, <PinnedPostsSidebar />, 'Pinned Posts Sidebar')
}
