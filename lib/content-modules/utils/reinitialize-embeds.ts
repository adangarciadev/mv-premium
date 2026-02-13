/**
 * Embed Reinitialization Utility
 *
 * Handles reinitialization of third-party embeds (Twitter/X, Instagram, TikTok, etc.)
 * when content is dynamically loaded into the page via infinite scroll or live thread.
 *
 * Problem: Mediavida uses s9e TextFormatter for embeds, which relies on:
 * 1. An `onload` handler that creates a MessageChannel
 * 2. Sends 's9e:init' to the iframe via postMessage
 * 3. The iframe responds with its height through the MessageChannel
 *
 * When posts are cloned with cloneNode() or fetched and inserted:
 * - The onload handler doesn't execute (iframe is already "loaded")
 * - The MessageChannel is never created
 * - The iframe can't communicate its correct height
 *
 * Solution: Manually reinitialize the MessageChannel communication for each embed.
 *
 * @see https://github.com/s9e/TextFormatter - s9e TextFormatter library
 */

import { logger } from '@/lib/logger'

// Data attribute used to mark embeds that have been processed by our extension
const EMBED_INIT_ATTR = 'data-mvp-embed-init'
const REDDIT_HEIGHT_SYNC_ATTR = 'data-mvp-reddit-height-sync'

// Default heights for different embed types (fallback when MessageChannel fails)
const DEFAULT_EMBED_HEIGHTS: Record<string, number> = {
	twitter: 600,
	reddit: 900,
	instagram: 800,
	tiktok: 750,
	facebook: 500,
	bluesky: 400,
	default: 500,
}

// Timeout for waiting for iframe height response (ms)
const HEIGHT_RESPONSE_TIMEOUT = 5000
const MIN_VALID_EMBED_HEIGHT = 200
const REDDIT_SYNC_INTERVAL = 180
const REDDIT_SYNC_ATTEMPTS = 60
const REDDIT_PROVISIONAL_HEIGHT = 700
const REDDIT_STABLE_TICKS_REQUIRED = 3
const REDDIT_CONTROLLED_SHRINK_THRESHOLD = 80

/**
 * Twitter widgets API type declaration
 */
declare global {
	interface Window {
		twttr?: {
			widgets: {
				load: (element?: HTMLElement) => Promise<void>
			}
			ready: (callback: () => void) => void
		}
	}
}

/**
 * Reinitializes embed iframes within a container element.
 * Should be called after dynamically inserting content that may contain embeds.
 *
 * This function:
 * 1. Finds all s9e media embeds in the container
 * 2. For each embed, reinitializes the MessageChannel communication
 * 3. Falls back to default heights if the iframe doesn't respond
 *
 * @param container - The container element to search for embeds. Defaults to document.
 * @param options - Configuration options
 * @param options.forceReloadTwitter - If true, reload ALL Twitter embeds regardless of state.
 *   Use true for content loaded via fetch/DOMParser (cloned content won't have loaded).
 *   Use false for content already rendered by the browser (only reload broken embeds).
 *   Defaults to true.
 */
