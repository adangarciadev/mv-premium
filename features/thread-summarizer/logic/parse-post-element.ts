/**
 * Shared Post Element Parser
 *
 * Single source of truth for extracting post data (author, avatar, content,
 * timestamp, votes) from a Mediavida post DOM element.
 *
 * Used by both:
 * - extract-posts.ts (live DOM — current page)
 * - fetch-pages.ts   (parsed Documents — fetched pages)
 */

import { MV_SELECTORS } from '@/constants'
import { cleanPostContent, type CleanPostContentOptions } from './clean-post-content'

export interface ParsedPost {
	number: number
	author: string
	content: string
	timestamp?: string
	charCount: number
	avatarUrl?: string
	votes?: number
}

export interface ParsePostOptions {
	/** Use user-analysis cleaning (keeps blockquotes, converts quote links). */
	userAnalysisMode?: boolean
}

/**
 * Extracts metadata and sanitized content from a single post DOM element.
 *
 * Returns null if the post lacks an author or meaningful content.
 */
export function parsePostElement(postEl: HTMLElement, options: ParsePostOptions = {}): ParsedPost | null {
	const { userAnalysisMode = false } = options

	// 1. Post number
	const numAttr = postEl.getAttribute('data-num') || postEl.id?.replace('post-', '')
	const number = parseInt(numAttr || '0', 10)

	// 2. Author
	const author = extractAuthorName(postEl)
	if (!author) return null

	// 3. Avatar
	const avatarUrl = extractAvatarUrl(postEl)

	// 4. Content (cleaned)
	const contentEl =
		postEl.querySelector(MV_SELECTORS.THREAD.POST_CONTENTS) ||
		postEl.querySelector(MV_SELECTORS.THREAD.POST_BODY_ALL)
	if (!contentEl) return null

	const cleanOptions: CleanPostContentOptions = userAnalysisMode
		? { userAnalysisMode: true }
		: { keepSpoilers: true }

	const content = cleanPostContent(contentEl, cleanOptions)
	if (!content) return null

	// 5. Timestamp
	const timeEl = postEl.querySelector(
		`${MV_SELECTORS.THREAD.POST_TIME}, ${MV_SELECTORS.THREAD.POST_TIME_ALT}`
	)
	const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim()

	// 6. Votes (manitas / thumbs up)
	const votesEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_LIKE_COUNT)
	const votes = votesEl?.textContent?.trim() ? parseInt(votesEl.textContent.trim(), 10) : 0

	return {
		number,
		author,
		content,
		timestamp,
		charCount: content.length,
		avatarUrl,
		votes: votes || undefined,
	}
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function extractAuthorName(postEl: HTMLElement): string {
	const dataAuthor = postEl.getAttribute('data-autor')?.replace(/\s+/g, ' ').trim()
	if (dataAuthor) return dataAuthor

	// Prefer direct author link text to avoid picking aliases/titles near the nick.
	const authorLink =
		postEl.querySelector<HTMLAnchorElement>(MV_SELECTORS.THREAD.POST_AUTHOR_LINK) ||
		postEl.querySelector<HTMLAnchorElement>('.post-header .autor a, .post-meta .autor a')

	if (authorLink?.textContent) {
		const text = authorLink.textContent.replace(/\s+/g, ' ').trim()
		if (text) return text
	}

	const authorEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AUTHOR_ALL)
	const fallback = authorEl?.textContent?.replace(/\s+/g, ' ').trim()
	return fallback || ''
}

function extractAvatarUrl(postEl: HTMLElement): string | undefined {
	const avatarEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AVATAR_IMG)
	let rawAvatar = avatarEl?.getAttribute('data-src') || avatarEl?.getAttribute('src')
	if (!rawAvatar) return undefined

	if (rawAvatar.startsWith('//')) rawAvatar = 'https:' + rawAvatar
	else if (rawAvatar.startsWith('/')) rawAvatar = 'https://www.mediavida.com' + rawAvatar
	else if (!rawAvatar.startsWith('http')) rawAvatar = 'https://www.mediavida.com/img/users/avatar/' + rawAvatar

	return rawAvatar
}
