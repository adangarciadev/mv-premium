/**
 * Mediavida DOM Scraper
 *
 * Functions for extracting structured data from Mediavida's DOM.
 * Part of the unified @/lib/mv-api module.
 *
 * @usage
 * ```ts
 * import { getPostsElements, getThreadInfo } from '@/lib/mv-api'
 *
 * const posts = getPostsElements()
 * const thread = getThreadInfo()
 * ```
 */
import { MV_SELECTORS, MVDynamicSelectors } from '@/constants/mediavida-selectors'

// =============================================================================
// TYPES
// =============================================================================

export interface PostElement {
	/** Post ID (data-num attribute) */
	id: string
	/** Post author username */
	author: string
	/** Post content text */
	content: string
	/** Main post container element */
	container: HTMLElement
	/** Post body element */
	body: HTMLElement | null
	/** Post avatar element */
	avatar: HTMLElement | null
	/** Post header/meta element */
	header: HTMLElement | null
	/** Timestamp element */
	timestamp: HTMLElement | null
	/** Like button element */
	likeButton: HTMLElement | null
	/** Like count */
	likeCount: number
}

export interface ReplyElement {
	/** Reply ID (data-num attribute) */
	id: string
	/** Reply author username */
	author: string
	/** Reply container element */
	container: HTMLElement
	/** Reply body element */
	body: HTMLElement | null
	/** Reply avatar element */
	avatar: HTMLElement | null
	/** Reply meta element */
	meta: HTMLElement | null
}

export interface ThreadInfo {
	/** Thread title */
	title: string
	/** Thread ID (from URL or data attribute) */
	id: string | null
	/** Subforum name */
	subforum: string | null
	/** Subforum slug (from URL) */
	subforumSlug: string | null
	/** Current page number */
	currentPage: number
	/** Total pages (if available) */
	totalPages: number | null
}

export interface FavoritesElements {
	/** CSRF token for API calls */
	token: string
	/** Table containing favorites */
	table: HTMLTableElement | null
	/** Table body element */
	tbody: HTMLElement | null
	/** Individual thread rows */
	rows: FavoriteRow[]
}

export interface FavoriteRow {
	/** Thread ID */
	id: string
	/** Row element */
	row: HTMLTableRowElement
	/** Thread title element */
	titleElement: HTMLElement | null
	/** Thread title text */
	title: string
}

export interface BookmarkElement {
	/** Thread ID */
	threadId: string
	/** Post ID */
	postId: string
	/** Post author */
	author: string
	/** Post preview text */
	preview: string
	/** Container element */
	container: HTMLElement
	/** Link to the post */
	url: string
}

// =============================================================================
// SCRAPER FUNCTIONS - Posts & Threads
// =============================================================================

/**
 * Extract all posts from the current thread page.
 */
export function getPostsElements(): PostElement[] {
	const { THREAD } = MV_SELECTORS

	const postElements = document.querySelectorAll<HTMLElement>(THREAD.POST)

	return Array.from(postElements)
		.map(post => {
			const body = post.querySelector<HTMLElement>(THREAD.POST_BODY_ALL)
			const likeBtn = post.querySelector<HTMLElement>(THREAD.POST_LIKE_BTN)
			const likeCountEl = post.querySelector<HTMLElement>(THREAD.POST_LIKE_COUNT)

			return {
				id: post.dataset.num || post.id || '',
				author: post.dataset.autor || '',
				content: body?.textContent?.trim() || '',
				container: post,
				body,
				avatar: post.querySelector<HTMLElement>(THREAD.POST_AVATAR),
				header:
					post.querySelector<HTMLElement>(THREAD.POST_HEADER) || post.querySelector<HTMLElement>(THREAD.POST_META),
				timestamp:
					post.querySelector<HTMLElement>(THREAD.POST_TIME) || post.querySelector<HTMLElement>(THREAD.POST_TIME_ALT),
				likeButton: likeBtn,
				likeCount: likeCountEl ? parseInt(likeCountEl.textContent || '0', 10) : 0,
			}
		})
		.filter(post => post.id)
}

