/**
 * Thread Post Extraction
 * Optimized for Mediavida DOM structure
 *
 * Extracts ALL posts from the current page with smart truncation
 * for very long content to stay within AI token limits.
 */

import { MV_SELECTORS } from '@/constants'
import { logger } from '@/lib/logger'

// =============================================================================
// CONSTANTS
// =============================================================================

// Gemini Flash has ~1M token context, but we want fast responses
// Aim for ~8000 tokens input max (~32KB of text)
const MAX_TOTAL_CHARS = 32000
const MAX_CHARS_PER_POST = 1500 // Allow longer individual posts
const MIN_CHARS_PER_POST = 50 // Minimum to keep a post after truncation

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedPost {
	number: number
	author: string
	content: string
	timestamp?: string
	charCount: number // Track size for smart truncation
	avatarUrl?: string // URL of the user's avatar
}

// =============================================================================
// MAIN EXTRACTION
// =============================================================================

/**
 * Scrapes and extracts all posts from the current page.
 * Applies token-aware truncation to ensure compatibility with AI context limits.
 * @returns Array of ExtractedPost objects
 */
export function extractAllPagePosts(): ExtractedPost[] {
	const posts: ExtractedPost[] = []

	const postElements = document.querySelectorAll<HTMLElement>(
		`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}`
	)

	postElements.forEach(postEl => {
		try {
			const post = extractSinglePost(postEl)
			if (post && post.content.length > 3) {
				posts.push(post)
			}
		} catch (e) {
			logger.warn('Error extracting post:', e)
		}
	})

	// Sort by post number
	posts.sort((a, b) => a.number - b.number)

	// Apply smart truncation if total content is too large
	return applySmartTruncation(posts)
}

/**
 * Extracts metadata and sanitized content from a single post DOM element.
 * @param postEl - The post element to extract
 */
function extractSinglePost(postEl: HTMLElement): ExtractedPost | null {
	// 1. Post number
	const numAttr = postEl.getAttribute('data-num') || postEl.id?.replace('post-', '')
	const number = parseInt(numAttr || '0', 10)

	// 2. Author (from post header, not from quotes)
	const authorEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AUTHOR_ALL)
	const author = authorEl?.textContent?.trim() || 'Anónimo'

	// 3. Avatar
	const avatarEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AVATAR_IMG)

	let rawAvatar = avatarEl?.getAttribute('data-src') || avatarEl?.getAttribute('src')
	let avatarUrl: string | undefined

	if (rawAvatar) {
		if (rawAvatar.startsWith('//')) rawAvatar = 'https:' + rawAvatar
		else if (rawAvatar.startsWith('/')) rawAvatar = 'https://www.mediavida.com' + rawAvatar
		else if (!rawAvatar.startsWith('http')) rawAvatar = 'https://www.mediavida.com/img/users/avatar/' + rawAvatar

		avatarUrl = rawAvatar
	}

	// 4. Content (cleaned)
	const contentEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_BODY_ALL)
	if (!contentEl) return null

	const content = cleanPostContent(contentEl)
	if (!content) return null

	// 5. Timestamp
	const timeEl = postEl.querySelector(`${MV_SELECTORS.THREAD.POST_TIME}, ${MV_SELECTORS.THREAD.POST_TIME_ALT}`)
	const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim()

	return {
		number,
		author,
		content,
		timestamp,
		charCount: content.length,
		avatarUrl,
	}
}

/**
 * Sanitizes post content by removing quotes, spoilers, media embeds, and technical artifacts.
 * Normalizes white space for better AI processing.
 */
function cleanPostContent(contentEl: Element): string {
	const clone = contentEl.cloneNode(true) as HTMLElement

	// Remove nested quotes and other noise
	const selectorsToRemove = [
		'blockquote',
		'.cita',
		'.ref', // Quotes
		'.spoiler',
		'.sp', // Spoilers
		'.edit',
		'.edited', // "Edited by..."
		'script',
		'style', // Technical junk
		'[data-s9e-mediaembed]', // Media embeds
		'.media-container',
		'.iframe-container',
		'.video-container',
		'img', // Images (avoid alt text)
		'.post-signature',
		'.signature', // Signatures
	]

	clone.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => el.remove())

	// Normalize whitespace
	return (clone.textContent || '').replace(/\s+/g, ' ').trim()
}

// =============================================================================
// SMART TRUNCATION
// =============================================================================

/**
 * Truncates posts to fit within a total character budget.
 * Strategy: Cap long posts first, then reduce proportionally if needed.
 */
function applySmartTruncation(posts: ExtractedPost[]): ExtractedPost[] {
	// Phase 1: Cap individual posts at MAX_CHARS_PER_POST
	let processedPosts = posts.map(post => {
		if (post.content.length > MAX_CHARS_PER_POST) {
			return {
				...post,
				content: post.content.substring(0, MAX_CHARS_PER_POST) + '...',
				charCount: MAX_CHARS_PER_POST + 3,
			}
		}
		return post
	})

	// Calculate total size
	let totalChars = processedPosts.reduce((sum, p) => sum + p.charCount, 0)

	// Phase 2: If still over budget, reduce proportionally
	if (totalChars > MAX_TOTAL_CHARS) {
		const ratio = MAX_TOTAL_CHARS / totalChars

		processedPosts = processedPosts.map(post => {
			const targetLength = Math.max(MIN_CHARS_PER_POST, Math.floor(post.charCount * ratio))

			if (post.content.length > targetLength) {
				return {
					...post,
					content: post.content.substring(0, targetLength) + '...',
					charCount: targetLength + 3,
				}
			}
			return post
		})
	}

	// Filter out posts that became too short to be useful
	return processedPosts.filter(p => p.content.length > MIN_CHARS_PER_POST)
}

// =============================================================================
// LEGACY EXPORT (for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use extractAllPagePosts() instead
 */
export function extractThreadPosts(maxPosts: number = 50): ExtractedPost[] {
	const allPosts = extractAllPagePosts()
	return allPosts.slice(0, maxPosts)
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get thread title from the page
 */
export function getThreadTitle(): string {
	const h1 = document.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
	return h1?.textContent?.trim() || document.title.replace(' - Mediavida', '').trim()
}

/**
 * Get current page number from URL or pagination
 */
export function getCurrentPageNumber(): number {
	// Try URL parameter first: /foro/xxx/thread-123/2
	const urlMatch = window.location.pathname.match(/\/(\d+)$/)
	if (urlMatch) {
		return parseInt(urlMatch[1], 10)
	}

	// Try pagination element
	const activePage = document.querySelector('.paginacion .activo, .pagination .active')
	if (activePage?.textContent) {
		const pageNum = parseInt(activePage.textContent.trim(), 10)
		if (!isNaN(pageNum)) return pageNum
	}

	// Default to page 1
	return 1
}

/**
 * Get unique authors count
 */
export function getUniqueAuthors(posts: ExtractedPost[]): number {
	const authors = new Set(posts.map(p => p.author.toLowerCase()))
	return authors.size
}

/**
 * Format posts for the AI prompt
 * Simple format without markdown
 */
export function formatPostsForPrompt(posts: ExtractedPost[]): string {
	return posts
		.map(p => {
			const authorLabel = p.number === 1 ? `${p.author} (OP)` : p.author
			return `#${p.number} ${authorLabel}: ${p.content}`
		})
		.join('\n\n')
}
