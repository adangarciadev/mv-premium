/**
 * Multi-Page Thread Fetcher
 *
 * Fetches and parses HTML from multiple thread pages.
 * Reuses extraction logic from extract-posts.ts adapted for parsed Documents.
 */

import { MV_SELECTORS } from '@/constants'
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'
import type { ExtractedPost } from './extract-posts'
import { parsePostElement } from './parse-post-element'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Max pages for multi-page summary using Gemini */
export const MAX_MULTI_PAGES_GEMINI = 30

/** Max pages for multi-page summary using Groq (Kimi) */
export const MAX_MULTI_PAGES_GROQ = 10

/** Absolute max across providers (used as generic hard cap/fallback) */
export const MAX_MULTI_PAGES = MAX_MULTI_PAGES_GEMINI

/** Per-provider limit helper for multi-page summary */
export function getProviderMultiPageLimit(provider: 'gemini' | 'groq'): number {
	return provider === 'groq' ? MAX_MULTI_PAGES_GROQ : MAX_MULTI_PAGES_GEMINI
}

/** Max chars per post (slightly tighter for multi-page to save tokens) */
const MAX_CHARS_PER_POST = 1000

/** Min chars to keep a post after truncation */
const MIN_CHARS_PER_POST = 40

/** Concurrency limit for parallel fetches */
const FETCH_CONCURRENCY = 4

/** Delay between fetch batches to avoid rate limiting (ms) */
const FETCH_BATCH_DELAY = 200

// =============================================================================
// TYPES
// =============================================================================

export interface PageData {
	pageNumber: number
	posts: ExtractedPost[]
	postCount: number
	uniqueAuthors: string[]
}

export interface MultiPageFetchResult {
	pages: PageData[]
	totalPosts: number
	totalUniqueAuthors: number
	threadTitle: string
	fetchErrors: number[]
}

export interface MultiPageProgress {
	phase: 'fetching' | 'summarizing'
	current: number
	total: number
	/** Optional human-readable status detail for the current phase (retry, repair, etc.) */
	message?: string
	/** For map-reduce: which batch is being summarized */
	batch?: number
	totalBatches?: number
}

// =============================================================================
// URL HELPERS
// =============================================================================

/**
 * Gets the base URL for the current thread (without page number).
 */
function getThreadBaseUrl(): string {
	const baseUrlInput = document.getElementById(MV_SELECTORS.GLOBAL.BASE_URL_INPUT_ID) as HTMLInputElement
	if (baseUrlInput?.value) return baseUrlInput.value

	const path = window.location.pathname
	const match = path.match(/^(\/foro\/[^/]+\/[^/]+)(?:\/\d+)?$/)
	return match ? match[1] : path.replace(/\/\d+$/, '')
}

/**
 * Builds the full URL for a specific page of the thread.
 * Exported for unit tests (handles both normal and ?u=username pagination).
 */
export function buildPageUrl(baseUrl: string, pageNumber: number): string {
	const params = new URLSearchParams(window.location.search)

	let relativePath: string
	if (params.has('u')) {
		// In filtered threads, page 1 must NOT include `pagina`, otherwise opening the
		// modal from `?u=Nick&pagina=N` will incorrectly fetch page N again.
		if (pageNumber > 1) params.set('pagina', String(pageNumber))
		else params.delete('pagina')
		const queryString = params.toString()
		relativePath = queryString ? `${baseUrl}?${queryString}` : baseUrl
	} else {
		relativePath = pageNumber === 1 ? baseUrl : `${baseUrl}/${pageNumber}`
	}

	return relativePath.startsWith('/') ? `${window.location.origin}${relativePath}` : relativePath
}

/**
 * Gets total pages available for the current thread.
 */
export function getTotalPages(): number {
	let maxPage = 1

	// Check pagination links (numbered <a> elements)
	const paginationLinks = document.querySelectorAll<HTMLAnchorElement>(MV_SELECTORS.THREAD.PAGINATION_LINKS)
	for (const link of paginationLinks) {
		// Standard format: /foro/category/thread-123/5
		const pathMatch = link.href.match(/\/(\d+)$/)
		// User filter format: ?u=Username&pagina=5
		const queryMatch = link.href.match(/[?&]pagina=(\d+)/)
		const match = pathMatch || queryMatch
		if (match) {
			const num = parseInt(match[1], 10)
			if (num > maxPage) maxPage = num
		}
	}

	// Check current page indicator (not a link, could be higher than any link)
	const currentPageEl = document.querySelector(MV_SELECTORS.THREAD.PAGINATION_CURRENT)
	if (currentPageEl?.textContent) {
		const num = parseInt(currentPageEl.textContent.trim(), 10)
		if (!isNaN(num) && num > maxPage) maxPage = num
	}

	return maxPage
}

/**
 * Gets the current page number from the URL.
 */
export function getCurrentPage(): number {
	const urlMatch = window.location.pathname.match(/\/(\d+)$/)
	if (urlMatch) return parseInt(urlMatch[1], 10)

	// User filter format: ?u=Username&pagina=5
	const paginaParam = new URLSearchParams(window.location.search).get('pagina')
	if (paginaParam) {
		const num = parseInt(paginaParam, 10)
		if (!isNaN(num)) return num
	}

	const activePage = document.querySelector(MV_SELECTORS.THREAD.PAGINATION_CURRENT)
	if (activePage?.textContent) {
		const num = parseInt(activePage.textContent.trim(), 10)
		if (!isNaN(num)) return num
	}

	return 1
}

