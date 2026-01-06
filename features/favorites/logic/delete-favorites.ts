/**
 * Batch Favorites Deletion Service
 *
 * Simplified implementation using the centralized @/lib/api module.
 */

import { batchMutate, toggleFavorite } from '@/lib/mv-api'
import type { BatchResult } from '@/lib/mv-api'

// Re-export BatchResult for consumers
export type { BatchResult }

/**
 * Batch delete favorites using the universal batch processor.
 *
 * @param threadIds - Array of thread IDs to remove from favorites
 * @param onProgress - Optional callback for progress updates
 * @returns BatchResult with success and failed thread IDs
 */
export async function batchDeleteFavorites(
	threadIds: string[],
	onProgress?: (completed: number, total: number) => void
): Promise<BatchResult<string, string>> {
	return batchMutate(
		threadIds,
		(threadId, token) =>
			toggleFavorite({
				threadId,
				action: 'delete',
				token,
			}),
		{ onProgress }
	)
}