export function reinitializeEmbeds(
	container: HTMLElement | Document = document,
	options: { forceReloadTwitter?: boolean } = {}
): void {
	const { forceReloadTwitter = true } = options
	const embedContainers = container.querySelectorAll('[data-s9e-mediaembed]')

	if (embedContainers.length === 0) return

	logger.debug(`Reinitializing ${embedContainers.length} embeds`)

	// Count Twitter embeds that need reloading to stagger them
	let twitterIndex = 0

	embedContainers.forEach(embedContainer => {
		const element = embedContainer as HTMLElement
		const embedType = element.getAttribute('data-s9e-mediaembed')
		const iframe = element.querySelector('iframe') as HTMLIFrameElement
		const isRedditEmbed = embedType === 'reddit' && !!iframe

		// Twitter embeds need special handling
		if (embedType === 'twitter' && iframe && !iframe.hasAttribute(EMBED_INIT_ATTR)) {
			const currentHeight = parseInt(iframe.style.height || '0', 10)

			// Determine if this embed needs reloading:
			// - If forceReloadTwitter is true (cloned content), reload ALL embeds
			// - If forceReloadTwitter is false (browser-rendered), only reload broken ones (height < 200)
			const needsReload = forceReloadTwitter || currentHeight < 200

			if (needsReload) {
				// Pass the stagger delay (200ms between each Twitter embed)
				reinitializeEmbed(element, twitterIndex * 200, forceReloadTwitter)
				twitterIndex++
			} else {
				// Mark as initialized - it's already working
				iframe.setAttribute(EMBED_INIT_ATTR, 'true')
				logger.debug(`Twitter embed already loaded (height=${currentHeight}px), skipping`)
			}
			return
		}

		reinitializeEmbed(element, 0, forceReloadTwitter)

		if (isRedditEmbed && iframe) {
			// Run sync after initial reinit/fallback so we don't override immediate fallback height
			// in environments like jsdom where contentWindow/message channel is unavailable.
			scheduleRedditHeightSync(iframe)
		}
	})
}

/**
 * Reinitializes a single embed by recreating the MessageChannel communication.
 *
 * This replicates the s9e onload behavior:
 * ```javascript
 * onload="let c=new MessageChannel;c.port1.onmessage=e=>this.style.height=e.data+'px';this.contentWindow.postMessage('s9e:init','*',[c.port2])"
 * ```
 *
 * @param embedContainer - The embed container element
 * @param staggerDelay - Delay in ms for staggered loading (prevents overload with many embeds)
 */
function reinitializeEmbed(embedContainer: HTMLElement, staggerDelay = 0, _forceReload = true): void {
	const iframe = embedContainer.querySelector('iframe') as HTMLIFrameElement
	if (!iframe) return

	// Skip if already initialized by us
	if (iframe.hasAttribute(EMBED_INIT_ATTR)) {
		return
	}

	const embedType = embedContainer.getAttribute('data-s9e-mediaembed') || 'unknown'
	const currentHeight = parseInt(iframe.style.height || '0', 10)

	// Twitter embeds use their own system, not s9e MessageChannel
	// Force reload is handled by the caller based on forceReloadTwitter option
	if (embedType === 'twitter') {
		// Mark as being processed
		iframe.setAttribute(EMBED_INIT_ATTR, 'pending')

		// Try Twitter widgets API first (most reliable if available)
		if (window.twttr?.widgets?.load) {
			tryTwitterWidgetsAPI(embedContainer, iframe, embedType)
		} else {
			// Force reload the iframe - Twitter will re-render on load
			forceReloadIframe(iframe, embedType, staggerDelay)
		}
		return
	}

	// For non-Twitter embeds: Check if iframe already has a valid height (properly rendered)
	// If so, just mark it as initialized and skip
	if (currentHeight >= MIN_VALID_EMBED_HEIGHT) {
		iframe.setAttribute(EMBED_INIT_ATTR, 'true')
		// Also ensure no scrollbars on existing embeds
		iframe.setAttribute('scrolling', 'no')
		iframe.style.overflow = 'hidden'
		logger.debug(`${embedType} embed already has valid height ${currentHeight}px, skipping`)
		return
	}

	// Reddit embeds in live/infinite contexts are unstable with repeated s9e:init handshakes.
	// Use fallback + sync loop only (triggered by caller) to avoid visible disappear/reappear flicker.
	if (embedType === 'reddit') {
		applyFallbackHeight(iframe, embedType)
		return
	}

	// Mark as being processed
	iframe.setAttribute(EMBED_INIT_ATTR, 'pending')

	// For other embeds (Instagram, TikTok, etc.): try s9e MessageChannel approach
	initializeS9eMessageChannel(iframe, embedType)
}

/**
 * Tries to use Twitter's widgets API if available.
 */
