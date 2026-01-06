/**
 * Infinite Scroll Logic
 *
 * ARCHITECTURE: Page-based Sliding Window
 * - Maintains a window of N active pages in the DOM
 * - Unloads pages outside the window, replacing them with height-preserving placeholders
 * - Reloads pages when user scrolls back into placeholder areas
 * - Uses content-visibility CSS for additional rendering optimization
 *
 * Opt-in activation: User clicks button to start infinite scroll from current page.
 * Exit redirects to current visible page URL for clean state.
 */

import { PageIndicator } from '../components/page-indicator'
import { PageDivider } from '../components/page-divider'
import { InfiniteScrollButton } from '../components/scroll-toggle-button'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { getSettings } from '@/store/settings-store'
import {
	mountFeature,
	unmountFeature,
	isFeatureMounted,
	updateFeature,
} from '@/lib/content-modules/utils/react-helpers'
import { isThreadPage } from '@/lib/content-modules/utils/page-detection'
import { MV_SELECTORS, FEATURE_IDS, DEBOUNCE, INTERSECTION } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { logger } from '@/lib/logger'

// Extracted modules
import {
	toggleInfiniteScrollDebug,
	registerDebugGlobals,
	updateDebugIndicators,
	isDebugMode,
	type DebugState,
} from './infinite-scroll-debug'
import {
	PAGES_BEFORE,
	PAGES_AFTER,
	WINDOW_SIZE,
	MIN_PAGES_BEFORE_UNLOAD,
	WINDOW_MANAGEMENT_DEBOUNCE,
	PAGE_BLOCK_CLASS,
	PAGE_PLACEHOLDER_CLASS,
	DIVIDER_CLASS,
	type PageBlock,
	type PageMarker,
} from './infinite-scroll-state'

// Re-export debug functions for external use
export { toggleInfiniteScrollDebug, isDebugMode }

// =============================================================================
// STATE
// =============================================================================

let startPage = 1
let loadedPagesCount = 1
let totalPages = 1
let visiblePage = 1
let isLoading = false
let isScrollActive = false
let isLiveModeActive = false
let observer: IntersectionObserver | null = null
let topObserver: IntersectionObserver | null = null
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let windowManagementTimeout: ReturnType<typeof setTimeout> | null = null

let pageBlocks: Map<number, PageBlock> = new Map()
let pageMarkers: PageMarker[] = []

// Feature IDs for Root Manager
const BUTTON_FEATURE_ID = FEATURE_IDS.INFINITE_SCROLL_BUTTON
const INDICATOR_FEATURE_ID = FEATURE_IDS.INFINITE_SCROLL_INDICATOR
const SENTINEL_ID = DOM_MARKERS.IDS.INFINITE_SENTINEL
const INDICATOR_CONTAINER_ID = DOM_MARKERS.IDS.INFINITE_INDICATOR
const BUTTON_CONTAINER_ID = DOM_MARKERS.IDS.INFINITE_SCROLL_BUTTON_CONTAINER
let dividerCounter = 0

// =============================================================================
// DEBUG STATE GETTER
// =============================================================================

/**
 * Get current state of the sliding window for debugging.
 * Call from console: mvInfiniteScrollState()
 */
export function getInfiniteScrollState(): DebugState {
	const blocks: DebugState['pageBlocks'] = []

	pageBlocks.forEach((block, pageNum) => {
		blocks.push({
			page: pageNum,
			isLoaded: block.isLoaded,
			cachedHeight: block.cachedHeight,
			hasCachedHTML: block.cachedHTML !== null,
		})
	})

	return {
		isActive: isScrollActive,
		startPage,
		visiblePage,
		loadedPagesCount,
		totalPages,
		windowConfig: {
			PAGES_BEFORE,
			PAGES_AFTER,
			WINDOW_SIZE,
			MIN_PAGES_BEFORE_UNLOAD,
		},
		currentWindow: {
			start: Math.max(startPage, visiblePage - PAGES_BEFORE),
			end: Math.min(startPage + loadedPagesCount - 1, visiblePage + PAGES_AFTER),
		},
		pageBlocks: blocks.sort((a, b) => a.page - b.page),
		loadedInDOM: blocks.filter(b => b.isLoaded).length,
		unloadedPlaceholders: blocks.filter(b => !b.isLoaded).length,
	}
}

