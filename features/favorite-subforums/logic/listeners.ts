/**
 * Centralized Listener System for Favorite Subforums
 *
 * Instead of each component having its own listeners, we use a single global
 * listener system that notifies all registered callbacks. Much more efficient
 * when multiple components need to react to the same changes.
 */
import { browser } from 'wxt/browser'
import { DOM_MARKERS } from '@/constants'

// Storage key to watch
const STORAGE_KEY = DOM_MARKERS.STORAGE_KEYS.FAVORITE_SUBFORUMS

// Registry of update callbacks
const favoriteSubforumsCallbacks = new Set<() => void>()

// Track if global listeners are already initialized
let globalListenersInitialized = false

/**
 * Initializes global listeners for favorite subforums changes (idempotent)
 * Handles both intra-page events and cross-tab storage changes.
 */
function initGlobalFavoriteSubforumsListeners(): void {
	if (globalListenersInitialized) return
	globalListenersInitialized = true

	// Single window listener for internal changes (same page)
	window.addEventListener(DOM_MARKERS.EVENTS.FAVORITE_SUBFORUMS_CHANGED, () => {
		favoriteSubforumsCallbacks.forEach(callback => callback())
	})

	// Single storage listener for external changes (other tabs/dashboard)
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName === 'local' && changes[STORAGE_KEY]) {
			favoriteSubforumsCallbacks.forEach(callback => callback())
		}
	})
}

/**
 * Subscribes to changes in the favorite subforums, initializing global listeners on first call.
 * Handles both local page events and cross-tab storage synchronizations.
 * @param callback - Function to run when favorites are updated
 * @returns Unsubscribe function
 */
export function subscribeFavoriteSubforumsChanges(callback: () => void): () => void {
	// Initialize global listeners on first subscription
	initGlobalFavoriteSubforumsListeners()

	// Register callback
	favoriteSubforumsCallbacks.add(callback)

	// Return unsubscribe function
	return () => {
		favoriteSubforumsCallbacks.delete(callback)
	}
}

/**
 * Broadcasts a custom event to notify all internal subscribers that favorites have changed.
 * Should be called after any write operation to the favorites storage.
 */
export function notifyFavoriteSubforumsChanged(): void {
	window.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.FAVORITE_SUBFORUMS_CHANGED))
}
