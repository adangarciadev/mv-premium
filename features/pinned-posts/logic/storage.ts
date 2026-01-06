/**
 * Pinned Posts Storage
 * Stores posts that users want to keep visible in the thread sidebar
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 *
 * Note: This feature uses dynamic keys (one per thread), so we use
 * storage.getItem/setItem/removeItem directly instead of defineItem.
 */
import { storage } from '#imports'
import { MV_SELECTORS } from '@/constants/mediavida-selectors'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { getThreadId, getCurrentPage, cleanThreadTitle } from '@/lib/url-helpers'

// Re-export URL helpers for backwards compatibility
export { getThreadId, getCurrentPage } from '@/lib/url-helpers'

// ============================================================================
// CONSTANTS
// ============================================================================

const PINNED_POSTS_PREFIX = 'mvp-pinned-'
const PINNED_META_PREFIX = 'mvp-pinned-meta-'

// ============================================================================
// TYPES
// ============================================================================

export interface PinnedPost {
	num: number // Post number (#1, #2, etc)
	author: string // Author username
	avatarUrl?: string // Author avatar
	preview: string // First ~100 chars of content
	timestamp: number // When it was pinned
	pageNum: number // Which page the post is on
}

export interface ThreadWithPinnedPosts {
	threadId: string // e.g., "/foro/cine/titulo-del-hilo-123456"
	threadTitle: string // Now prefer metadata, fallbacks to slug
	subforum: string // Now prefer metadata, fallbacks to slug
	posts: PinnedPost[]
}

export interface ThreadMeta {
	title: string
	subforumSlug: string
	subforumName: string
}

/**
 * Get storage key for current thread
 */
function getStorageKey(): string {
	return `${PINNED_POSTS_PREFIX}${getThreadId()}`
}

// ============================================================================
// STORAGE FUNCTIONS - Current Thread
// ============================================================================

/**
 * Retrieves all pinned posts for the current thread from local storage.
 */
export async function getPinnedPosts(): Promise<PinnedPost[]> {
	const key = `local:${getStorageKey()}` as const
	const value = await storage.getItem<PinnedPost[]>(key)
	return value || []
}

/**
 * Checks if a specific post number is currently pinned in the current thread.
 */
export async function isPostPinned(postNum: number): Promise<boolean> {
	const posts = await getPinnedPosts()
	return posts.some(p => p.num === postNum)
}

/**
 * Pin a post
 */
export async function pinPost(post: PinnedPost): Promise<void> {
	const posts = await getPinnedPosts()

	// Don't add duplicates
	if (posts.some(p => p.num === post.num)) return

	posts.push(post)

	// Sort by post number
	posts.sort((a, b) => a.num - b.num)

	await storage.setItem(`local:${getStorageKey()}`, posts)
}

/**
 * Unpin a post
 */
export async function unpinPost(postNum: number): Promise<void> {
	const posts = await getPinnedPosts()
	const filtered = posts.filter(p => p.num !== postNum)
	await storage.setItem(`local:${getStorageKey()}`, filtered)
}

/**
 * Toggles the pinned state of a post.
 * @param post - The PinnedPost object to toggle
 * @returns True if the post was pinned, false if it was unpinned
 */
export async function togglePinPost(post: PinnedPost): Promise<boolean> {
	if (await isPostPinned(post.num)) {
		await unpinPost(post.num)
		return false
	} else {
		await pinPost(post)
		return true
	}
}

/**
 * Clear all pinned posts for current thread
 */
export async function clearPinnedPosts(): Promise<void> {
	await storage.removeItem(`local:${getStorageKey()}`)
}

/**
 * Pin a post to a specific thread (used by dashboard for undo)
 * @param threadId - The thread path (e.g., "/foro/cine/thread-123")
 * @param post - The post data to restore
 */
export async function pinPostToThread(threadId: string, post: PinnedPost): Promise<void> {
	const key = `local:${PINNED_POSTS_PREFIX}${threadId}` as `local:${string}`
	const posts = (await storage.getItem<PinnedPost[]>(key)) || []

	// Don't add duplicates
	if (posts.some(p => p.num === post.num)) return

	posts.push(post)
	posts.sort((a, b) => a.num - b.num)

	await storage.setItem(key, posts)
}

// ============================================================================
// METADATA FUNCTIONS
// ============================================================================

/**
 * Get stored metadata for a thread
 */
export async function getThreadMetadata(threadId: string): Promise<ThreadMeta | null> {
	const key = `local:${PINNED_META_PREFIX}${threadId}` as const
	return await storage.getItem<ThreadMeta>(key)
}

/**
 * Save metadata for a thread
 */
export async function saveThreadMetadata(threadId: string, metadata: ThreadMeta): Promise<void> {
	const key = `local:${PINNED_META_PREFIX}${threadId}` as const
	await storage.setItem(key, metadata)
}

/**
 * Extracts thread metadata (title and subforum info) from the current document.
 */