// =============================================================================
// URL & PAGE DETECTION
// =============================================================================

function getBaseUrl(): string {
	const baseUrlInput = document.getElementById(MV_SELECTORS.GLOBAL.BASE_URL_INPUT_ID) as HTMLInputElement
	if (baseUrlInput?.value) {
		return baseUrlInput.value
	}
	const path = window.location.pathname
	const match = path.match(/^(\/foro\/[^/]+\/[^/]+)(?:\/\d+)?$/)
	return match ? match[1] : path.replace(/\/\d+$/, '')
}

function getCurrentPageNumber(): number {
	const match = window.location.pathname.match(/\/(\d+)$/)
	if (match) {
		return parseInt(match[1], 10)
	}

	const currentSpan = document.querySelector(
		`${MV_SELECTORS.THREAD.PAGINATION_LIST} .current, ${MV_SELECTORS.THREAD.PAGINATION_SIDE} .current`
	)
	if (currentSpan) {
		return parseInt(currentSpan.textContent || '1', 10)
	}

	return 1
}

function detectTotalPages(): number {
	const bottomProgress = document.querySelector(MV_SELECTORS.THREAD.BOTTOM_PROGRESS)
	if (bottomProgress) {
		const match = bottomProgress.textContent?.match(/\d+\s*\/\s*(\d+)/)
		if (match) {
			return parseInt(match[1], 10)
		}
	}

	const pagination = document.querySelector(
		MV_SELECTORS.THREAD.PAGINATION_LIST + ', ' + MV_SELECTORS.THREAD.PAGINATION_SIDE
	)
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

// =============================================================================
// PAGE LOADING
// =============================================================================

async function fetchPage(pageNum: number): Promise<Document | null> {
	const baseUrl = getBaseUrl()
	const url = pageNum === 1 ? baseUrl : `${baseUrl}/${pageNum}`

	try {
		const response = await fetch(url, {
			credentials: 'include',
			headers: { Accept: 'text/html' },
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const html = await response.text()
		const parser = new DOMParser()
		return parser.parseFromString(html, 'text/html')
	} catch (error) {
		logger.error('Error fetching page:', error)
		return null
	}
}

function extractPosts(doc: Document): Element[] {
	const posts = doc.querySelectorAll(MV_SELECTORS.THREAD.POST)
	return Array.from(posts)
}

function applyContentVisibilityOptimization(container: HTMLElement): void {
	container.style.contentVisibility = 'auto'
	container.style.containIntrinsicSize = 'auto 2000px'
}

async function injectPosts(posts: Element[], pageNum: number): Promise<void> {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) {
		logger.error('Could not find #posts-wrap')
		return
	}

	const sentinel = document.getElementById(SENTINEL_ID)

	// Create page block container
	const pageBlockContainer = document.createElement('div')
	pageBlockContainer.className = PAGE_BLOCK_CLASS
	pageBlockContainer.setAttribute('data-page', String(pageNum))
	applyContentVisibilityOptimization(pageBlockContainer)

	// Create page divider container
	const dividerContainer = document.createElement('div')
	dividerContainer.className = DIVIDER_CLASS
	dividerContainer.setAttribute('data-page', String(pageNum))

	if (sentinel) {
		postsWrap.insertBefore(pageBlockContainer, sentinel)
	} else {
		postsWrap.appendChild(pageBlockContainer)
	}

	pageBlockContainer.appendChild(dividerContainer)

	pageMarkers.push({ page: pageNum, el: dividerContainer })

	// Mount PageDivider
	const dividerId = `${FEATURE_IDS.INFINITE_SCROLL_DIVIDER_PREFIX}${++dividerCounter}`
	dividerContainer.setAttribute('data-feature-id', dividerId)
	mountFeature(
		dividerId,
		dividerContainer,
		<ShadowWrapper>
			<PageDivider pageNumber={pageNum} />
		</ShadowWrapper>
	)

	// Insert posts
	posts.forEach(post => {
		const clonedPost = post.cloneNode(true) as HTMLElement
		clonedPost.setAttribute('data-mv-infinite-loaded', 'true')
		clonedPost.setAttribute('data-mv-page', String(pageNum))
		clonedPost.style.contentVisibility = 'auto'
		clonedPost.style.containIntrinsicSize = 'auto 300px'
		pageBlockContainer.appendChild(clonedPost)
	})

	// Create PageBlock entry
	const pageBlock: PageBlock = {
		page: pageNum,
		isLoaded: true,
		container: pageBlockContainer,
		cachedHeight: 0,
		cachedHTML: null,
		dividerContainer,
		dividerFeatureId: dividerId,
	}
	pageBlocks.set(pageNum, pageBlock)

	// Dispatch event for other features
	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.CONTENT_INJECTED, {
			detail: { page: pageNum, postCount: posts.length },
		})
	)

	scheduleWindowManagement()
}

