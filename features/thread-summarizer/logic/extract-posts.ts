/**
 * Thread Post Extraction
 * Optimized for Mediavida DOM structure
 *
 * Extracts ALL posts from the current page with smart truncation
 * for very long content to stay within AI token limits.
 */

import { MV_SELECTORS } from '@/constants'
import { logger } from '@/lib/logger'
import { parsePostElement } from './parse-post-element'

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
	votes?: number // Thumbs up count (manitas)
}

// =============================================================================
// MAIN EXTRACTION
// =============================================================================

// =============================================================================
// USER FILTER DETECTION
// =============================================================================

/**
 * Detects the active user filter (e.g. ?u=Morkar in the URL).
 * Reads from the DOM banner first (#user-filter element), falls back to URL param.
 * Returns the filtered username, or null if no filter is active.
 */
export function getActiveUserFilter(): string | null {
	// The DOM banner <strong id="user-filter">Morkar</strong> is most reliable
	const el = document.getElementById('user-filter')
	if (el?.textContent?.trim()) return el.textContent.trim()
	// URL fallback: ?u=Morkar
	return new URLSearchParams(window.location.search).get('u')
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
			const post = parsePostElement(postEl)
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
 * Extracts posts optimized for user analysis mode.
 * Preserves blockquotes (quoted context) and converts #N quote links to
 * descriptive "[→ responde al #N]" markers so the AI understands reply patterns.
 */
export function extractUserAnalysisPosts(): ExtractedPost[] {
	const posts: ExtractedPost[] = []

	const postElements = document.querySelectorAll<HTMLElement>(
		`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}`
	)

	postElements.forEach(postEl => {
		try {
			const post = parsePostElement(postEl, { userAnalysisMode: true })
			if (post && post.content.length > 3) {
				posts.push(post)
			}
		} catch (e) {
			logger.warn('Error extracting post for user analysis:', e)
		}
	})

	posts.sort((a, b) => a.number - b.number)
	return applySmartTruncation(posts)
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
			const votesLabel = p.votes ? ` [👍${p.votes}]` : ''
			return `#${p.number} ${p.author}${votesLabel}: ${p.content}`
		})
		.join('\n\n')
}

/**
 * Format posts for user analysis prompts, adding lightweight interaction hints
 * extracted from cleaned content (reply markers + @mentions).
 */
export function formatPostsForUserAnalysisPrompt(posts: ExtractedPost[]): string {
	return posts
		.map(p => {
			const votesLabel = p.votes ? ` [👍${p.votes}]` : ''
			const hints = buildUserAnalysisHints(p.content)
			const hintsLabel = hints ? ` ${hints}` : ''
			return `#${p.number} ${p.author}${votesLabel}${hintsLabel}: ${p.content}`
		})
		.join('\n\n')
}

function buildUserAnalysisHints(content: string): string {
	const replyRefs = Array.from(new Set(Array.from(content.matchAll(/\[→ responde al #(\d+)\]/g)).map(m => `#${m[1]}`)))
	const mentions = Array.from(new Set(Array.from(content.matchAll(/(?:^|[\s([\]"'])@([A-Za-z0-9_-]{2,32})/g)).map(m => `@${m[1]}`)))

	const parts: string[] = []
	if (replyRefs.length > 0) parts.push(`{responde: ${replyRefs.join(', ')}}`)
	if (mentions.length > 0) parts.push(`{menciona: ${mentions.slice(0, 6).join(', ')}}`)

	return parts.join(' ')
}