/**
 * Extract all reply elements from posts.
 */
export function getReplyElements(): ReplyElement[] {
	const { THREAD, USER } = MV_SELECTORS

	const replyElements = document.querySelectorAll<HTMLElement>(THREAD.POST_REPLY)

	return Array.from(replyElements).map(reply => ({
		id: reply.dataset.num || '',
		author: reply.querySelector<HTMLElement>(USER.AUTHOR_NAME)?.textContent?.trim() || '',
		container: reply,
		body: reply.querySelector<HTMLElement>(THREAD.POST_CONTENTS),
		avatar: reply.querySelector<HTMLElement>(THREAD.POST_AVATAR_REPLY),
		meta: reply.querySelector<HTMLElement>(THREAD.POST_META_REPLY),
	}))
}

/**
 * Get a specific post by its number.
 */
export function getPostById(postNum: string | number): PostElement | null {
	const selector = MVDynamicSelectors.postByNum(postNum)
	const post = document.querySelector<HTMLElement>(selector)
	if (!post) return null

	const posts = getPostsElements()
	return posts.find(p => p.id === String(postNum)) || null
}

/**
 * Extract thread information from the current page.
 */
export function getThreadInfo(): ThreadInfo {
	const { THREAD } = MV_SELECTORS

	// Extract title
	const titleEl =
		document.querySelector<HTMLElement>(THREAD.THREAD_TITLE) ||
		document.querySelector<HTMLElement>(THREAD.THREAD_TITLE_ALT) ||
		document.querySelector<HTMLElement>(THREAD.THREAD_TITLE_LEGACY)

	const title = titleEl?.textContent?.trim() || document.title

	// Extract thread ID from URL
	// URLs can be: /foro/subforum/12345 OR /foro/subforum/slug-text-12345
	// We need to capture the numeric ID at the end
	const urlMatch = window.location.pathname.match(/\/foro\/[^/]+\/(?:[^/]*-)?(\d+)/)
	const threadId = urlMatch?.[1] || null

	// Extract subforum from breadcrumb or URL
	const subforumEl =
		document.querySelector<HTMLAnchorElement>(THREAD.SUBFORUM_PATH) ||
		document.querySelector<HTMLAnchorElement>(THREAD.BRAND_SUBFORUM)

	const subforum = subforumEl?.textContent?.trim() || null
	const subforumSlug = window.location.pathname.split('/')[2] || null

	// Extract pagination info
	const currentPageEl = document.querySelector<HTMLElement>(THREAD.PAGINATION_CURRENT)
	const currentPage = currentPageEl ? parseInt(currentPageEl.textContent || '1', 10) : 1

	const paginationLinks = document.querySelectorAll<HTMLAnchorElement>(THREAD.PAGINATION_LINKS)
	let totalPages: number | null = null

	if (paginationLinks.length > 0) {
		const lastLink = paginationLinks[paginationLinks.length - 1]
		const lastPageMatch = lastLink.href.match(/\/(\d+)$/)
		if (lastPageMatch) {
			totalPages = parseInt(lastPageMatch[1], 10)
		}
	}

	return {
		title,
		id: threadId,
		subforum,
		subforumSlug,
		currentPage,
		totalPages,
	}
}

// =============================================================================
// SCRAPER FUNCTIONS - Favorites
// =============================================================================

/**
 * Extract favorites table elements from the favorites page.
 */
export function getFavoritesElements(): FavoritesElements {
	const { GLOBAL, FAVORITES } = MV_SELECTORS

	const tokenInput = document.querySelector<HTMLInputElement>(GLOBAL.TOKEN_INPUT)
	const table = document.querySelector<HTMLTableElement>(FAVORITES.TABLE)
	const tbody = table?.querySelector<HTMLElement>('tbody') ?? null

	const rows: FavoriteRow[] = []

	if (tbody) {
		const rowElements = tbody.querySelectorAll<HTMLTableRowElement>(FAVORITES.THREAD_ROW_WILDCARD)
		rowElements.forEach(row => {
			const id = row.id.slice(1) // Remove 't' prefix
			const titleElement = row.querySelector<HTMLElement>(FAVORITES.THREAD_TITLE_LINK)
			rows.push({
				id,
				row,
				titleElement,
				title: titleElement?.textContent?.trim() || '',
			})
		})
	}

	return {
		token: tokenInput?.value || '',
		table,
		tbody,
		rows,
	}
}