// =============================================================================
// SLIDING WINDOW MANAGEMENT
// =============================================================================

function scheduleWindowManagement(): void {
	if (windowManagementTimeout) {
		clearTimeout(windowManagementTimeout)
	}
	windowManagementTimeout = setTimeout(() => {
		managePageWindow()
	}, WINDOW_MANAGEMENT_DEBOUNCE)
}

function managePageWindow(): void {
	if (pageBlocks.size < MIN_PAGES_BEFORE_UNLOAD) {
		return
	}

	const windowStart = Math.max(startPage, visiblePage - PAGES_BEFORE)
	const windowEnd = Math.min(startPage + loadedPagesCount - 1, visiblePage + PAGES_AFTER)

	logger.debug(`Window management: visible=${visiblePage}, window=[${windowStart}-${windowEnd}]`)

	pageBlocks.forEach((block, pageNum) => {
		const shouldBeLoaded = pageNum >= windowStart && pageNum <= windowEnd

		if (shouldBeLoaded && !block.isLoaded) {
			reloadPage(block)
		} else if (!shouldBeLoaded && block.isLoaded) {
			unloadPage(block)
		}
	})

	updatePlaceholderObservers()
	updateDebugIndicators(getInfiniteScrollState())
}

function unloadPage(block: PageBlock): void {
	if (!block.isLoaded) return

	const container = block.container
	const rect = container.getBoundingClientRect()
	block.cachedHeight = rect.height
	block.cachedHTML = container.innerHTML

	if (block.dividerFeatureId && isFeatureMounted(block.dividerFeatureId)) {
		unmountFeature(block.dividerFeatureId)
	}

	container.innerHTML = ''
	container.className = PAGE_PLACEHOLDER_CLASS
	container.style.height = `${block.cachedHeight}px`
	container.style.contentVisibility = 'visible'
	container.style.containIntrinsicSize = ''
	container.setAttribute('data-placeholder', 'true')
	container.setAttribute('data-cached-height', String(block.cachedHeight))

	block.isLoaded = false
	pageMarkers = pageMarkers.filter(m => m.page !== block.page)

	logger.debug(`Unloaded page ${block.page}, height=${block.cachedHeight}px`)
}

function reloadPage(block: PageBlock): void {
	if (block.isLoaded) return
	if (!block.cachedHTML) {
		logger.warn(`Cannot reload page ${block.page}: no cached HTML`)
		return
	}

	const container = block.container

	container.innerHTML = block.cachedHTML
	container.className = PAGE_BLOCK_CLASS
	container.style.height = ''
	container.removeAttribute('data-placeholder')
	container.removeAttribute('data-cached-height')

	applyContentVisibilityOptimization(container)

	const dividerContainer = container.querySelector(`.${DIVIDER_CLASS}`) as HTMLElement
	if (dividerContainer) {
		const dividerId = dividerContainer.getAttribute('data-feature-id')
		if (dividerId) {
			mountFeature(
				dividerId,
				dividerContainer,
				<ShadowWrapper>
					<PageDivider pageNumber={block.page} />
				</ShadowWrapper>
			)
			block.dividerFeatureId = dividerId
		}
		block.dividerContainer = dividerContainer
		pageMarkers.push({ page: block.page, el: dividerContainer })
		pageMarkers.sort((a, b) => a.page - b.page)
	}

	block.isLoaded = true
	logger.debug(`Reloaded page ${block.page}`)

	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.CONTENT_INJECTED, {
			detail: { page: block.page, postCount: 0, isReload: true },
		})
	)
}

