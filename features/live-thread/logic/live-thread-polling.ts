/**
 * Live Thread Polling
 *
 * Handles fetching posts, polling logic, and adaptive intervals.
 * Uses DOMPurify directly in content script for reliable HTML sanitization.
 */
import { sanitizeHTML } from '@/lib/sanitize'
import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'
import { reinitializeEmbeds, setupGlobalEmbedListener } from '@/lib/content-modules/utils/reinitialize-embeds'
import { type PostInfo, type LiveStatus, POLL_INTERVALS, MAX_VISIBLE_POSTS, saveLiveState } from './live-thread-state'
import {
	LIVE_THREAD_DELAY_OPTIONS,
	clearLiveThreadDelayQueue,
	enqueueLiveThreadPost,
	getLiveThreadDelay,
	getLiveThreadDelayQueueSize,
	loadLiveThreadDelayPreference,
	onLiveThreadDelayQueueSizeChange,
	resetLiveThreadDelayRuntime,
	setLiveThreadDelay,
	setLiveThreadDelayEnabled,
	setLiveThreadDelayRevealCallback,
} from './live-thread-delay'

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
	'data-s9e-mediaembed',
	'data-youtube',
	'data-videoid',
	'data-autor',
	'data-s9e-livepreview-post',
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

const LIVE_YOUTUBE_EMBED_SELECTOR = '.youtube_lite, .embed.yt, [data-s9e-mediaembed="youtube"]'
const LIVE_YOUTUBE_WIRED_ATTR = 'data-mvp-live-youtube-wired'
const LIVE_LIKES_HREF_ATTR = 'data-mvp-likes-href'
const LIVE_LIKES_MODAL_ID = 'mvp-live-likes-modal'

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
let likeButtonDelegationCleanup: (() => void) | null = null

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
	clearLiveThreadDelayQueue({ reveal: false })
}

// =============================================================================
// LIVE DELAY CONTROLS
// =============================================================================

export async function initializeLiveThreadDelay(enabled: boolean): Promise<void> {
	setLiveThreadDelayRevealCallback((post, pageNum) => {
		insertPostAtTop(post.html, true, pageNum)
	})

	setLiveThreadDelayEnabled(enabled)
	clearLiveThreadDelayQueue({ reveal: false })

	if (!enabled) return
	await loadLiveThreadDelayPreference()
}

export function disposeLiveThreadDelay(): void {
	clearLiveThreadDelayQueue({ reveal: false })
	onLiveThreadDelayQueueSizeChange(null)
	resetLiveThreadDelayRuntime()
}

export function getLiveThreadDelayOptions() {
	return LIVE_THREAD_DELAY_OPTIONS
}

export function getCurrentLiveThreadDelay(): number {
	return getLiveThreadDelay()
}

export function getCurrentLiveThreadDelayQueueSize(): number {
	return getLiveThreadDelayQueueSize()
}

export function onLiveThreadDelayQueueChange(callback: ((size: number) => void) | null): void {
	onLiveThreadDelayQueueSizeChange(callback)
}