// =============================================================================
// FETCH & PARSE
// =============================================================================

/**
 * Fetches the HTML of a single thread page and parses it into a Document.
 */
async function fetchPageDocument(url: string): Promise<Document> {
	const result = await sendMessage('fetchThreadPageHtml', { url })
	if (!result?.success || !result.html) {
		throw new Error(result?.error || 'Failed to fetch thread page HTML')
	}

	const html = result.html
	const parser = new DOMParser()
	return parser.parseFromString(html, 'text/html')
}

/**
 * Extracts posts from a parsed Document (not the live DOM).
 * Uses the shared parsePostElement for consistent extraction.
 */
function extractPostsFromDocument(doc: Document, userAnalysisMode = false): ExtractedPost[] {
	const posts: ExtractedPost[] = []
	const postElements = doc.querySelectorAll<HTMLElement>(`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}`)

	postElements.forEach(postEl => {
		try {
			const post = parsePostElement(postEl, { userAnalysisMode })
			if (post && post.content.length > 3) {
				posts.push(post)
			}
		} catch (e) {
			logger.warn('Error extracting post from fetched page:', e)
		}
	})

	posts.sort((a, b) => a.number - b.number)
	return truncatePosts(posts)
}


/**
 * Truncates posts to fit within token limits for multi-page processing.
 */
function truncatePosts(posts: ExtractedPost[]): ExtractedPost[] {
	return posts
		.map(post => {
			if (post.content.length > MAX_CHARS_PER_POST) {
				return {
					...post,
					content: post.content.substring(0, MAX_CHARS_PER_POST) + '...',
					charCount: MAX_CHARS_PER_POST + 3,
				}
			}
			return post
		})
		.filter(p => p.content.length > MIN_CHARS_PER_POST)
}

/**
 * Gets thread title from a parsed document.
 */
function getTitleFromDocument(doc: Document): string {
	const h1 = doc.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
	return h1?.textContent?.trim() || ''
}

// =============================================================================
// MAIN MULTI-PAGE FETCH
// =============================================================================

/**
 * Fetches and extracts posts from multiple thread pages.
 * Uses controlled concurrency to avoid overwhelming the server.
 *
 * @param fromPage - Start page (inclusive)
 * @param toPage - End page (inclusive)
 * @param onProgress - Progress callback
 */
export async function fetchMultiplePages(
	fromPage: number,
	toPage: number,
	onProgress?: (progress: MultiPageProgress) => void,
	options?: { userAnalysisMode?: boolean }
): Promise<MultiPageFetchResult> {
	const userAnalysisMode = options?.userAnalysisMode ?? false
	const baseUrl = getThreadBaseUrl()
	const pageNumbers = Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage + i)

	const pages: PageData[] = []
	const fetchErrors: number[] = []
	let threadTitle = ''

	// Fetch in batches with concurrency limit
	let fetchedCount = 0

	for (let i = 0; i < pageNumbers.length; i += FETCH_CONCURRENCY) {
		const batch = pageNumbers.slice(i, i + FETCH_CONCURRENCY)

		onProgress?.({
			phase: 'fetching',
			current: fetchedCount,
			total: pageNumbers.length,
		})

		const results = await Promise.allSettled(
			batch.map(async pageNum => {
				const url = buildPageUrl(baseUrl, pageNum)
				const doc = await fetchPageDocument(url)
				const posts = extractPostsFromDocument(doc, userAnalysisMode)
				const authors = [...new Set(posts.map(p => p.author.toLowerCase()))]

				// Grab title from first successful fetch
				if (!threadTitle) {
					threadTitle = getTitleFromDocument(doc)
				}

				return { pageNumber: pageNum, posts, postCount: posts.length, uniqueAuthors: authors }
			})
		)

		results.forEach((result, idx) => {
			fetchedCount++
			if (result.status === 'fulfilled') {
				pages.push(result.value)
			} else {
				const failedPage = batch[idx]
				fetchErrors.push(failedPage)
				logger.warn(`Failed to fetch page ${failedPage}:`, result.reason)
			}
		})

		// Small delay between batches
		if (i + FETCH_CONCURRENCY < pageNumbers.length) {
			await new Promise(r => setTimeout(r, FETCH_BATCH_DELAY))
		}
	}

	// Emit final fetch progress (100% of fetch phase)
	onProgress?.({
		phase: 'fetching',
		current: pageNumbers.length,
		total: pageNumbers.length,
	})

	// Sort pages by number
	pages.sort((a, b) => a.pageNumber - b.pageNumber)

	// Aggregate stats
	const allAuthors = new Set<string>()
	let totalPosts = 0
	pages.forEach(p => {
		totalPosts += p.postCount
		p.uniqueAuthors.forEach(a => allAuthors.add(a))
	})

	// Fallback title from current page
	if (!threadTitle) {
		const h1 = document.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
		threadTitle = h1?.textContent?.trim() || document.title.replace(' - Mediavida', '').trim()
	}

	return {
		pages,
		totalPosts,
		totalUniqueAuthors: allAuthors.size,
		threadTitle,
		fetchErrors,
	}
}