function updatePlaceholderObservers(): void {
	if (topObserver) {
		topObserver.disconnect()
	}

	topObserver = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const placeholder = entry.target as HTMLElement
					const pageNum = parseInt(placeholder.getAttribute('data-page') || '0', 10)
					const block = pageBlocks.get(pageNum)

					if (block && !block.isLoaded) {
						logger.debug(`Placeholder for page ${pageNum} entered viewport, reloading...`)
						reloadPage(block)
						scheduleWindowManagement()
					}
				}
			})
		},
		{ rootMargin: '200px 0px', threshold: 0 }
	)

	pageBlocks.forEach(block => {
		if (!block.isLoaded && block.container) {
			topObserver?.observe(block.container)
		}
	})
}

// =============================================================================
// SCROLL TRACKING
// =============================================================================

function handleScroll(): void {
	if (scrollTimeout) {
		clearTimeout(scrollTimeout)
	}

	scrollTimeout = setTimeout(() => {
		const viewportMiddle = window.innerHeight / 2
		let currentVisiblePage = startPage

		if (pageMarkers.length > 0) {
			for (const marker of pageMarkers) {
				const rect = marker.el.getBoundingClientRect()
				if (rect.top <= viewportMiddle) {
					currentVisiblePage = marker.page
				} else {
					break
				}
			}
		}

		pageBlocks.forEach((block, pageNum) => {
			if (!block.isLoaded) {
				const rect = block.container.getBoundingClientRect()
				if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
					currentVisiblePage = pageNum
				}
			}
		})

		if (currentVisiblePage !== visiblePage) {
			visiblePage = currentVisiblePage
			updateIndicator()
			updateButton()
			scheduleWindowManagement()
		}
	}, DEBOUNCE.SCROLL)
}

function setupScrollTracking(): void {
	window.addEventListener('scroll', handleScroll, { passive: true })
}

// =============================================================================
// BOTTOM DETECTION & PAGE LOADING
// =============================================================================

function createObserver(): void {
	if (observer) {
		observer.disconnect()
	}

	let sentinel = document.getElementById(SENTINEL_ID)
	if (!sentinel) {
		sentinel = document.createElement('div')
		sentinel.id = SENTINEL_ID
		sentinel.style.height = '1px'
		sentinel.style.width = '100%'

		const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
		if (postsWrap) {
			postsWrap.appendChild(sentinel)
		} else {
			return
		}
	}

	observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting && !isLoading) {
					const nextPage = startPage + loadedPagesCount
					if (nextPage <= totalPages) {
						void loadNextPage()
					}
				}
			})
		},
		{ rootMargin: INTERSECTION.INFINITE_SCROLL_MARGIN, threshold: 0 }
	)

	observer.observe(sentinel)
}

async function loadNextPage(): Promise<void> {
	const nextPage = startPage + loadedPagesCount
	if (isLoading || nextPage > totalPages) return

	isLoading = true
	updateIndicator()

	try {
		const doc = await fetchPage(nextPage)
		if (!doc) {
			throw new Error('Failed to fetch page')
		}

		const posts = extractPosts(doc)
		if (posts.length === 0) {
			logger.warn('No posts found on page ' + nextPage)
		} else {
			await injectPosts(posts, nextPage)
			loadedPagesCount++

			const sentinel = document.getElementById(DOM_MARKERS.IDS.INFINITE_SENTINEL)
			const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
			if (sentinel && postsWrap) {
				postsWrap.appendChild(sentinel)
			}
		}
	} catch (error) {
		logger.error('Error loading page:', error)
	} finally {
		isLoading = false
		updateIndicator()
	}
}

// =============================================================================
// UI: PAGE INDICATOR
// =============================================================================

async function createIndicator(): Promise<void> {
	if (isFeatureMounted(INDICATOR_FEATURE_ID)) return

	const sideNav = document.getElementById(MV_SELECTORS.GLOBAL.SIDE_NAV_ID)
	if (!sideNav) {
		logger.warn('#side-nav not found, indicator not created')
		return
	}

	if (document.getElementById(INDICATOR_CONTAINER_ID)) {
		return
	}

	const galleryTrigger = document.getElementById(DOM_MARKERS.IDS.GALLERY_TRIGGER)
	const sidePages = sideNav.querySelector(MV_SELECTORS.THREAD.PAGINATION_SIDE)

	const container = document.createElement('div')
	container.id = INDICATOR_CONTAINER_ID
	container.style.cssText = `
		position: relative;
		margin-top: 48px;
		width: 100%;
		display: flex;
		justify-content: center;
		margin-left: -12px;
	`

	if (galleryTrigger) {
		galleryTrigger.insertAdjacentElement('afterend', container)
	} else if (sidePages) {
		sidePages.insertAdjacentElement('afterend', container)
	} else {
		sideNav.appendChild(container)
	}

	mountFeature(INDICATOR_FEATURE_ID, container, getIndicatorElement())
}

