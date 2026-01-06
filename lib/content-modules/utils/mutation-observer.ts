/**
 * Optimized MutationObserver with debounce and filtering
 */

import { DEBOUNCE, DOM_MARKERS } from '@/constants'

export interface ObserverCallbacks {
	onMutation: () => void
}

// CSS selectors that identify elements from our extension.
// We use attributes with mvp- prefix to identify injected elements.
const IGNORE_SELECTOR = `.mvp, [${DOM_MARKERS.DATA_ATTRS.INJECTED}], [${DOM_MARKERS.DATA_ATTRS.TOOLBAR}], [${DOM_MARKERS.DATA_ATTRS.DRAFT}]`

/**
 * Check if a mutation is within our own extension elements.
 * OPTIMIZED: Uses native .closest() instead of manual tree traversal.
 */
/**
 * Create a debounced mutation observer
 * * @param callbacks - Object with callback functions
 * @param debounceMs - Debounce delay in milliseconds (default: DEBOUNCE.SCROLL)
 */
export function createDebouncedObserver(callbacks: ObserverCallbacks, debounceMs = DEBOUNCE.SCROLL): MutationObserver {
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	const observer = new MutationObserver(mutations => {
		// CRITICAL OPTIMIZATION:
		// Check if ANY mutation in the batch is relevant (not ours)
		// We use a targeted approach: only react if new elements were added that aren't ours

		const hasRelevantMutations = mutations.some(m => {
			// Only care about childList mutations (new elements added)
			if (m.type !== 'childList' || m.addedNodes.length === 0) {
				return false
			}

			// Check if any added node is NOT one of ours
			for (let i = 0; i < m.addedNodes.length; i++) {
				const node = m.addedNodes[i]

				// Text nodes: check if parent is ours
				if (node.nodeType === Node.TEXT_NODE) {
					const parent = node.parentElement
					// If parent is ours, skip this node; otherwise it's relevant
					if (parent && parent.closest(IGNORE_SELECTOR)) {
						continue // This text node is ours, skip
					}
					// Text node not in our elements - but we only care about new posts
					// Ignore text-only mutations as they don't add new posts
					continue
				}

				// Element nodes: check with closest
				if (node.nodeType === Node.ELEMENT_NODE) {
					const element = node as HTMLElement
					if (!element.closest || !element.closest(IGNORE_SELECTOR)) {
						return true // Found a relevant node
					}
				}
			}

			return false
		})

		if (!hasRelevantMutations) {
			return
		}

		// If there's a pending timeout, clear it (classic debounce)
		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		timeoutId = setTimeout(() => {
			callbacks.onMutation()
			timeoutId = null
		}, debounceMs)
	})

	return observer
}

/**
 * Start observing the document body
 * OPTIMIZED CONFIG: Exclude attributes unless strictly necessary
 */
export function observeDocument(observer: MutationObserver): void {
	observer.observe(document.body, {
		childList: true, // Detect added/removed nodes (CRITICAL for Infinite Scroll)
		subtree: true, // Observe deeply
		attributes: false, // OPTIMIZATION: We don't care if class/style/etc changes, only if new content arrives
		characterData: false, // We don't care if the text of an existing node changes
	})
}

/**
 * Stop observing and clean up
 */
export function disconnectObserver(observer: MutationObserver): void {
	observer.disconnect()
}
