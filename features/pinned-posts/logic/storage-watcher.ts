/**
 * Pinned Posts Storage Watchers
 *
 * Utilities for watching pinned posts changes across all threads.
 * Pinned posts use dynamic keys (one per thread), so standard .watch() cannot be used.
 * This module encapsulates the browser.storage.onChanged listener pattern.
 */
import { browser, type Browser } from 'wxt/browser'
import { DOM_MARKERS } from '@/constants'

const PINNED_POSTS_PREFIX = DOM_MARKERS.STORAGE_KEYS.PINNED_PREFIX

/**
 * Watch for changes to any pinned posts across all threads.
 * Returns an unsubscribe function for cleanup.
 *
 * @param callback - Function called when any pinned posts key changes
 * @returns Cleanup function to remove the listener
 */
export function watchAllPinnedPosts(callback: () => void): () => void {
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName !== 'local') return

		const pinnedKeysChanged = Object.keys(changes).some(key => key.startsWith(PINNED_POSTS_PREFIX))

		if (pinnedKeysChanged) {
			callback()
		}
	}

	browser.storage.onChanged.addListener(listener)

	return () => {
		browser.storage.onChanged.removeListener(listener)
	}
}