export function extractThreadMetadata(): ThreadMeta | null {
	// Try to get title from H1
	const h1 = document.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
	let title = h1?.textContent?.trim() || ''

	if (!title) {
		title = document.title
	}

	// Clean title using centralized utility
	title = cleanThreadTitle(title)

	// Extract subforum slug and name from breadcrumb
	const breadcrumb = document.querySelector('.brc a[href^="/foro/"]') as HTMLAnchorElement
	if (!breadcrumb) return null

	const href = breadcrumb.getAttribute('href') || ''
	const pathParts = href.split('/').filter(Boolean)
	const subforumSlug = pathParts[1] || 'unknown'

	// Try to get the real name from breadcrumb, otherwise find it in constants
	let subforumName = breadcrumb.textContent?.trim() || ''
	if (!subforumName || subforumName === subforumSlug) {
		const info = ALL_SUBFORUMS.find(s => s.slug === subforumSlug)
		subforumName = info?.name || subforumSlug
	}

	if (!title || subforumSlug === 'unknown') return null

	return {
		title,
		subforumSlug,
		subforumName,
	}
}

// ============================================================================
// DOM EXTRACTION
// ============================================================================

/**
 * Clean preview text: remove spoiler content and other BBCode artifacts
 */
function cleanPreviewText(text: string): string {
	// Replace spoiler content with placeholder
	// Handles both [spoiler]content[/spoiler] and [spoiler=title]content[/spoiler]
	let cleaned = text.replace(/\[spoiler(?:=[^\]]*)?]([\s\S]*?)\[\/spoiler]/gi, ' [Spoiler] ')

	// Also handle if the DOM already expanded spoilers (text between spoiler markers)
	// The textContent includes the raw text from spoiler divs, clean any residual
	cleaned = cleaned.replace(/spoiler\s*([\s\S]*?)\s*spoiler/gi, ' [Spoiler] ')

	// Clean up multiple spaces
	cleaned = cleaned.replace(/\s+/g, ' ').trim()

	return cleaned
}

/**
 * Extracts post-specific metadata (number, author, preview, etc.) from a post DOM element.
 * Accounts for Infinite Scroll context and spoiler content cleanup.
 * @param postElement - The post element to extract data from
 */
export function extractPostData(postElement: HTMLElement): PinnedPost | null {
	const num = parseInt(postElement.dataset.num || '0', 10)
	const author = postElement.dataset.autor || 'Unknown'

	if (!num) return null

	// Get avatar URL
	const avatarImg = postElement.querySelector('.post-avatar img') as HTMLImageElement
	const avatarUrl = avatarImg?.src || avatarImg?.dataset.src

	// Get content preview - need to handle spoilers specially
	const contentEl = postElement.querySelector('.post-contents')
	let preview = ''

	if (contentEl) {
		// Clone to avoid modifying the actual DOM
		const clone = contentEl.cloneNode(true) as HTMLElement

		// Remove spoiler content elements (they have class 'sp' for the trigger and content)
		clone.querySelectorAll('.sp, .spoiler, [class*="spoiler"]').forEach(el => {
			el.textContent = ' [Spoiler] '
		})

		// Replace Embeds (Twitter/X, Instagram, etc)
		clone.querySelectorAll('[data-s9e-mediaembed]').forEach(el => {
			const type = el.getAttribute('data-s9e-mediaembed') || 'Multimedia'
			const name = type.charAt(0).toUpperCase() + type.slice(1)
			el.replaceWith(` [${name}] `)
		})

		// Replace Videos
		clone.querySelectorAll('video').forEach(el => {
			el.replaceWith(' [Video] ')
		})

		// Replace Images (excluding obvious smilies/emojis if possible)
		// Mediavida smilies usually contain 'smilies' in src or specific classes
		clone.querySelectorAll('img').forEach(el => {
			const src = el.getAttribute('src') || ''
			const isSmiley = src.includes('/smilies/') || el.classList.contains('smile') || el.classList.contains('emoji')

			if (!isSmiley) {
				el.replaceWith(' [Imagen] ')
			} else {
				// For smilies, we might want to just keep them or remove them?
				// Removing them for cleaner text preview usually makes sense
				el.remove()
			}
		})

		// Replace generic iframes (if not caught by mediaembed)
		clone.querySelectorAll('iframe').forEach(el => {
			el.replaceWith(' [Contenido incrustado] ')
		})

		preview = cleanPreviewText(clone.textContent || '')
	}

	// Limit to 100 chars
	if (preview.length > 100) {
		preview = preview.substring(0, 100) + '...'
	}

	// Determine the page number:
	// 1. Posts loaded via Infinite Scroll have 'data-mv-page' attribute with the real page
	// 2. Posts from normal page load use getCurrentPage() (from URL)
	const infiniteScrollPage = postElement.getAttribute('data-mv-page')
	const pageNum = infiniteScrollPage ? parseInt(infiniteScrollPage, 10) : getCurrentPage()

	return {
		num,
		author,
		avatarUrl,
		preview,
		timestamp: Date.now(),
		pageNum,
	}
}

// ============================================================================
// DASHBOARD FUNCTIONS - For managing ALL pinned posts across ALL threads
// ============================================================================

/**
 * Get all entries with the pinned posts prefix
 */