// =============================================================================
// SCRAPER FUNCTIONS - Global Elements
// =============================================================================

/**
 * Get the CSRF token from the page.
 */
export function getCSRFToken(): string {
	const { GLOBAL } = MV_SELECTORS
	const tokenInput = document.querySelector<HTMLInputElement>(GLOBAL.TOKEN_INPUT)
	return tokenInput?.value || ''
}

/**
 * Get the posts container element.
 */
export function getPostsContainer(): HTMLElement | null {
	const { THREAD } = MV_SELECTORS
	return document.getElementById(THREAD.POSTS_CONTAINER_ID)
}

/**
 * Get the thread companion sidebar element.
 */
export function getThreadCompanion(): HTMLElement | null {
	const { GLOBAL } = MV_SELECTORS
	return document.getElementById(GLOBAL.THREAD_COMPANION_ID)
}

/**
 * Get the side navigation panel.
 */
export function getSideNav(): HTMLElement | null {
	const { GLOBAL } = MV_SELECTORS
	return document.getElementById(GLOBAL.SIDE_NAV_ID)
}

// =============================================================================
// SCRAPER FUNCTIONS - User Elements
// =============================================================================

/**
 * Extract all author links from the page (for user customizations).
 */
export function getUserLinks(): HTMLAnchorElement[] {
	const { THREAD } = MV_SELECTORS
	return Array.from(document.querySelectorAll<HTMLAnchorElement>(THREAD.POST_AUTHOR_LINK))
}

/**
 * Find posts by a specific author.
 */
export function getPostsByAuthor(username: string): PostElement[] {
	const posts = getPostsElements()
	return posts.filter(post => post.author.toLowerCase() === username.toLowerCase())
}

// =============================================================================
// SCRAPER FUNCTIONS - Editor
// =============================================================================

/**
 * Get the editor textarea element.
 */
export function getEditorTextarea(): HTMLTextAreaElement | null {
	const { EDITOR } = MV_SELECTORS
	return (
		document.querySelector<HTMLTextAreaElement>(EDITOR.TEXTAREA) ||
		document.querySelector<HTMLTextAreaElement>(EDITOR.TEXTAREA_NAME) ||
		document.querySelector<HTMLTextAreaElement>(EDITOR.EDITOR_BODY_TEXTAREA)
	)
}

/**
 * Get the editor toolbar element.
 */
export function getEditorToolbar(): HTMLElement | null {
	const { EDITOR } = MV_SELECTORS
	return (
		document.querySelector<HTMLElement>(EDITOR.EDITOR_CONTROLS) ||
		document.querySelector<HTMLElement>(EDITOR.EDITOR_TOOLBAR) ||
		document.querySelector<HTMLElement>(EDITOR.TOOLBAR)
	)
}

/**
 * Get the preview container element.
 */
export function getPreviewContainer(): HTMLElement | null {
	const { GLOBAL } = MV_SELECTORS
	return document.getElementById(GLOBAL.PREVIEW_CONTAINER_ID)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Toggle a CSS style on an element.
 * Mimics MVTools' toggleStyle utility.
 */
export function toggleStyle(element: HTMLElement | null, condition: boolean, styles: Record<string, string>): void {
	if (!element) return

	for (const [prop, value] of Object.entries(styles)) {
		if (condition) {
			element.style.setProperty(prop, value)
		} else {
			element.style.removeProperty(prop)
		}
	}
}

/**
 * Check if an element is visible in the viewport.
 */
export function isElementVisible(element: HTMLElement): boolean {
	const rect = element.getBoundingClientRect()
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	)
}
