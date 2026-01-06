/**
 * Universal Batch Processor
 *
 * A generic, robust batch processor for any mutation operation.
 * Handles chunking, jitter, and auto-retry with token refresh.
 */

import { getToken, refreshToken } from './mediavida'
import { logger } from '@/lib/logger'
import type { MutationResult, BatchResult, BatchOptions } from './types'

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<BatchOptions, 'onProgress'>> = {
	chunkSize: 5,
	itemDelay: 50,
	chunkDelay: 100,
	maxRetries: 2,
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Split an array into chunks of specified size.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size))
	}
	return chunks
}

/**
 * Delay execution for specified milliseconds.
 */
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// MAIN BATCH PROCESSOR
// ============================================================================

/**
 * Process a batch of items with automatic chunking, jitter, and token refresh.
 *
 * @param items - Array of items to process
 * @param mutator - Function that processes a single item (receives item + fresh token)
 * @param options - Batch processing options
 * @returns BatchResult with success and failed items
 *
 * @example
 * ```ts
 * const result = await batchMutate(
 *   bookmarks,
 *   (item, token) => toggleBookmark({ ...item, action: 'delete', token }),
 *   { onProgress: (done, total) => console.log(`${done}/${total}`) }
 * )
 * ```
 */
export async function batchMutate<T, R = string>(
	items: T[],
	mutator: (item: T, token: string) => Promise<MutationResult<R>>,
	options?: BatchOptions
): Promise<BatchResult<T, R>> {
	const opts = { ...DEFAULT_OPTIONS, ...options }
	const result: BatchResult<T, R> = { success: [], failed: [] }

	if (items.length === 0) {
		return result
	}

	// Get initial token
	let token = getToken()
	if (!token) {
		try {
			token = await refreshToken()
		} catch {
			logger.error('Failed to get initial token')
			// Mark all as failed - can't proceed without token
			result.failed = [...items]
			return result
		}
	}

	const chunks = chunkArray(items, opts.chunkSize)
	let completedCount = 0

	// Process chunks sequentially
	for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
		const chunk = chunks[chunkIndex]
		let retryCount = 0
		let pendingItems = [...chunk]

		// Retry loop for this chunk
		while (pendingItems.length > 0 && retryCount < opts.maxRetries) {
			const chunkResults = await processChunk(pendingItems, token!, mutator, opts.itemDelay)

			// Record successful items
			for (const successItem of chunkResults.successful) {
				result.success.push(successItem)
				completedCount++
			}

			// Immediately record definitive failures (non-recoverable errors like 404, 500)
			for (const item of chunkResults.definitiveFailures) {
				result.failed.push(item)
				completedCount++
			}

			// Handle token expiration - refresh and retry recoverable items
			if (chunkResults.recoverableFailures.length > 0 && retryCount < opts.maxRetries - 1) {
				try {
					token = await refreshToken()
					pendingItems = chunkResults.recoverableFailures
					retryCount++
					continue
				} catch (refreshError) {
					logger.error('Failed to refresh token:', refreshError)
					// Token refresh failed - mark recoverable items as definitely failed
					for (const item of chunkResults.recoverableFailures) {
						result.failed.push(item)
						completedCount++
					}
				}
			} else if (chunkResults.recoverableFailures.length > 0) {
				// Max retries exceeded - mark recoverable items as failed
				for (const item of chunkResults.recoverableFailures) {
					result.failed.push(item)
					completedCount++
				}
			}

			// Exit while loop - we've processed everything
			pendingItems = []
			retryCount++
		}

		// Report progress
		opts.onProgress?.(completedCount, items.length)

		// Add delay between chunks (except after last chunk)
		if (chunkIndex < chunks.length - 1) {
			await delay(opts.chunkDelay)
		}
	}

	return result
}

// ============================================================================
// CHUNK PROCESSOR
// ============================================================================

interface ChunkResult<T, R> {
	successful: R[]
	/** Items that failed due to token expiration (recoverable) */
	recoverableFailures: T[]
	/** Items that failed due to other errors like 404, 500 (not recoverable) */
	definitiveFailures: T[]
}

/**
 * Process a single chunk of items in parallel with staggered timing.
 */
async function processChunk<T, R>(
	chunk: T[],
	token: string,
	mutator: (item: T, token: string) => Promise<MutationResult<R>>,
	itemDelay: number
): Promise<ChunkResult<T, R>> {
	const successful: R[] = []
	const recoverableFailures: T[] = []
	const definitiveFailures: T[] = []

	// Execute all items in chunk with staggered timing
	const results = await Promise.all(
		chunk.map(async (item, index) => {
			// Stagger requests within chunk
			await delay(index * itemDelay)
			const result = await mutator(item, token)
			return { item, result }
		})
	)

	// Categorize results
	for (const { item, result } of results) {
		if (result.status === 'success') {
			successful.push(result.data)
		} else if (result.status === 'token_expired') {
			// Recoverable - can retry with new token
			recoverableFailures.push(item)
		} else {
			// Definitive failure (404, 500, network error, etc.)
			definitiveFailures.push(item)
		}
	}

	return { successful, recoverableFailures, definitiveFailures }
}