function tryTwitterWidgetsAPI(embedContainer: HTMLElement, iframe: HTMLIFrameElement, embedType: string): void {
	try {
		// Twitter widgets.load() will re-render the tweet
		window.twttr!.widgets.load(embedContainer).then(() => {
			iframe.setAttribute(EMBED_INIT_ATTR, 'twitter-api')
			logger.debug(`Twitter embed initialized via widgets API`)
		}).catch(() => {
			// Fallback to MessageChannel approach
			initializeS9eMessageChannel(iframe, embedType)
		})
	} catch {
		initializeS9eMessageChannel(iframe, embedType)
	}
}

/**
 * Initializes the s9e MessageChannel communication with an iframe.
 *
 * The s9e embed system works like this:
 * 1. Parent creates a MessageChannel with two ports
 * 2. Parent sends 's9e:init' message to iframe with port2 as transferable
 * 3. Iframe receives port2 and uses it to send its height back
 * 4. Parent receives height on port1 and updates iframe style
 */
function initializeS9eMessageChannel(iframe: HTMLIFrameElement, embedType: string): void {
	// Check if iframe has a contentWindow we can message
	if (!iframe.contentWindow) {
		logger.debug(`Iframe has no contentWindow, applying fallback height for ${embedType}`)
		applyFallbackHeight(iframe, embedType)
		return
	}

	try {
		// Create a new MessageChannel (same as s9e onload)
		const channel = new MessageChannel()

		// Track if we received a response
		let receivedResponse = false

		// Listen for height updates from the iframe
		channel.port1.onmessage = (event: MessageEvent) => {
			receivedResponse = true
			const height = parseInt(event.data, 10)

			if (!isNaN(height) && height > 0) {
				iframe.style.height = `${height}px`
				iframe.setAttribute(EMBED_INIT_ATTR, 'true')
				logger.debug(`${embedType} embed height set to ${height}px via MessageChannel`)
			}
		}

		// Send the s9e:init message to the iframe with port2
		iframe.contentWindow.postMessage('s9e:init', '*', [channel.port2])

		// Set a timeout to apply fallback if no response
		setTimeout(() => {
			if (!receivedResponse) {
				const currentHeight = parseInt(iframe.style.height || '0', 10)
				if (!Number.isNaN(currentHeight) && currentHeight >= MIN_VALID_EMBED_HEIGHT) {
					// Height is already valid (e.g. reddit measured/provisional sync), avoid disruptive reload.
					iframe.setAttribute(EMBED_INIT_ATTR, embedType === 'reddit' ? 'reddit-measured' : 'true')
					return
				}

				// Reddit embeds are especially sensitive to forced reload (visible disappear/reappear).
				// Prefer fallback+sync path without resetting src.
				if (embedType === 'reddit') {
					logger.debug('No MessageChannel response for reddit, applying fallback without reload')
					applyFallbackHeight(iframe, embedType)
					return
				}

				logger.debug(`No MessageChannel response for ${embedType}, trying iframe reload`)
				// Try reloading the iframe as a last resort
				reloadIframe(iframe, embedType)
			}
		}, HEIGHT_RESPONSE_TIMEOUT)

	} catch (error) {
		logger.debug(`MessageChannel failed for ${embedType}:`, error)
		applyFallbackHeight(iframe, embedType)
	}
}

/**
 * Forces an immediate reload of an iframe by resetting its src.
 * Used for Twitter embeds which handle their own height communication.
 */
function forceReloadIframe(iframe: HTMLIFrameElement, embedType: string, delay = 0): void {
	const currentSrc = iframe.src

	if (!currentSrc) {
		applyFallbackHeight(iframe, embedType)
		return
	}

	iframe.setAttribute(EMBED_INIT_ATTR, 'reloading')

	// Ensure no scrollbars appear
	iframe.setAttribute('scrolling', 'no')
	iframe.style.overflow = 'hidden'

	// Set up onload to mark as complete and fix any remaining issues
	iframe.onload = () => {
		iframe.setAttribute(EMBED_INIT_ATTR, 'true')
		// Re-ensure no scrollbars after load
		iframe.setAttribute('scrolling', 'no')
		iframe.style.overflow = 'hidden'
		logger.debug(`${embedType} embed reloaded successfully`)
	}

	// Use delay for staggered loading (prevents overloading when many embeds)
	setTimeout(() => {
		// Force reload by briefly clearing src
		iframe.src = ''
		// Use setTimeout to ensure the browser processes the removal
		setTimeout(() => {
			iframe.src = currentSrc
		}, 50)
	}, delay)

	logger.debug(`Force reloading ${embedType} embed iframe (delay: ${delay}ms)`)
}