function getIndicatorElement() {
	const maxLoadedPage = startPage + loadedPagesCount - 1
	return (
		<ShadowWrapper>
			<PageIndicator
				currentPage={visiblePage}
				totalPages={totalPages}
				maxLoadedPage={maxLoadedPage}
				isLoading={isLoading}
			/>
		</ShadowWrapper>
	)
}

function updateIndicator(): void {
	if (!isFeatureMounted(INDICATOR_FEATURE_ID)) return
	updateFeature(INDICATOR_FEATURE_ID, getIndicatorElement())
}

// =============================================================================
// UI: TOGGLE BUTTON
// =============================================================================

function getButtonElement() {
	return (
		<ShadowWrapper>
			<InfiniteScrollButton
				isActive={isScrollActive}
				isDisabled={isLiveModeActive}
				onActivate={startInfiniteScroll}
				onDeactivate={stopInfiniteScroll}
				currentPage={visiblePage}
				totalPages={totalPages}
			/>
		</ShadowWrapper>
	)
}

function updateButton(): void {
	if (!isFeatureMounted(BUTTON_FEATURE_ID)) return
	updateFeature(BUTTON_FEATURE_ID, getButtonElement())
}

// =============================================================================
// VISIBILITY HELPERS
// =============================================================================

function hideSidePages(): void {
	const sidePages = document.querySelector(`ul${MV_SELECTORS.THREAD.PAGINATION_SIDE}`) as HTMLElement | null
	if (sidePages) {
		sidePages.style.display = 'none'
	}
}

function showSidePages(): void {
	const sidePages = document.querySelector(`ul${MV_SELECTORS.THREAD.PAGINATION_SIDE}`) as HTMLElement | null
	if (sidePages) {
		sidePages.style.display = ''
	}
}

// =============================================================================
// START / STOP INFINITE SCROLL
// =============================================================================

function startInfiniteScroll(): void {
	if (isScrollActive) return

	logger.debug('InfiniteScroll: starting from page', startPage)
	isScrollActive = true

	window.dispatchEvent(
		new CustomEvent(DOM_MARKERS.EVENTS.INFINITE_SCROLL_MODE_CHANGED, {
			detail: { active: true },
		})
	)

	hideSidePages()

	const initialPosts = document.querySelectorAll<HTMLElement>(MV_SELECTORS.THREAD.POSTS_IN_CONTAINER)
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)

	if (postsWrap && initialPosts.length > 0) {
		const initialPageBlock = document.createElement('div')
		initialPageBlock.className = PAGE_BLOCK_CLASS
		initialPageBlock.setAttribute('data-page', String(startPage))
		applyContentVisibilityOptimization(initialPageBlock)

		postsWrap.insertBefore(initialPageBlock, postsWrap.firstChild)

		initialPosts.forEach(post => {
			post.setAttribute('data-mv-page', String(startPage))
			initialPageBlock.appendChild(post)
		})

		pageMarkers.push({ page: startPage, el: initialPageBlock })

		const block: PageBlock = {
			page: startPage,
			isLoaded: true,
			container: initialPageBlock,
			cachedHeight: 0,
			cachedHTML: null,
			dividerContainer: null,
			dividerFeatureId: null,
		}
		pageBlocks.set(startPage, block)
	}

	createIndicator()
	createObserver()
	setupScrollTracking()

	registerDebugGlobals(getInfiniteScrollState)
	toggleInfiniteScrollDebug(true)

	updateButton()
}

function stopInfiniteScroll(): void {
	if (!isScrollActive) return

	logger.debug('InfiniteScroll: stopping, going to page', visiblePage)

	const baseUrl = getBaseUrl()
	const targetUrl = visiblePage === 1 ? baseUrl : `${baseUrl}/${visiblePage}`

	window.location.href = targetUrl
}

// =============================================================================
// CLEANUP
// =============================================================================