export async function updateLiveThreadDelay(delayMs: number): Promise<void> {
	await setLiveThreadDelay(delayMs)
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

function extractYouTubeVideoId(embed: HTMLElement): string | null {
	const direct = embed.getAttribute('data-youtube')?.trim()
	if (direct) return direct

	const anchorWithData = embed.querySelector<HTMLAnchorElement>('a[data-youtube]')
	const fromDataAnchor = anchorWithData?.getAttribute('data-youtube')?.trim()
	if (fromDataAnchor) return fromDataAnchor

	const href =
		anchorWithData?.getAttribute('href') ||
		embed.querySelector<HTMLAnchorElement>('a[href]')?.getAttribute('href') ||
		''
	if (!href) return null

	const watchMatch = href.match(/[?&]v=([\w-]{6,})/i)
	if (watchMatch) return watchMatch[1]

	const shortMatch = href.match(/youtu\.be\/([\w-]{6,})/i)
	if (shortMatch) return shortMatch[1]

	const embedMatch = href.match(/\/embed\/([\w-]{6,})/i)
	if (embedMatch) return embedMatch[1]

	return null
}

function buildYouTubeIframe(videoId: string): HTMLIFrameElement {
	const iframe = document.createElement('iframe')
	iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
	iframe.setAttribute('title', 'YouTube video player')
	iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture')
	iframe.setAttribute('allowfullscreen', '')
	iframe.setAttribute('frameborder', '0')
	iframe.style.width = '100%'
	iframe.style.height = '100%'
	iframe.style.display = 'block'
	return iframe
}

function wireLiveYoutubeEmbeds(container: HTMLElement): void {
	const embeds = container.querySelectorAll<HTMLElement>(LIVE_YOUTUBE_EMBED_SELECTOR)
	embeds.forEach(embed => {
		if (embed.hasAttribute(LIVE_YOUTUBE_WIRED_ATTR)) return
		embed.setAttribute(LIVE_YOUTUBE_WIRED_ATTR, 'true')

		embed.addEventListener(
			'click',
			event => {
				if (embed.querySelector('iframe')) return

				const videoId = extractYouTubeVideoId(embed)
				if (!videoId) return

				event.preventDefault()
				event.stopPropagation()

				embed.innerHTML = ''
				embed.appendChild(buildYouTubeIframe(videoId))
			},
			true
		)
	})
}

function hydrateLazyIframes(container: HTMLElement): void {
	const iframes = container.querySelectorAll<HTMLIFrameElement>('iframe')
	iframes.forEach(iframe => {
		const src = iframe.getAttribute('src')?.trim()
		if (src) return

		const lazySrc = iframe.getAttribute('data-src')?.trim() || iframe.getAttribute('data-lazy')?.trim()
		if (!lazySrc) return

		iframe.setAttribute('src', lazySrc)
	})
}

function reinitializeMvScripts(embedScope?: HTMLElement): void {
	try {
		// Reinitialize tooltips for quote hovers
		if (typeof window.initTooltips === 'function') {
			window.initTooltips()
		}
	} catch {
		/* ignore */
	}

	// Reinitialize embed iframes (Twitter, Instagram, etc.)
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (postsWrap) {
		const scope = embedScope ?? postsWrap
		hydrateLazyIframes(scope)
		wireLiveYoutubeEmbeds(scope)
		reinitializeEmbeds(scope)
	}

	// Update relative timestamps
	updateRelativeTimestamps()
}

function getCurrentThreadNumericId(): string | null {
	let path = window.location.pathname
	path = path.replace(/\/live\/?$/i, '')
	const match = path.match(/-(\d+)(?:\/\d+)?\/?$/)
	return match?.[1] ?? null
}

function normalizeLiveLikeButtons(container: HTMLElement): void {
	const currentThreadId = getCurrentThreadNumericId()
	const likeButtons = container.querySelectorAll<HTMLAnchorElement>('a.btnmola[href]')
	likeButtons.forEach(btn => {
		let href = btn.getAttribute('href')
		if (!href) return
		if (currentThreadId) {
			href = href.replace(/tid=\d+/i, `tid=${currentThreadId}`)
		}
		btn.setAttribute(LIVE_LIKES_HREF_ATTR, href)
		btn.removeAttribute('href')
		btn.style.cursor = 'pointer'
	})
}

function showLiveLikesModal(html: string): void {
	const existing = document.getElementById(LIVE_LIKES_MODAL_ID)
	if (existing) existing.remove()

	const modal = document.createElement('div')
	modal.id = LIVE_LIKES_MODAL_ID
	modal.innerHTML = `
		<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;">
			<div style="background:#2d2d2d;border-radius:8px;max-width:500px;width:90%;max-height:80vh;overflow:auto;position:relative;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
				<button id="${LIVE_LIKES_MODAL_ID}-close" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>
				<div style="padding:20px 24px;" class="mvp-likes-content">${html}</div>
			</div>
		</div>
	`

	const style = document.createElement('style')
	style.textContent = `
		#${LIVE_LIKES_MODAL_ID} .mvp-likes-content > *:first-child {
			margin-bottom: 16px !important;
			padding-bottom: 12px !important;
			border-bottom: 1px solid rgba(255,255,255,0.1) !important;
		}
		#${LIVE_LIKES_MODAL_ID} .mvp-likes-content img {
			margin: 2px !important;
		}
	`
	modal.appendChild(style)
	document.body.appendChild(modal)

	const closeBtn = document.getElementById(`${LIVE_LIKES_MODAL_ID}-close`)
	const closeModal = () => modal.remove()
	closeBtn?.addEventListener('click', closeModal)
	modal.addEventListener('click', e => {
		if (e.target === modal.firstElementChild) closeModal()
	})
	document.addEventListener('keydown', function handler(e) {
		if (e.key === 'Escape') {
			closeModal()
			document.removeEventListener('keydown', handler)
		}
	})
}

function setupLikeButtonDelegation(): void {
	if (likeButtonDelegationCleanup) return

	const handler = async (e: Event) => {
		const target = e.target as HTMLElement | null
		const likeButton = target?.closest(`a.btnmola[${LIVE_LIKES_HREF_ATTR}]`) as HTMLAnchorElement | null
		if (!likeButton) return

		e.preventDefault()
		e.stopPropagation()
		if ('stopImmediatePropagation' in e && typeof e.stopImmediatePropagation === 'function') {
			e.stopImmediatePropagation()
		}

		const href = likeButton.getAttribute(LIVE_LIKES_HREF_ATTR)
		if (!href) return

		const url = href.startsWith('/') ? `${window.location.origin}${href}` : href

		try {
			const response = await fetch(url, {
				credentials: 'include',
				headers: {
					Accept: 'text/html',
					'X-Requested-With': 'XMLHttpRequest',
				},
			})
			if (!response.ok) {
				logger.error('LiveThread likes fetch failed:', response.status)
				return
			}
			const html = await response.text()
			showLiveLikesModal(html)
		} catch (error) {
			logger.error('LiveThread likes fetch error:', error)
		}
	}

	document.addEventListener('click', handler, true)
	likeButtonDelegationCleanup = () => {
		document.removeEventListener('click', handler, true)
	}
}

function cleanupLikeButtonDelegation(): void {
	likeButtonDelegationCleanup?.()
	likeButtonDelegationCleanup = null
}

function dispatchLiveContentInjectedEvent(postCount: number, page?: number, isInitial = false): void {
	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.CONTENT_INJECTED, {
			detail: {
				postCount,
				page: page ?? knownTotalPages,
				isLive: true,
				isInitial,
			},
		})
	)
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
export function insertPostAtTop(postHtml: string, animate = true, pageNum?: number, notifyContentInjected = true): void {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	const tempDiv = document.createElement('div')
	tempDiv.innerHTML = sanitizePostHtml(postHtml)
	const newElement = tempDiv.firstElementChild as HTMLElement

	if (newElement) {
		normalizeLiveLikeButtons(newElement)

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

		reinitializeMvScripts(newElement)

		if (notifyContentInjected) {
			dispatchLiveContentInjectedEvent(1, pageNum)
		}
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
			normalizeLiveLikeButtons(el)
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
	reinitializeMvScripts(postsWrap)
	dispatchLiveContentInjectedEvent(latestPosts.length, knownTotalPages, true)
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
			const shouldQueue = enqueueLiveThreadPost(newPosts[i], knownTotalPages)
			if (!shouldQueue) {
				insertPostAtTop(newPosts[i].html, true, knownTotalPages, false)
			}
		}

		lastSeenPostNum = Math.max(...newPosts.map(p => p.num), lastSeenPostNum)
		await saveLiveState({ enabled: true, lastSeenPostNum, timestamp: Date.now() })
		dispatchLiveContentInjectedEvent(newPosts.length, knownTotalPages)
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
	// Set up global listener for embed resize messages (Twitter, etc.)
	setupGlobalEmbedListener()
	setupLikeButtonDelegation()

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
	cleanupLikeButtonDelegation()
}
