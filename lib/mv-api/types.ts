/**
 * Mediavida API Types
 *
 * Shared interfaces for all API operations.
 */

// ============================================================================
// RESULT TYPES (Discriminated Unions)
// ============================================================================

/** Successful mutation result */
export interface MutationSuccess<T> {
	status: 'success'
	data: T
}

/** Failed mutation result (recoverable) */
export interface MutationError {
	status: 'error'
	message: string
}

/** Token expired - requires refresh and retry */
export interface MutationTokenExpired {
	status: 'token_expired'
}

/** Discriminated union for mutation results */
export type MutationResult<T> = MutationSuccess<T> | MutationError | MutationTokenExpired

/** Batch operation result */
export interface BatchResult<T, R = string> {
	/** Successfully processed results (e.g., IDs) */
	success: R[]
	/** Original items that failed (for potential retry) */
	failed: T[]
}

// ============================================================================
// ITEM TYPES
// ============================================================================

/** A bookmark item with its thread and post identifiers */
export interface BookmarkItem {
	threadId: string
	postId: string
}

/** A favorite item (just thread ID) */
export interface FavoriteItem {
	threadId: string
}

// ============================================================================
// OPERATION PARAMS
// ============================================================================

export interface ToggleBookmarkParams extends BookmarkItem {
	action: 'add' | 'delete'
	token: string
}

export interface ToggleFavoriteParams {
	threadId: string
	action: 'add' | 'delete'
	token: string
}

// ============================================================================
// BATCH OPTIONS
// ============================================================================

export interface BatchOptions {
	/** Items per chunk (default: 5) */
	chunkSize?: number
	/** Delay between items in chunk in ms (default: 50) */
	itemDelay?: number
	/** Delay between chunks in ms (default: 100) */
	chunkDelay?: number
	/** Max retries per chunk (default: 2) */
	maxRetries?: number
	/** Progress callback */
	onProgress?: (completed: number, total: number) => void
}
