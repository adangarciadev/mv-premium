/**
 * Live Thread Polling
 *
 * Handles fetching posts, polling logic, and adaptive intervals.
 * Uses DOMPurify directly in content script for reliable HTML sanitization.
 */
import { sanitizeHTML } from '@/lib/sanitize'
import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'
import { type PostInfo, type LiveStatus, POLL_INTERVALS, MAX_VISIBLE_POSTS, saveLiveState } from './live-thread-state'

// =============================================================================
// CONSTANTS
// =============================================================================

// Sanitize config for Mediavida post HTML (permissive but safe)
const POST_ALLOWED_TAGS = [
	'div',
	'span',
	'p',
	'br',
	'a',
	'img',
	'blockquote',
	'code',
	'pre',
	'strong',
	'em',
	'b',
	'i',
	'u',
	's',
	'ul',
	'ol',
	'li',
	'table',
	'tr',
	'td',
	'th',
	'thead',
	'tbody',
	'iframe',
	'video',
	'source',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'figure',
	'figcaption',
	'abbr',
	'cite',
	'del',
	'ins',
	'mark',
	'q',
	'small',
	'sub',
	'sup',
	'time',
	'details',
	'summary',
	'header',
	'footer',
	'article',
	'section',
]

const POST_ALLOWED_ATTRS = [
	'href',
	'src',
	'class',
	'id',
	'data-num',
	'data-time',
	'data-uid',
	'target',
	'rel',
	'alt',
	'title',
	'width',
	'height',
	'style',
	'data-post',
	'data-src',
	'data-lazy',
	'loading',
	'srcset',
	'sizes',
	'datetime',
	'cite',
	'colspan',
	'rowspan',
	'headers',
	'scope',
	'controls',
	'autoplay',
	'loop',
	'muted',
	'poster',
	'preload',
	'allowfullscreen',
	'frameborder',
	'allow',
	'sandbox',
]

/**
 * Sanitize post HTML using DOMPurify directly (sync)
 */
function sanitizePostHtml(html: string): string {
	return sanitizeHTML(html, {
		allowedTags: POST_ALLOWED_TAGS,
		allowedAttrs: POST_ALLOWED_ATTRS,
	})
}

// =============================================================================
// STATE
// =============================================================================

let isLiveActive = false
let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
let lastSeenPostNum = 0
let lastPostTimestamp = Date.now()
let currentPollInterval: number = POLL_INTERVALS.NORMAL
let consecutiveErrors = 0
let knownTotalPages = 1
let statusUpdateCallback: ((status: LiveStatus) => void) | null = null
let timestampIntervalId: ReturnType<typeof setInterval> | null = null

const TIMESTAMP_UPDATE_INTERVAL = 10000 // Update timestamps every 10 seconds

export function setIsLiveActive(active: boolean): void {
	isLiveActive = active
}

export function getIsLiveActive(): boolean {
	return isLiveActive
}

export function setStatusCallback(cb: ((status: LiveStatus) => void) | null): void {
	statusUpdateCallback = cb
}

export function getLastSeenPostNum(): number {
	return lastSeenPostNum
}

export function setLastSeenPostNum(num: number): void {
	lastSeenPostNum = num
}

export function setLastPostTimestamp(ts: number): void {
	lastPostTimestamp = ts
}