/**
 * Reloads an iframe by resetting its src attribute.
 * This forces the iframe to reload and execute its onload handler.
 */
function reloadIframe(iframe: HTMLIFrameElement, embedType: string): void {
	const currentSrc = iframe.src

	if (!currentSrc || iframe.getAttribute(EMBED_INIT_ATTR) === 'reloaded') {
		// Already tried reloading or no src, apply fallback
		applyFallbackHeight(iframe, embedType)
		return
	}

	iframe.setAttribute(EMBED_INIT_ATTR, 'reloaded')

	// Store the original onload if any
	const originalOnload = iframe.onload

	// Set up a new onload handler to reinitialize MessageChannel
	iframe.onload = () => {
		// Call original onload if exists
		if (originalOnload) {
			originalOnload.call(iframe, new Event('load'))
		}

		// Try MessageChannel again after reload
		setTimeout(() => {
			if (iframe.getAttribute(EMBED_INIT_ATTR) === 'reloaded') {
				// Still not initialized, apply fallback
				applyFallbackHeight(iframe, embedType)
			}
		}, 2000)

		// Try s9e init again
		initializeS9eMessageChannelAfterReload(iframe, embedType)
	}

	// Force reload by resetting src
	iframe.src = ''
	requestAnimationFrame(() => {
		iframe.src = currentSrc
	})

	logger.debug(`Reloading ${embedType} embed iframe`)
}

/**
 * Simplified MessageChannel init for after reload (no recursion)
 */
function initializeS9eMessageChannelAfterReload(iframe: HTMLIFrameElement, embedType: string): void {
	if (!iframe.contentWindow) return

	try {
		const channel = new MessageChannel()

		channel.port1.onmessage = (event: MessageEvent) => {
			const height = parseInt(event.data, 10)
			if (!isNaN(height) && height > 0) {
				iframe.style.height = `${height}px`
				iframe.setAttribute(EMBED_INIT_ATTR, 'true')
				logger.debug(`${embedType} embed height set to ${height}px after reload`)
			}
		}

		iframe.contentWindow.postMessage('s9e:init', '*', [channel.port2])
	} catch {
		applyFallbackHeight(iframe, embedType)
	}
}

/**
 * Applies a fallback height to an iframe when MessageChannel communication fails.
 */
function applyFallbackHeight(iframe: HTMLIFrameElement, embedType: string): void {
	// Don't override if already has a reasonable height
	const currentHeight = parseInt(iframe.style.height || '0', 10)
	if (currentHeight >= MIN_VALID_EMBED_HEIGHT) {
		iframe.setAttribute(EMBED_INIT_ATTR, 'true')
		return
	}

	// Reddit embeds are wrapped in a same-origin MV iframe that contains another iframe
	// with its own explicit height. Prefer that measured value over static fallback.
	if (embedType === 'reddit') {
		const measuredHeight = getMeasuredRedditHeight(iframe)
		if (measuredHeight) {
			iframe.style.height = `${measuredHeight}px`
			iframe.setAttribute('scrolling', 'no')
			iframe.style.overflow = 'hidden'
			iframe.setAttribute(EMBED_INIT_ATTR, 'reddit-measured')
			logger.debug(`Applied measured reddit height ${measuredHeight}px`)
			return
		}
	}

	const fallbackHeight = DEFAULT_EMBED_HEIGHTS[embedType] || DEFAULT_EMBED_HEIGHTS.default

	iframe.style.height = `${fallbackHeight}px`
	iframe.setAttribute('scrolling', 'no')
	iframe.style.overflow = 'hidden'
	iframe.setAttribute(EMBED_INIT_ATTR, 'fallback')

	logger.debug(`Applied fallback height ${fallbackHeight}px to ${embedType} embed`)
}

