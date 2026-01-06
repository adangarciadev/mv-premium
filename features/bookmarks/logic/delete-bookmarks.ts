/**
 * Batch Bookmark Deletion Service
 *
 * Simplified implementation using the centralized @/lib/api module.
 */

import { batchMutate, toggleBookmark } from '@/lib/mv-api'
import type { BookmarkItem, BatchResult } from '@/lib/mv-api'

// Re-export BookmarkItem for consumers
export type { BookmarkItem }

/**
 * Batch delete bookmarks using the universal batch processor.
 *
 * @param items - Array of bookmark items to delete
 * @param onProgress - Optional callback for progress updates
 * @returns BatchResult with success IDs and failed BookmarkItems
 */
export async function batchDeleteBookmarks(
	items: BookmarkItem[],
	onProgress?: (completed: number, total: number) => void
): Promise<BatchResult<BookmarkItem, string>> {
	return batchMutate(
		items,
		(item, token) =>
			toggleBookmark({
				threadId: item.threadId,
				postId: item.postId,
				action: 'delete',
				token,
			}),
		{ onProgress }
	)
}

// ============================================================================
// CONVENIENCE FUNCTIONS (kept for backward compatibility)
// ============================================================================

/**
 * Deconstructs a composite bookmark ID (threadId-postId) into its components.
 * @param compositeId - The hyphenated ID string
 */
export function parseCompositeId(compositeId: string): BookmarkItem | null {
	const parts = compositeId.split('-')
	if (parts.length < 2) return null

	return {
		threadId: parts[0],
		postId: parts.slice(1).join('-'), // Handle postId that might contain dashes
	}
}

/**
 * Converts an array of composite ID strings into BookmarkItem objects.
 */
export function idsToBookmarkItems(compositeIds: string[]): BookmarkItem[] {
	return compositeIds.map(parseCompositeId).filter((item): item is BookmarkItem => item !== null)
}