export function resetPollingState(): void {
	lastSeenPostNum = 0
	lastPostTimestamp = Date.now()
	currentPollInterval = POLL_INTERVALS.NORMAL
	consecutiveErrors = 0
	knownTotalPages = 1
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Detects the thread base URL from hidden inputs or URL path.
 */
export function getBaseUrl(): string {
	const baseUrlInput = document.getElementById(MV_SELECTORS.GLOBAL.BASE_URL_INPUT_ID) as HTMLInputElement
	if (baseUrlInput?.value) return baseUrlInput.value
	const path = window.location.pathname
	const match = path.match(/^(\/foro\/[^/]+\/[^/]+)(?:\/\d+)?$/)
	return match ? match[1] : path.replace(/\/\d+$/, '')
}

/**
 * Extracts the total number of pages from a parsed thread document.
 */
export function getTotalPagesFromDoc(doc: Document): number {
	const bottomProgress = doc.querySelector(MV_SELECTORS.THREAD.BOTTOM_PROGRESS)
	if (bottomProgress) {
		const match = bottomProgress.textContent?.match(/\d+\s*\/\s*(\d+)/)
		if (match) return parseInt(match[1], 10)
	}
	const pagination = doc.querySelector(MV_SELECTORS.THREAD.PAGINATION_LIST + ', ' + MV_SELECTORS.THREAD.PAGINATION_SIDE)
	if (pagination) {
		const links = pagination.querySelectorAll('a[href]')
		let maxPage = 1
		links.forEach(link => {
			const href = link.getAttribute('href') || ''
			const match = href.match(/\/(\d+)$/)
			if (match) {
				const pageNum = parseInt(match[1], 10)
				if (pageNum > maxPage) maxPage = pageNum
			}
		})
		return maxPage
	}
	return 1
}

export function getTotalPages(): number {
	return getTotalPagesFromDoc(document)
}

/**
 * Asynchronously fetches a thread page by number.
 * @param pageNum - The page number to fetch
 */
export async function fetchPage(pageNum: number): Promise<Document | null> {
	const baseUrl = getBaseUrl()
	const relativePath = pageNum > 1 ? `${baseUrl}/${pageNum}` : baseUrl
	// Firefox requires absolute URLs for fetch() in extensions
	const absoluteUrl = relativePath.startsWith('http') ? relativePath : `${window.location.origin}${relativePath}`
	const urlAntiCache = `${absoluteUrl}${absoluteUrl.includes('?') ? '&' : '?'}t=${Date.now()}`

	try {
		const response = await fetch(urlAntiCache, {
			credentials: 'include',
			cache: 'no-store',
			headers: {
				'Pragma': 'no-cache',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			},
		})

		if (!response.ok) return null
		const html = await response.text()
		return new DOMParser().parseFromString(html, 'text/html')
	} catch (error) {
		logger.error('LiveThread fetch error:', error)
		return null
	}
}

/**
 * Extracts post metadata and HTML from a parsed thread document.
 */
export function extractPosts(doc: Document): PostInfo[] {
	const posts: PostInfo[] = []
	doc.querySelectorAll(MV_SELECTORS.THREAD.POSTS_IN_CONTAINER).forEach(el => {
		const num = parseInt(el.getAttribute('data-num') || '0', 10)
		const timeEl = el.querySelector('[data-time]')
		const timestamp = timeEl ? parseInt(timeEl.getAttribute('data-time') || '0', 10) * 1000 : undefined
		if (num > 0) posts.push({ num, html: el.outerHTML, timestamp })
	})
	return posts.sort((a, b) => a.num - b.num)
}

function calculatePollInterval(): number {
	const timeSinceLastPost = Date.now() - lastPostTimestamp
	if (timeSinceLastPost < 30000) return POLL_INTERVALS.HIGH_ACTIVITY
	if (timeSinceLastPost < 120000) return POLL_INTERVALS.NORMAL
	if (timeSinceLastPost < 600000) return POLL_INTERVALS.LOW_ACTIVITY
	return POLL_INTERVALS.INACTIVE
}

function reinitializeMvScripts(): void {
	try {
		// Reinitialize tooltips for quote hovers
		if (typeof window.initTooltips === 'function') {
			window.initTooltips()
		}
	} catch {
		/* ignore */
	}

	// Reinitialize embed iframes (Twitter, Instagram, etc.)
	// DOMPurify strips the onload handler, so we need to manually set up the MessageChannel
	reinitializeEmbedIframes()

	// Update relative timestamps
	updateRelativeTimestamps()
}

/**
 * Reinitializes embed iframes that lost their onload handler due to DOMPurify sanitization.
 * Since MessageChannel communication doesn't work with fetched iframes, we use fixed heights.
 */
function reinitializeEmbedIframes(): void {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	// Find all embed iframes that haven't been initialized yet
	const embedContainers = postsWrap.querySelectorAll('[data-s9e-mediaembed]')

	embedContainers.forEach(container => {
		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		if (!iframe) return

		// Skip if already has a proper height set (already initialized)
		const currentHeight = parseInt(iframe.style.height || '0', 10)
		if (currentHeight > 100) return

		// Skip if already processed
		if (iframe.dataset.mvpEmbedInit === 'true') return
		iframe.dataset.mvpEmbedInit = 'true'

		// Set fixed heights based on embed type
		const embedType = container.getAttribute('data-s9e-mediaembed')
		if (embedType === 'twitter') {
			iframe.style.height = '700px'
		} else if (embedType === 'instagram') {
			iframe.style.height = '1000px'
		} else {
			iframe.style.height = '600px'
		}

		// Ensure no scrolling
		iframe.setAttribute('scrolling', 'no')
		iframe.style.overflow = 'hidden'
	})
}

/**
 * Updates all visible timestamps to show relative time (e.g., "5s", "2m", "1h").
 * This is our own implementation that doesn't depend on Mediavida's scripts.
 */
function updateRelativeTimestamps(): void {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	const timeElements = postsWrap.querySelectorAll('[data-time]')
	const nowSeconds = Math.floor(Date.now() / 1000)

	timeElements.forEach(el => {
		const timestamp = parseInt(el.getAttribute('data-time') || '0', 10)
		if (timestamp > 0) {
			const diffSeconds = nowSeconds - timestamp
			el.textContent = formatRelativeTime(diffSeconds)
		}
	})
}

/**
 * Formats a time difference in seconds to a human-readable relative string.
 * Matches Mediavida's "tiny" format: s, m, h, d
 */
function formatRelativeTime(seconds: number): string {
	if (seconds < 0) return '1s'
	if (seconds < 60) return `${Math.max(1, seconds)}s`
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
	return `${Math.floor(seconds / 86400)}d`
}

// =============================================================================
// POST INSERTION
// =============================================================================

/**
 * Injects a new post HTML at the top of the thread view.
 * Handles DOM sanitization and maximum post limit trimming.
 * @param postHtml - The raw post HTML to inject
 * @param animate - Whether to apply the new post animation
 * @param pageNum - The page number this post belongs to (for pinning feature)
 */
export function insertPostAtTop(postHtml: string, animate = true, pageNum?: number): void {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	const tempDiv = document.createElement('div')
	tempDiv.innerHTML = sanitizePostHtml(postHtml)
	const newElement = tempDiv.firstElementChild as HTMLElement

	if (newElement) {
		// Set the page number for pinning feature to pick up
		if (pageNum) {
			newElement.setAttribute('data-mv-page', String(pageNum))
		}

		if (animate) {
			newElement.classList.add(DOM_MARKERS.LIVE_THREAD.NEW_POST)
			// Keep the original server timestamp so posts show accurate relative time
			// (e.g., "5m" if posted 5 minutes ago while tab was in background)
		}

		const firstPost = postsWrap.firstElementChild
		if (firstPost) {
			postsWrap.insertBefore(newElement, firstPost)
		} else {
			postsWrap.appendChild(newElement)
		}

		// Trim if over limit
		const allPosts = postsWrap.querySelectorAll(MV_SELECTORS.THREAD.POST)
		if (allPosts.length > MAX_VISIBLE_POSTS) {
			for (let i = MAX_VISIBLE_POSTS; i < allPosts.length; i++) {
				allPosts[i].remove()
			}
		}

		reinitializeMvScripts()
	}
}

// =============================================================================
// LOADING & POLLING
// =============================================================================

/**
 * Loads the initial set of posts for the live view, fetching from the last pages if necessary.
 */
export async function loadInitialPosts(): Promise<void> {
	statusUpdateCallback?.('updating')

	knownTotalPages = getTotalPages()

	const allPosts: (PostInfo & { pageNum: number })[] = []
	let currentPage = knownTotalPages

	while (allPosts.length < MAX_VISIBLE_POSTS && currentPage >= 1) {
		const doc = await fetchPage(currentPage)
		if (!doc) break

		const pagePosts = extractPosts(doc)
		// Track which page each post came from
		allPosts.unshift(...pagePosts.map(p => ({ ...p, pageNum: currentPage })))

		currentPage--

		if (allPosts.length >= MAX_VISIBLE_POSTS) break
	}

	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) {
		statusUpdateCallback?.('error')
		return
	}

	const latestPosts = allPosts.slice(-MAX_VISIBLE_POSTS)

	postsWrap.innerHTML = ''
	// Sanitize all posts synchronously
	const sanitizedHtmls = latestPosts.map(p => sanitizePostHtml(p.html))

	for (let i = latestPosts.length - 1; i >= 0; i--) {
		const tempDiv = document.createElement('div')
		tempDiv.innerHTML = sanitizedHtmls[i]
		const el = tempDiv.firstElementChild as HTMLElement
		if (el) {
			// Set the page number for pinning feature to pick up
			el.setAttribute('data-mv-page', String(latestPosts[i].pageNum))
			postsWrap.appendChild(el)
		}
	}

	if (latestPosts.length > 0) {
		lastSeenPostNum = Math.max(...latestPosts.map(p => p.num))
		const newestPost = latestPosts[latestPosts.length - 1]
		lastPostTimestamp = newestPost.timestamp || Date.now()
	}

	await saveLiveState({ enabled: true, lastSeenPostNum, timestamp: Date.now() })
	reinitializeMvScripts()
	statusUpdateCallback?.('connected')
}