export function cleanupInfiniteScroll(): void {
	isScrollActive = false

	if (observer) {
		observer.disconnect()
		observer = null
	}

	if (topObserver) {
		topObserver.disconnect()
		topObserver = null
	}

	if (scrollTimeout) {
		clearTimeout(scrollTimeout)
		scrollTimeout = null
	}

	if (windowManagementTimeout) {
		clearTimeout(windowManagementTimeout)
		windowManagementTimeout = null
	}

	window.removeEventListener('scroll', handleScroll)

	document.getElementById(SENTINEL_ID)?.remove()

	if (isFeatureMounted(INDICATOR_FEATURE_ID)) {
		unmountFeature(INDICATOR_FEATURE_ID)
	}
	document.getElementById(INDICATOR_CONTAINER_ID)?.remove()

	if (isFeatureMounted(BUTTON_FEATURE_ID)) {
		unmountFeature(BUTTON_FEATURE_ID)
	}
	document.getElementById(BUTTON_CONTAINER_ID)?.remove()

	pageBlocks.forEach(block => {
		if (block.dividerFeatureId && isFeatureMounted(block.dividerFeatureId)) {
			unmountFeature(block.dividerFeatureId)
		}
	})
	pageBlocks.clear()

	const pageBlockNodes = document.querySelectorAll<HTMLElement>(`.${PAGE_BLOCK_CLASS}, .${PAGE_PLACEHOLDER_CLASS}`)
	pageBlockNodes.forEach(node => node.remove())

	const dividerNodes = document.querySelectorAll<HTMLElement>(`.${DIVIDER_CLASS}`)
	dividerNodes.forEach(node => {
		const featureId = node.getAttribute('data-feature-id')
		if (featureId) {
			unmountFeature(featureId)
		}
		node.remove()
	})

	pageMarkers = []
	dividerCounter = 0
	visiblePage = startPage
	isLoading = false

	showSidePages()
}

// =============================================================================
// INJECTION (Entry Point)
// =============================================================================

export async function injectInfiniteScroll(_ctx?: unknown): Promise<void> {
	if (!isThreadPage()) return
	if (isFeatureMounted(BUTTON_FEATURE_ID)) return

	logger.debug('InfiniteScroll: injecting button')

	const settings = await getSettings()
	if (settings.infiniteScrollEnabled !== true) {
		return
	}

	totalPages = detectTotalPages()
	startPage = getCurrentPageNumber()
	visiblePage = startPage
	loadedPagesCount = 1

	pageMarkers = []
	pageBlocks.clear()

	if (totalPages <= 1) return
	if (startPage >= totalPages) return

	const threadCompanion = document.getElementById(MV_SELECTORS.GLOBAL.THREAD_COMPANION_ID)
	if (!threadCompanion) {
		logger.warn('thread-companion not found')
		return
	}

	const moreActions = threadCompanion.querySelector(MV_SELECTORS.GLOBAL.MORE_ACTIONS)
	if (!moreActions) {
		logger.warn('more-actions not found in thread-companion')
		return
	}

	const EXTRA_ROW_ID = DOM_MARKERS.IDS.EXTRA_ACTIONS
	let extraActions = threadCompanion.querySelector(`#${EXTRA_ROW_ID}`)
	if (!extraActions) {
		extraActions = document.createElement('div')
		extraActions.id = EXTRA_ROW_ID
		;(extraActions as HTMLElement).style.cssText =
			'margin-top: 10px; display: inline-flex; gap: 6px; clear: both; align-items: center;'
		moreActions.insertAdjacentElement('afterend', extraActions)
	}

	let container = document.getElementById(BUTTON_CONTAINER_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = BUTTON_CONTAINER_ID
		container.style.display = 'inline-flex'
		const liveButtonContainer = document.getElementById(DOM_MARKERS.IDS.LIVE_BUTTON_CONTAINER)
		if (liveButtonContainer) {
			liveButtonContainer.insertAdjacentElement('afterend', container)
		} else {
			extraActions.insertAdjacentElement('afterbegin', container)
		}
	}

	setupModeExclusionListeners()
	mountFeature(BUTTON_FEATURE_ID, container, getButtonElement())
}

// =============================================================================
// MODE EXCLUSION
// =============================================================================

function setupModeExclusionListeners(): void {
	window.addEventListener(DOM_MARKERS.EVENTS.LIVE_MODE_CHANGED, ((event: CustomEvent<{ active: boolean }>) => {
		isLiveModeActive = event.detail.active
		updateButton()
	}) as EventListener)
}
