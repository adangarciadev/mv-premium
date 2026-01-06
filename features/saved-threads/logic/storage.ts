/**
 * Saved Threads Storage
 * Stores threads that users want to save for quick access
 *
 * Uses @wxt-dev/storage (unified API)
 */
import { storage } from '#imports'
import { getThreadId, getCurrentPage, getSubforumInfo, extractThreadTitle, isThreadUrl } from '@/lib/url-helpers'

// Re-export URL helpers for backwards compatibility
export { getThreadId, getCurrentPage, getSubforumInfo } from '@/lib/url-helpers'

// ============================================================================
// CONSTANTS
// ============================================================================

import { STORAGE_KEYS } from '@/constants'

const SAVED_THREADS_KEY = `local:${STORAGE_KEYS.SAVED_THREADS}` as `local:${string}`

// ============================================================================
// TYPES
// ============================================================================

export interface SavedThread {
	id: string // Thread path without page (e.g., "/foro/cine/titulo-123456")
	title: string // Thread title (clean, just the title)
	subforum: string // Subforum name (e.g., "cine", "off-topic")
	subforumId: string // Subforum path (e.g., "/foro/cine")
	savedAt: number // Timestamp when saved
	notes?: string // User notes about the thread (max 160 chars)
}

// ============================================================================
// THREAD INFO EXTRACTION
// ============================================================================

/**
 * Extracts thread information (ID, title, subforum) from the current page.
 * @returns A SavedThread object or null if not on a valid thread page.
 */
export function extractThreadInfo(): SavedThread | null {
	const threadId = getThreadId()

	// Must be on a thread page
	if (!isThreadUrl(threadId)) {
		return null
	}

	// Get clean title
	const title = extractThreadTitle()

	// Get subforum info
	const subforumInfo = getSubforumInfo(threadId)

	return {
		id: threadId,
		title,
		subforum: subforumInfo.name,
		subforumId: subforumInfo.path,
		savedAt: Date.now(),
	}
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Retrieves all saved threads from local storage.
 */
export async function getSavedThreads(): Promise<SavedThread[]> {
	const value = await storage.getItem<SavedThread[]>(SAVED_THREADS_KEY)
	return value || []
}

/**
 * Checks if a specific thread is currently saved.
 * @param threadId - The thread ID to check (defaults to current thread)
 */
export async function isThreadSaved(threadId?: string): Promise<boolean> {
	const id = threadId || getThreadId()
	const threads = await getSavedThreads()
	return threads.some(t => t.id === id)
}

/**
 * Persists a thread and its metadata to the saved threads collection.
 * Automatically handles updates to timestamps for existing entries.
 */
export async function saveThread(thread?: SavedThread): Promise<void> {
	const threadData = thread || extractThreadInfo()
	if (!threadData) return

	const threads = await getSavedThreads()

	// Check if already saved - don't add duplicates
	const existingIndex = threads.findIndex(t => t.id === threadData.id)
	if (existingIndex >= 0) {
		// Already saved, just refresh timestamp
		threads[existingIndex].savedAt = Date.now()
	} else {
		// Add new
		threads.push(threadData)
	}

	// Sort by most recently saved
	threads.sort((a, b) => b.savedAt - a.savedAt)

	await storage.setItem(SAVED_THREADS_KEY, threads)
}

/**
 * Removes multiple threads from the saved threads collection.
 */
export async function unsaveThreads(threadIds: string[]): Promise<void> {
	if (threadIds.length === 0) return
	const threads = await getSavedThreads()
	const idSet = new Set(threadIds)
	const filtered = threads.filter(t => !idSet.has(t.id))
	await storage.setItem(SAVED_THREADS_KEY, filtered)
}

/**
 * Remove a saved thread
 */
export async function unsaveThread(threadId?: string): Promise<void> {
	const id = threadId || getThreadId()
	await unsaveThreads([id])
}

/**
 * Toggle save state for current thread
 */
export async function toggleSaveThread(): Promise<boolean> {
	const threadId = getThreadId()
	const isSaved = await isThreadSaved(threadId)

	if (isSaved) {
		await unsaveThread(threadId)
		return false
	} else {
		const threadInfo = extractThreadInfo()
		if (!threadInfo) {
			return false
		}
		await saveThread(threadInfo)
		return true
	}
}

/**
 * Update notes for a saved thread
 */
export async function updateThreadNotes(threadId: string, notes: string): Promise<void> {
	const threads = await getSavedThreads()
	const index = threads.findIndex(t => t.id === threadId)

	if (index >= 0) {
		// Limit notes to 160 characters
		threads[index].notes = notes.slice(0, 160).trim() || undefined
		await storage.setItem(SAVED_THREADS_KEY, threads)
	}
}

/**
 * Clear all saved threads
 */
export async function clearAllSavedThreads(): Promise<void> {
	await storage.removeItem(SAVED_THREADS_KEY)
}

/**
 * Import threads from an array
 */
export async function importSavedThreads(newThreads: SavedThread[]): Promise<{ added: number; updated: number }> {
	const currentThreads = await getSavedThreads()
	const threadMap = new Map<string, SavedThread>()

	// Add current threads to map
	currentThreads.forEach(t => threadMap.set(t.id, t))

	let added = 0
	let updated = 0

	// Merge new threads
	newThreads.forEach(t => {
		if (threadMap.has(t.id)) {
			// Update existing (keep most recent)
			const existing = threadMap.get(t.id)!
			if (t.savedAt > existing.savedAt) {
				threadMap.set(t.id, t)
				updated++
			}
		} else {
			// Add new
			threadMap.set(t.id, t)
			added++
		}
	})

	const merged = Array.from(threadMap.values())
	merged.sort((a, b) => b.savedAt - a.savedAt)

	await storage.setItem(SAVED_THREADS_KEY, merged)
	return { added, updated }
}

/**
 * Subscribes to changes in the saved threads collection.
 */
export function watchSavedThreads(callback: (threads: SavedThread[]) => void): () => void {
	return storage.watch<SavedThread[]>(SAVED_THREADS_KEY, newValue => {
		callback(newValue || [])
	})
}