/**
 * Performs a polling request to check for new posts.
 * Automatically handles page advances and adaptive poll intervals.
 * @returns Number of new posts detected
 */
export async function pollForNewPosts(): Promise<number> {
	// Note: We intentionally continue polling even when document.hidden = true
	// Browsers throttle background timers (~1 poll/min) but we want updates to accumulate
	statusUpdateCallback?.(document.hidden ? 'paused' : 'updating')

	// Fetch current known last page
	let doc = await fetchPage(knownTotalPages)
	if (!doc) {
		consecutiveErrors++
		statusUpdateCallback?.('error')
		if (consecutiveErrors >= 3) {
			currentPollInterval = Math.min(currentPollInterval * 2, POLL_INTERVALS.INACTIVE)
		}
		scheduleNextPoll()
		return 0
	}

	// Check if there are new pages
	const newTotalPages = getTotalPagesFromDoc(doc)
	if (newTotalPages > knownTotalPages) {
		knownTotalPages = newTotalPages
		// Fetch the new last page
		const newDoc = await fetchPage(knownTotalPages)
		if (newDoc) {
			doc = newDoc
		}
	}

	consecutiveErrors = 0
	const remotePosts = extractPosts(doc)
	const newPosts = remotePosts.filter(p => p.num > lastSeenPostNum)

	if (newPosts.length > 0) {
		const newestPost = newPosts[newPosts.length - 1]
		lastPostTimestamp = newestPost.timestamp || Date.now()

		// Insert posts in reverse order (oldest first so newest ends up at top)
		for (let i = newPosts.length - 1; i >= 0; i--) {
			insertPostAtTop(newPosts[i].html, true, knownTotalPages)
		}

		lastSeenPostNum = Math.max(...newPosts.map(p => p.num), lastSeenPostNum)
		await saveLiveState({ enabled: true, lastSeenPostNum, timestamp: Date.now() })
	}

	const newInterval = calculatePollInterval()
	if (newInterval !== currentPollInterval) {
		currentPollInterval = newInterval
	}

	statusUpdateCallback?.('connected')
	scheduleNextPoll()
	return newPosts.length
}

