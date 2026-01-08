/**
 * Delay Manager - Core Logic for Native Live Thread Delay
 *
 * Uses MutationObserver to detect new posts in native LIVE threads,
 * hides them temporarily, and reveals them after the configured delay.
 *
 * Memory footprint: Only stores references to DOM elements (not content).
 * Max queue: 100 posts - older posts are auto-revealed if exceeded.
 */

import { logger } from '@/lib/logger'

const MAX_QUEUE_SIZE = 100

interface PendingPost {
	element: HTMLElement
	revealAt: number
	timeoutId: ReturnType<typeof setTimeout>
}

type QueueChangeCallback = (count: number) => void

// =========================================================================
// STATE (module-scoped)
// =========================================================================
let currentDelay = 0
let observer: MutationObserver | null = null
let pendingPosts: Map<string, PendingPost> = new Map()
let onQueueChangeCallback: QueueChangeCallback | undefined
let postsContainer: HTMLElement | null = null
let isActive = false

// =========================================================================
// PRIVATE HELPERS
// =========================================================================

function notifyQueueChange(): void {
	if (onQueueChangeCallback) {
		onQueueChangeCallback(pendingPosts.size)
	}
}

function hidePost(post: HTMLElement): void {
	// Store original styles for restoration
	post.dataset.mvpOriginalStyle = post.getAttribute('style') || ''

	post.style.cssText = `
		opacity: 0 !important;
		max-height: 0 !important;
		overflow: hidden !important;
		margin: 0 !important;
		padding: 0 !important;
		border: none !important;
		transition: none !important;
		pointer-events: none !important;
	`
}

function scrollToPostIfNeeded(post: HTMLElement): void {
	const rect = post.getBoundingClientRect()
	const isNearBottom = rect.top < window.innerHeight + 200

	if (isNearBottom) {
		post.scrollIntoView({ behavior: 'smooth', block: 'end' })
	}
}

function revealPost(post: HTMLElement): void {
	// Restore original styles
	const originalStyle = post.dataset.mvpOriginalStyle
	if (originalStyle) {
		post.setAttribute('style', originalStyle)
	} else {
		post.removeAttribute('style')
	}
	delete post.dataset.mvpOriginalStyle

	// Add reveal animation
	post.classList.add('mvp-native-live-reveal')
	setTimeout(() => {
		post.classList.remove('mvp-native-live-reveal')
	}, 400)

	// Scroll into view if near bottom
	scrollToPostIfNeeded(post)
}

function revealOldestPost(): void {
	// Find and reveal the oldest post in queue
	let oldestId: string | null = null
	let oldestTime = Infinity

	for (const [postId, pending] of pendingPosts) {
		if (pending.revealAt < oldestTime) {
			oldestTime = pending.revealAt
			oldestId = postId
		}
	}

	if (oldestId) {
		const pending = pendingPosts.get(oldestId)
		if (pending) {
			clearTimeout(pending.timeoutId)
			revealPost(pending.element)
			pendingPosts.delete(oldestId)
			logger.debug(`[NativeLiveDelay] Queue limit reached, revealed oldest post: ${oldestId}`)
		}
	}
}

function handleNewPost(post: HTMLElement): void {
	// No delay configured = show immediately
	if (currentDelay === 0) {
		return
	}

	const postId = post.id || post.dataset.num || `post-${Date.now()}`

	// Already tracking this post
	if (pendingPosts.has(postId)) {
		return
	}

	// Check queue limit
	if (pendingPosts.size >= MAX_QUEUE_SIZE) {
		revealOldestPost()
	}

	// Hide the post
	hidePost(post)

	// Schedule reveal
	const revealAt = Date.now() + currentDelay
	const timeoutId = setTimeout(() => {
		revealPost(post)
		pendingPosts.delete(postId)
		notifyQueueChange()
	}, currentDelay)

	pendingPosts.set(postId, {
		element: post,
		revealAt,
		timeoutId,
	})

	notifyQueueChange()
	logger.debug(`[NativeLiveDelay] Post ${postId} hidden, will reveal in ${currentDelay}ms`)
}

// =========================================================================
// PUBLIC API
// =========================================================================

/**
 * Start observing #posts-wrap for new posts
 * @param delayMs - Initial delay in milliseconds
 */
export function start(delayMs: number): void {
	if (isActive) {
		logger.warn('[NativeLiveDelay] Already active, call stop() first')
		return
	}

	currentDelay = delayMs
	postsContainer = document.querySelector('#posts-wrap.live')

	if (!postsContainer) {
		logger.warn('[NativeLiveDelay] #posts-wrap.live not found')
		return
	}

	observer = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLElement && node.classList.contains('post')) {
					handleNewPost(node)
				}
			}
		}
	})

	observer.observe(postsContainer, {
		childList: true,
		subtree: false,
	})

	isActive = true
	logger.info(`[NativeLiveDelay] Started with ${delayMs}ms delay`)
}

/**
 * Update delay (applies only to NEW posts, doesn't affect pending ones)
 */
export function setDelay(delayMs: number): void {
	currentDelay = delayMs
	logger.info(`[NativeLiveDelay] Delay updated to ${delayMs}ms`)
}

/**
 * Stop observing and reveal all pending posts immediately
 */
export function stop(): void {
	if (observer) {
		observer.disconnect()
		observer = null
	}

	// Clear all pending timeouts and reveal posts
	for (const [, pending] of pendingPosts) {
		clearTimeout(pending.timeoutId)
		revealPost(pending.element)
	}
	pendingPosts.clear()
	notifyQueueChange()

	isActive = false
	logger.info('[NativeLiveDelay] Stopped')
}

/**
 * Get current queue size
 */
export function getQueueSize(): number {
	return pendingPosts.size
}

/**
 * Get current delay setting
 */
export function getCurrentDelay(): number {
	return currentDelay
}

/**
 * Check if manager is active
 */
export function getIsActive(): boolean {
	return isActive
}

/**
 * Register callback for queue size changes
 */
export function onQueueSizeChange(callback: QueueChangeCallback): void {
	onQueueChangeCallback = callback
}

// Convenience object for grouped imports
export const delayManager = {
	start,
	stop,
	setDelay,
	getQueueSize,
	getCurrentDelay,
	getIsActive,
	onQueueSizeChange,
}
