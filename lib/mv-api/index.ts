/**
 * Mediavida API Library
 *
 * Unified module for all Mediavida backend interactions:
 * - Token management (getToken, refreshToken)
 * - Atomic operations (toggleBookmark, toggleFavorite)
 * - Batch processing (batchMutate)
 * - DOM scraping (getPostsElements, getThreadInfo, etc.)
 *
 * @example
 * ```ts
 * import { batchMutate, toggleBookmark, getPostsElements, getToken } from '@/lib/mv-api'
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================
export type {
	MutationResult,
	MutationSuccess,
	MutationError,
	MutationTokenExpired,
	BatchResult,
	BookmarkItem,
	FavoriteItem,
	ToggleBookmarkParams,
	ToggleFavoriteParams,
	BatchOptions,
} from './types'

// =============================================================================
// TOKEN MANAGEMENT & ATOMIC OPERATIONS
// =============================================================================
export { getToken, refreshToken, toggleBookmark, toggleFavorite } from './mediavida'

// =============================================================================
// BATCH PROCESSING
// =============================================================================
export { batchMutate } from './batch-processor'

// =============================================================================
// DOM SCRAPING
// =============================================================================
export {
	// Types
	type PostElement,
	type ReplyElement,
	type ThreadInfo,
	type FavoritesElements,
	type FavoriteRow,
	type BookmarkElement,
	// Post scraping
	getPostsElements,
	getReplyElements,
	getPostById,
	getPostsByAuthor,
	// Thread info
	getThreadInfo,
	// Favorites
	getFavoritesElements,
	// Global elements
	getCSRFToken,
	getPostsContainer,
	getThreadCompanion,
	getSideNav,
	// User elements
	getUserLinks,
	// Editor elements
	getEditorTextarea,
	getEditorToolbar,
	getPreviewContainer,
	// Utilities
	toggleStyle,
	isElementVisible,
} from './scraper'