function scheduleNextPoll(): void {
	if (!isLiveActive) return
	if (pollTimeoutId) clearTimeout(pollTimeoutId)
	pollTimeoutId = setTimeout(() => void pollForNewPosts(), currentPollInterval)
}

function handleVisibilityChange(): void {
	if (document.hidden) {
		statusUpdateCallback?.('paused')
	} else {
		if (pollTimeoutId) clearTimeout(pollTimeoutId)
		void pollForNewPosts()
	}
}

export function startPolling(): void {
	document.addEventListener('visibilitychange', handleVisibilityChange)
	currentPollInterval = POLL_INTERVALS.NORMAL
	scheduleNextPoll()
	startTimestampUpdater()
}

/**
 * Starts a periodic timer to update all visible timestamps.
 * This ensures times like "1s" -> "10s" -> "1m" keep updating.
 */
function startTimestampUpdater(): void {
	if (timestampIntervalId) return
	timestampIntervalId = setInterval(() => {
		updateRelativeTimestamps()
	}, TIMESTAMP_UPDATE_INTERVAL)
}

function stopTimestampUpdater(): void {
	if (timestampIntervalId) {
		clearInterval(timestampIntervalId)
		timestampIntervalId = null
	}
}

export function stopPolling(): void {
	if (pollTimeoutId) {
		clearTimeout(pollTimeoutId)
		pollTimeoutId = null
	}
	stopTimestampUpdater()
	document.removeEventListener('visibilitychange', handleVisibilityChange)
}