/**
 * Starts a short-lived sync loop for Reddit embeds.
 * This avoids waiting seconds with a clipped embed/scrollbar before final height settles.
 */
function scheduleRedditHeightSync(iframe: HTMLIFrameElement): void {
	const syncState = iframe.getAttribute(REDDIT_HEIGHT_SYNC_ATTR)
	if (syncState === 'running' || syncState === 'done') return
	iframe.setAttribute(REDDIT_HEIGHT_SYNC_ATTR, 'running')
	const startedFromFallback = iframe.getAttribute(EMBED_INIT_ATTR) === 'fallback'

	const initialHeight = parseInt(iframe.style.height || iframe.getAttribute('height') || '0', 10)
	if (initialHeight > 0 && initialHeight < 300) {
		iframe.style.height = `${REDDIT_PROVISIONAL_HEIGHT}px`
		iframe.setAttribute('scrolling', 'no')
		iframe.style.overflow = 'hidden'
	}

	let attempts = 0
	let timer: ReturnType<typeof setInterval> | null = null
	let bestMeasuredHeight = startedFromFallback ? 0 : initialHeight
	let lastMeasuredHeight: number | null = null
	let stableTicks = 0
	let previewShrinkApplied = false

	const finish = (state: 'done' | 'timeout' | 'detached') => {
		if (timer) {
			clearInterval(timer)
			timer = null
		}
		iframe.setAttribute(REDDIT_HEIGHT_SYNC_ATTR, state)
	}

	const tick = () => {
		if (!document.contains(iframe)) {
			finish('detached')
			return
		}

		attempts++
		const measuredHeight = getMeasuredRedditHeight(iframe)

		if (measuredHeight) {
			const previousHeight = parseInt(iframe.style.height || iframe.getAttribute('height') || '0', 10)
			bestMeasuredHeight = Math.max(bestMeasuredHeight, measuredHeight)
			const targetHeight = Math.max(previousHeight, bestMeasuredHeight)

			if (!Number.isNaN(previousHeight) && targetHeight - previousHeight > 8) {
				iframe.style.height = `${targetHeight}px`
				iframe.setAttribute('scrolling', 'no')
				iframe.style.overflow = 'hidden'
				iframe.setAttribute(EMBED_INIT_ATTR, 'reddit-measured')
				logger.debug(`Synced reddit height to ${targetHeight}px (attempt ${attempts})`)
			}

			// Reduce visible fallback whitespace as soon as we have a first usable measurement,
			// but keep a safe lower bound to avoid collapsing on transient early values.
			if (startedFromFallback && !previewShrinkApplied) {
				const currentHeight = parseInt(iframe.style.height || iframe.getAttribute('height') || '0', 10)
				const previewHeight = Math.max(bestMeasuredHeight, REDDIT_PROVISIONAL_HEIGHT)
				const shouldPreviewShrink = Number.isFinite(currentHeight)
					&& currentHeight - previewHeight >= REDDIT_CONTROLLED_SHRINK_THRESHOLD

				if (previewHeight >= MIN_VALID_EMBED_HEIGHT && shouldPreviewShrink) {
					iframe.style.height = `${previewHeight}px`
					iframe.setAttribute('scrolling', 'no')
					iframe.style.overflow = 'hidden'
					iframe.setAttribute(EMBED_INIT_ATTR, 'reddit-measured')
					logger.debug(`Preview reddit shrink to ${previewHeight}px (attempt ${attempts})`)
					previewShrinkApplied = true
				}
			}

			if (lastMeasuredHeight !== null && Math.abs(lastMeasuredHeight - measuredHeight) <= 8) {
				stableTicks++
			} else {
				stableTicks = 0
			}
			lastMeasuredHeight = measuredHeight

			if (startedFromFallback && stableTicks >= REDDIT_STABLE_TICKS_REQUIRED) {
				const currentHeight = parseInt(iframe.style.height || iframe.getAttribute('height') || '0', 10)
				const shouldShrink = Number.isFinite(currentHeight)
					&& currentHeight - bestMeasuredHeight >= REDDIT_CONTROLLED_SHRINK_THRESHOLD

				if (bestMeasuredHeight >= MIN_VALID_EMBED_HEIGHT && shouldShrink) {
					iframe.style.height = `${bestMeasuredHeight}px`
					iframe.setAttribute('scrolling', 'no')
					iframe.style.overflow = 'hidden'
					iframe.setAttribute(EMBED_INIT_ATTR, 'reddit-measured')
					logger.debug(`Controlled reddit shrink to ${bestMeasuredHeight}px (attempt ${attempts})`)
				}

				finish('done')
				return
			}

			// Finish only after measurements stabilize for several ticks.
			if (stableTicks >= REDDIT_STABLE_TICKS_REQUIRED) {
				finish('done')
				return
			}
		}

		if (attempts >= REDDIT_SYNC_ATTEMPTS) {
			finish('timeout')
		}
	}

	timer = setInterval(tick, REDDIT_SYNC_INTERVAL)
	tick()
}