async function getAllPinnedEntries(): Promise<Record<string, PinnedPost[]>> {
	const snapshot = await storage.snapshot('local')
	const entries: Record<string, PinnedPost[]> = {}

	for (const [key, value] of Object.entries(snapshot)) {
		if (key.startsWith(PINNED_POSTS_PREFIX) && Array.isArray(value)) {
			entries[key] = value as PinnedPost[]
		}
	}

	return entries
}

/**
 * Retrieves all pinned posts and their corresponding thread metadata across the entire workspace.
 * Used for the global Pinned Posts dashboard.
 */
export async function getAllPinnedPosts(): Promise<ThreadWithPinnedPosts[]> {
	const entries = await getAllPinnedEntries()
	const result: ThreadWithPinnedPosts[] = []

	for (const [key, posts] of Object.entries(entries)) {
		const threadId = key.replace(PINNED_POSTS_PREFIX, '')

		// Attempt to load metadata
		const meta = await getThreadMetadata(threadId)

		let threadTitle = ''
		let subforum = ''

		if (meta) {
			threadTitle = meta.title

			// Resolve subforum slug - prioritize path extraction as it never fails
			const pathParts = threadId.split('/').filter(Boolean)
			const slugFromPath = pathParts.length >= 2 ? pathParts[1] : null

			if (slugFromPath) {
				subforum = slugFromPath
			} else if (meta.subforumSlug && meta.subforumSlug !== 'unknown') {
				subforum = meta.subforumSlug
			} else {
				// Last resort fallback
				const info = ALL_SUBFORUMS.find(s => s.name.toLowerCase() === meta.subforumName.toLowerCase())
				subforum = info?.slug || meta.subforumName.toLowerCase().replace(/\s+/g, '-')
			}
		} else {
			// Fallback to extraction from slug (LEGACY)
			const pathParts = threadId.split('/').filter(Boolean)
			subforum = pathParts.length >= 2 ? pathParts[1] : 'unknown'
			const threadSlug = pathParts.length >= 3 ? pathParts[2] : threadId
			threadTitle = threadSlug
				.replace(/-\d+$/, '')
				.split('-')
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')
		}

		if (posts.length > 0) {
			result.push({
				threadId,
				threadTitle,
				subforum,
				posts: posts.sort((a, b) => b.timestamp - a.timestamp),
			})
		}
	}

	// Sort threads by most recent pin
	return result.sort((a, b) => {
		const aLatest = Math.max(...a.posts.map(p => p.timestamp))
		const bLatest = Math.max(...b.posts.map(p => p.timestamp))
		return bLatest - aLatest
	})
}

/**
 * Unpin a specific post from a specific thread
 * @param threadId - The thread path (e.g., "/foro/cine/thread-123")
 * @param postNum - The post number to unpin
 */
export async function unpinPostFromThread(threadId: string, postNum: number): Promise<void> {
	const key = `local:${PINNED_POSTS_PREFIX}${threadId}` as `local:${string}`
	const posts = await storage.getItem<PinnedPost[]>(key)

	if (!posts) return

	const filtered = posts.filter(p => p.num !== postNum)

	if (filtered.length === 0) {
		await storage.removeItem(key)
	} else {
		await storage.setItem(key, filtered)
	}
}

/**
 * Clear all pinned posts for a specific thread
 * @param threadId - The thread path (e.g., "/foro/cine/thread-123")
 */
export async function clearPinnedPostsForThread(threadId: string): Promise<void> {
	const key = `local:${PINNED_POSTS_PREFIX}${threadId}` as `local:${string}`
	await storage.removeItem(key)
}

/**
 * Clear ALL pinned posts from ALL threads
 */
export async function clearAllPinnedPosts(): Promise<void> {
	const entries = await getAllPinnedEntries()
	for (const key of Object.keys(entries)) {
		const storageKey = `local:${key}` as `local:${string}`
		await storage.removeItem(storageKey)
	}
}

/**
 * Batch unpin multiple posts - handles posts from multiple threads
 * Processes threads SEQUENTIALLY to avoid race conditions and ensure stable storage events
 * @param posts - Array of { threadId, postNum } objects
 */
export async function batchUnpinPosts(posts: Array<{ threadId: string; postNum: number }>): Promise<void> {
	// Group posts by threadId to handle each thread atomically
	const postsByThread = new Map<string, number[]>()

	for (const { threadId, postNum } of posts) {
		const existing = postsByThread.get(threadId) || []
		existing.push(postNum)
		postsByThread.set(threadId, existing)
	}

	// Process each thread SEQUENTIALLY to avoid race conditions
	// This ensures storage events are triggered in a stable order
	for (const [threadId, postNums] of postsByThread.entries()) {
		const key = `local:${PINNED_POSTS_PREFIX}${threadId}` as `local:${string}`
		const currentPosts = await storage.getItem<PinnedPost[]>(key)

		if (!currentPosts) continue

		const filtered = currentPosts.filter(p => !postNums.includes(p.num))

		if (filtered.length === 0) {
			await storage.removeItem(key)
		} else {
			await storage.setItem(key, filtered)
		}
	}
}