/**
 * Attempts to measure the real reddit embed height from the inner iframe.
 * Returns null when it cannot be determined safely.
 */
function getMeasuredRedditHeight(iframe: HTMLIFrameElement): number | null {
	try {
		const doc = iframe.contentDocument
		if (!doc) return null

		const innerIframe = doc.querySelector('iframe') as HTMLIFrameElement | null
		if (!innerIframe) return null

		const fromAttr = parseInt(innerIframe.getAttribute('height') || '0', 10)
		const fromStyle = parseInt(innerIframe.style.height || '0', 10)
		const fromClient = innerIframe.clientHeight
		const fromDoc = doc.body?.scrollHeight || 0

		const candidates = [fromAttr, fromStyle, fromClient, fromDoc].filter(h => Number.isFinite(h) && h >= 200 && h <= 3000)
		if (candidates.length === 0) return null

		return Math.max(...candidates)
	} catch {
		return null
	}
}

/**
 * Forces reinitialization of all embeds in a container, ignoring the init flag.
 * Use this when embeds are still not working after the initial reinitialize.
 */
export function forceReinitializeEmbeds(container: HTMLElement | Document = document): void {
	const embedContainers = container.querySelectorAll('[data-s9e-mediaembed]')

	embedContainers.forEach(embedContainer => {
		const iframe = embedContainer.querySelector('iframe') as HTMLIFrameElement
		if (iframe) {
			// Remove our init flag to force reprocessing
			iframe.removeAttribute(EMBED_INIT_ATTR)
		}
	})

	// Now reinitialize
	reinitializeEmbeds(container)
}

/**
 * Sets up a global listener for embed height messages.
 * Some embeds (like Twitter) send postMessages to the parent window.
 * This listener catches those and updates the iframe heights.
 */
export function setupGlobalEmbedListener(): void {
	// Only set up once
	if ((window as any).__mvpEmbedListenerActive) return
	(window as any).__mvpEmbedListenerActive = true

	window.addEventListener('message', (event: MessageEvent) => {
		// Twitter sends messages with specific structure
		if (event.data && typeof event.data === 'object') {
			// Twitter embed resize messages
			if (event.data['twttr.embed']) {
				handleTwitterMessage(event)
			}
		}
	})

	logger.debug('Global embed listener set up')
}

/**
 * Handles Twitter-specific postMessage for height updates.
 */
function handleTwitterMessage(event: MessageEvent): void {
	try {
		const data = event.data['twttr.embed']
		if (data?.method === 'twttr.private.resize' && data.params) {
			const height = data.params[0]?.height
			if (height) {
				// Find the iframe that sent this message
				const iframes = document.querySelectorAll('[data-s9e-mediaembed="twitter"] iframe')
				iframes.forEach(iframe => {
					const iframeEl = iframe as HTMLIFrameElement
					if (iframeEl.contentWindow === event.source) {
						iframeEl.style.height = `${height}px`
						logger.debug(`Twitter embed resized to ${height}px via postMessage`)
					}
				})
			}
		}
	} catch {
		// Ignore parsing errors
	}
}
