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
import { sendMessage } from '@/lib/messaging'
import { createTwitterLiteCard, injectTwitterLiteStyles } from '../twitter-lite/card-renderer'
import type { TwitterLiteCardData } from '../twitter-lite/types'
import { normalizeTweetUrl, TWITTER_LITE_ALLOW_PARAM, TWITTER_LITE_ALLOW_VALUE } from '../twitter-lite/utils'

// Data attribute used to mark embeds that have been processed by our extension
const EMBED_INIT_ATTR = 'data-mvp-embed-init'
const REDDIT_HEIGHT_SYNC_ATTR = 'data-mvp-reddit-height-sync'
const TWITTER_LITE_ATTR = 'data-mvp-twitter-lite'
const TWITTER_LITE_LOADING_ATTR = 'data-mvp-twitter-lite-loading'
const TWITTER_LITE_EXPANDED_ATTR = 'data-mvp-twitter-lite-expanded'
const TWITTER_LITE_HOST_ATTR = 'data-mvp-twitter-lite-host'

const TWITTER_STATUS_URL_REGEX = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)/i
const TWITTER_EMBED_CONTAINER_SELECTOR = `[data-s9e-mediaembed="twitter"], .embed.twitter, [${TWITTER_LITE_HOST_ATTR}="true"]`
const TWITTER_EMBED_IFRAME_SELECTOR = 'iframe[src*="platform.twitter.com"], iframe[src*="twitter.com"], iframe[src*="x.com"]'

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
const TWITTER_LITE_MEDIA_INITIAL_HEIGHT = 980
const TWITTER_LITE_CACHE_MAX_SIZE = 200
const TWITTER_LITE_CACHE_KEY_PREFIX = 'v2:'
const TWITTER_LITE_GUARD_SWEEP_DELAY_MS = 80



const twitterLiteCache = new Map<string, TwitterLiteCardData | null>()
let twitterLiteGuardObserver: MutationObserver | null = null
let twitterLiteGuardSweepTimeout: ReturnType<typeof setTimeout> | null = null

function getTwitterLiteCacheKey(tweetUrl: string): string {
	return `${TWITTER_LITE_CACHE_KEY_PREFIX}${tweetUrl}`
}

/**
 * Clears the in-memory tweet lite data cache.
 * Exposed for testing and for manual cache invalidation.
 */
export function clearTwitterLiteCache(): void {
	twitterLiteCache.clear()
}

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
		__mvpEmbedListenerActive?: boolean
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
	options: { forceReloadTwitter?: boolean; twitterLiteMode?: boolean } = {}
): void {
	const { forceReloadTwitter = true, twitterLiteMode = false } = options
	const embedContainers = container.querySelectorAll('[data-s9e-mediaembed]')

	if (embedContainers.length === 0) return

	logger.debug(`Reinitializing ${embedContainers.length} embeds`)

	if (twitterLiteMode) {
		startTwitterLiteEmbedGuard()
	}

	// Count Twitter embeds that need reloading to stagger them
	let twitterIndex = 0

	embedContainers.forEach(embedContainer => {
		const element = embedContainer as HTMLElement
		const embedType = element.getAttribute('data-s9e-mediaembed')
		const iframe = element.querySelector('iframe') as HTMLIFrameElement
		const isRedditEmbed = embedType === 'reddit' && !!iframe

		// Twitter embeds need special handling
		if (embedType === 'twitter' && iframe && !iframe.hasAttribute(EMBED_INIT_ATTR)) {
			if (twitterLiteMode) {
				void replaceTwitterEmbedWithLiteCard(element, iframe)
				return
			}

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
 * Replaces native Twitter/X iframe embeds with lightweight cards when enabled.
 */
export function replaceTwitterEmbedsWithLite(container: HTMLElement | Document = document): void {
	const twitterEmbeds = new Set<HTMLElement>()

	container.querySelectorAll<HTMLIFrameElement>(TWITTER_EMBED_IFRAME_SELECTOR).forEach(iframe => {
		const embedContainer = iframe.closest<HTMLElement>(TWITTER_EMBED_CONTAINER_SELECTOR)
		if (!embedContainer) {
			clearTwitterIframe(iframe)
			return
		}

		if (embedContainer.getAttribute(TWITTER_LITE_EXPANDED_ATTR) !== 'true') {
			twitterEmbeds.add(embedContainer)
		}
	})

	container.querySelectorAll<HTMLElement>(TWITTER_EMBED_CONTAINER_SELECTOR).forEach(embed => {
		const isS9ETwitter = embed.getAttribute('data-s9e-mediaembed') === 'twitter'
		const isLiteHost = embed.getAttribute(TWITTER_LITE_HOST_ATTR) === 'true'
		const hasTwitterIframe = !!embed.querySelector(TWITTER_EMBED_IFRAME_SELECTOR)
		if (isS9ETwitter || isLiteHost || hasTwitterIframe) twitterEmbeds.add(embed)
	})
	if (twitterEmbeds.size === 0) return

	twitterEmbeds.forEach(embed => {
		if (embed.getAttribute(TWITTER_LITE_EXPANDED_ATTR) === 'true') return
		const iframe = embed.querySelector(TWITTER_EMBED_IFRAME_SELECTOR) as HTMLIFrameElement | null
		const allowNetworkFetch = embed.getAttribute(TWITTER_LITE_ATTR) !== 'true'
		void replaceTwitterEmbedWithLiteCard(embed, iframe, allowNetworkFetch)
	})
}

function clearTwitterIframe(iframe: HTMLIFrameElement): void {
	iframe.remove()
}

function prepareContainerForTwitterLite(embedContainer: HTMLElement): void {
	embedContainer.setAttribute(TWITTER_LITE_HOST_ATTR, 'true')
	embedContainer.removeAttribute('data-s9e-mediaembed')
	embedContainer.classList.remove('twitter')
}

function hasTwitterRelatedMutations(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation => {
		if (mutation.type === 'attributes') {
			const target = mutation.target as HTMLElement
			if (!(target instanceof HTMLIFrameElement)) return false
			if (!target.matches(TWITTER_EMBED_IFRAME_SELECTOR)) return false
			const embed = target.closest<HTMLElement>(TWITTER_EMBED_CONTAINER_SELECTOR)
			if (!embed) return true
			return embed.getAttribute(TWITTER_LITE_EXPANDED_ATTR) !== 'true'
		}

		for (const addedNode of mutation.addedNodes) {
			if (!(addedNode instanceof HTMLElement)) continue
			if (addedNode.matches(TWITTER_EMBED_CONTAINER_SELECTOR)) return true
			if (addedNode.matches(TWITTER_EMBED_IFRAME_SELECTOR)) {
				const embed = addedNode.closest<HTMLElement>(TWITTER_EMBED_CONTAINER_SELECTOR)
				if (!embed || embed.getAttribute(TWITTER_LITE_EXPANDED_ATTR) !== 'true') return true
			}
			if (addedNode.querySelector(TWITTER_EMBED_CONTAINER_SELECTOR)) return true
			const twitterIframe = addedNode.querySelector<HTMLIFrameElement>(TWITTER_EMBED_IFRAME_SELECTOR)
			if (!twitterIframe) continue
			const embed = twitterIframe.closest<HTMLElement>(TWITTER_EMBED_CONTAINER_SELECTOR)
			if (!embed || embed.getAttribute(TWITTER_LITE_EXPANDED_ATTR) !== 'true') return true
		}

		return false
	})
}

function scheduleTwitterLiteGuardSweep(): void {
	if (twitterLiteGuardSweepTimeout !== null) return

	twitterLiteGuardSweepTimeout = setTimeout(() => {
		twitterLiteGuardSweepTimeout = null
		replaceTwitterEmbedsWithLite(document)
	}, TWITTER_LITE_GUARD_SWEEP_DELAY_MS)
}

export function startTwitterLiteEmbedGuard(): void {
	if (twitterLiteGuardObserver) {
		scheduleTwitterLiteGuardSweep()
		return
	}

	const root = document.getElementById('posts-wrap') || document.body || document.documentElement
	if (!root) return

	twitterLiteGuardObserver = new MutationObserver(mutations => {
		if (!hasTwitterRelatedMutations(mutations)) return
		scheduleTwitterLiteGuardSweep()
	})

	twitterLiteGuardObserver.observe(root, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['src'],
	})

	injectTwitterLiteStyles()
	scheduleTwitterLiteGuardSweep()
}

export function stopTwitterLiteEmbedGuard(): void {
	twitterLiteGuardObserver?.disconnect()
	twitterLiteGuardObserver = null
	if (twitterLiteGuardSweepTimeout !== null) {
		clearTimeout(twitterLiteGuardSweepTimeout)
		twitterLiteGuardSweepTimeout = null
	}
}

function extractTweetUrl(embedContainer: HTMLElement, iframe?: HTMLIFrameElement | null): string | null {
	const directLink = embedContainer.querySelector<HTMLAnchorElement>('a[href*="/status/"]')?.getAttribute('href')
	if (directLink) {
		const normalized = normalizeTweetUrl(directLink)
		if (normalized) return normalized
	}

	const iframeSrc = iframe?.getAttribute('src') || ''
	if (iframeSrc) {
		const normalizedIframeSrc = iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc

		try {
			const url = new URL(normalizedIframeSrc)
			const statusId = url.searchParams.get('id')
			if (statusId && /^\d+$/.test(statusId)) {
				const usernameFromPath = url.searchParams.get('screen_name')?.trim()
				if (usernameFromPath) {
					return `https://twitter.com/${usernameFromPath}/status/${statusId}`
				}

				return `https://twitter.com/i/status/${statusId}`
			}
		} catch {
			// Ignore parse errors and continue with fallback regex.
		}
	}

	const html = embedContainer.innerHTML
	const match = html.match(TWITTER_STATUS_URL_REGEX)
	if (!match) return null

	return `https://twitter.com/${match[1]}/status/${match[2]}`
}



function resolveTwitterEmbedSrc(tweetUrl: string, iframe?: HTMLIFrameElement | null): string | null {
	const iframeSrc = iframe?.getAttribute('src')?.trim() || iframe?.src?.trim() || ''
	if (iframeSrc) {
		return iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc
	}

	const statusId = tweetUrl.match(/\/status\/(\d+)/i)?.[1]
	if (!statusId) return null

	return `https://platform.twitter.com/embed/Tweet.html?id=${statusId}&dnt=true&hide_thread=true`
}

function appendTwitterLiteAllowParam(src: string): string {
	try {
		const normalizedSrc = src.startsWith('//') ? `https:${src}` : src
		const parsed = new URL(normalizedSrc)
		parsed.searchParams.set(TWITTER_LITE_ALLOW_PARAM, TWITTER_LITE_ALLOW_VALUE)
		return parsed.toString()
	} catch {
		return src
	}
}

function createTwitterEmbedIframe(src: string, title: string, initialHeight = TWITTER_LITE_MEDIA_INITIAL_HEIGHT): HTMLIFrameElement {
	const iframe = document.createElement('iframe')
	iframe.src = appendTwitterLiteAllowParam(src)
	iframe.title = title
	iframe.setAttribute('scrolling', 'no')
	iframe.setAttribute('frameborder', '0')
	iframe.style.width = '100%'
	iframe.style.height = `${initialHeight}px`
	iframe.style.border = '0'
	iframe.style.display = 'block'
	iframe.style.overflow = 'hidden'
	return iframe
}

function evictOldestCacheEntry(): void {
	if (twitterLiteCache.size < TWITTER_LITE_CACHE_MAX_SIZE) return
	const firstKey = twitterLiteCache.keys().next().value
	if (firstKey !== undefined) twitterLiteCache.delete(firstKey)
}

async function fetchTwitterLiteData(tweetUrl: string): Promise<TwitterLiteCardData | null> {
	const cacheKey = getTwitterLiteCacheKey(tweetUrl)
	const cached = twitterLiteCache.get(cacheKey)
	if (typeof cached !== 'undefined') {
		return cached
	}

	try {
		const result = await sendMessage('fetchTweetLiteData', { tweetUrl })
		if (!result?.success || !result.data) {
			twitterLiteCache.set(cacheKey, null)
			evictOldestCacheEntry()
			return null
		}

		const payload: TwitterLiteCardData = {
			username: (result.data.username || '').trim(),
			displayName: (result.data.displayName || '').trim(),
			text: (result.data.text || '').trim(),
			url: normalizeTweetUrl(result.data.url || tweetUrl) || tweetUrl,
			hasMedia: result.data.hasMedia === true,
			thumbnailUrl: typeof result.data.thumbnailUrl === 'string' ? result.data.thumbnailUrl.trim() || undefined : undefined,
			isVerified: result.data.isVerified === true,
            verifiedType: typeof result.data.verifiedType === 'string' ? result.data.verifiedType : undefined,
			createdAt: typeof result.data.createdAt === 'string' ? result.data.createdAt.trim() || undefined : undefined,
            authorAvatarUrl: typeof result.data.authorAvatarUrl === 'string' ? result.data.authorAvatarUrl.trim() || undefined : undefined,
			// Media: pass through image URLs and video info
			mediaUrls: Array.isArray(result.data.mediaUrls) && result.data.mediaUrls.length > 0 ? result.data.mediaUrls : undefined,
			hasVideo: result.data.hasVideo === true,
			videoThumbnailUrls: Array.isArray(result.data.videoThumbnailUrls) && result.data.videoThumbnailUrls.length > 0 ? result.data.videoThumbnailUrls : undefined,
		}

		const replyTo = result.data.replyTo
		if (replyTo && typeof replyTo.text === 'string') {
			const replyText = replyTo.text.trim()
			if (replyText) {
				const normalizedReplyUrl = normalizeTweetUrl(replyTo.url || '') || undefined
				payload.replyTo = {
					username: (replyTo.username || '').trim(),
					displayName: (replyTo.displayName || '').trim(),
					text: replyText,
					url: normalizedReplyUrl,
					isVerified: replyTo.isVerified === true,
                    verifiedType: typeof replyTo.verifiedType === 'string' ? replyTo.verifiedType : undefined,
					createdAt: typeof replyTo.createdAt === 'string' ? replyTo.createdAt.trim() || undefined : undefined,
                    authorAvatarUrl: typeof replyTo.authorAvatarUrl === 'string' ? replyTo.authorAvatarUrl.trim() || undefined : undefined,
				}
			}
		}

		const quotedTweet = result.data.quotedTweet
		if (quotedTweet && typeof quotedTweet.text === 'string') {
			const quotedText = quotedTweet.text.trim()
			if (quotedText) {
				payload.quotedTweet = {
					username: (quotedTweet.username || '').trim(),
					displayName: (quotedTweet.displayName || '').trim(),
					text: quotedText,
					url: normalizeTweetUrl(quotedTweet.url || '') || quotedTweet.url || '',
					isVerified: quotedTweet.isVerified === true,
					verifiedType: typeof quotedTweet.verifiedType === 'string' ? quotedTweet.verifiedType : undefined,
					createdAt: typeof quotedTweet.createdAt === 'string' ? quotedTweet.createdAt.trim() || undefined : undefined,
					authorAvatarUrl: typeof quotedTweet.authorAvatarUrl === 'string' ? quotedTweet.authorAvatarUrl.trim() || undefined : undefined,
					hasMedia: quotedTweet.hasMedia === true,
					mediaUrls: Array.isArray(quotedTweet.mediaUrls) && quotedTweet.mediaUrls.length > 0 ? quotedTweet.mediaUrls : undefined,
				}
			}
		}

		twitterLiteCache.set(cacheKey, payload)
		evictOldestCacheEntry()
		return payload
	} catch (error) {
		logger.debug('Twitter lite fetch failed', error)
		twitterLiteCache.set(cacheKey, null)
		evictOldestCacheEntry()
		return null
	}
}

async function replaceTwitterEmbedWithLiteCard(
	embedContainer: HTMLElement,
	iframe?: HTMLIFrameElement | null,
	allowNetworkFetch = true
): Promise<void> {
	// Guard checks BEFORE any DOM mutations to prevent concurrent processing
	if (embedContainer.getAttribute(TWITTER_LITE_EXPANDED_ATTR) === 'true') return
	if (embedContainer.getAttribute(TWITTER_LITE_LOADING_ATTR) === 'true') return
	if (
		embedContainer.getAttribute(TWITTER_LITE_ATTR) === 'true' &&
		embedContainer.querySelector('.mvp-twitter-lite-card')
	) {
		return
	}

	// Extract URL while iframe is still in DOM (before clearing)
	const tweetUrl = extractTweetUrl(embedContainer, iframe)
	if (!tweetUrl) return
	const embedSrc = resolveTwitterEmbedSrc(tweetUrl, iframe)

	// Now safe to modify DOM — we have URL and guards passed
	prepareContainerForTwitterLite(embedContainer)
	const existingTwitterIframes = embedContainer.querySelectorAll<HTMLIFrameElement>(TWITTER_EMBED_IFRAME_SELECTOR)
	if (existingTwitterIframes.length > 0) {
		existingTwitterIframes.forEach(clearTwitterIframe)
	}

	const [, rawFallbackUsername = ''] = tweetUrl.match(TWITTER_STATUS_URL_REGEX) || []
	// 'i' is Twitter's anonymous route (/i/status/...), not a real username
	const fallbackUsername = rawFallbackUsername === 'i' ? '' : rawFallbackUsername
	const fallbackData: TwitterLiteCardData = {
		username: fallbackUsername,
		displayName: fallbackUsername ? `@${fallbackUsername}` : 'Tweet',
		text: 'No se pudo cargar el texto de este tweet.',
		url: tweetUrl,
		hasMedia: false,
	}

	embedContainer.setAttribute(TWITTER_LITE_LOADING_ATTR, 'true')
	embedContainer.innerHTML = ''
	embedContainer.appendChild(createTwitterLiteCard({ ...fallbackData, text: '' }, true))

	let data: TwitterLiteCardData | null = null
	if (allowNetworkFetch) {
		data = await fetchTwitterLiteData(tweetUrl)
	}
	embedContainer.innerHTML = ''
	const resolvedData = data ?? fallbackData
	const canExpandTweet = Boolean(embedSrc)
	const card = createTwitterLiteCard({
		...resolvedData,
		canExpandTweet,
	})
	embedContainer.appendChild(card)

	if (canExpandTweet && embedSrc) {
		const mediaButton = card.querySelector<HTMLButtonElement>('.mvp-twitter-lite-media-btn')
		mediaButton?.addEventListener('click', () => {
			// Ensure Twitter resize postMessages are handled outside infinite/live contexts.
			setupGlobalEmbedListener()

			embedContainer.innerHTML = ''
			embedContainer.setAttribute('data-s9e-mediaembed', 'twitter')
			embedContainer.classList.add('embed', 'twitter')
			embedContainer.setAttribute(TWITTER_LITE_EXPANDED_ATTR, 'true')
			embedContainer.removeAttribute(TWITTER_LITE_ATTR)
			embedContainer.removeAttribute(TWITTER_LITE_LOADING_ATTR)
			embedContainer.removeAttribute(TWITTER_LITE_HOST_ATTR)
			embedContainer.appendChild(
				createTwitterEmbedIframe(
					embedSrc,
					`Tweet de ${resolvedData.username || resolvedData.displayName || 'Twitter'}`,
					TWITTER_LITE_MEDIA_INITIAL_HEIGHT
				)
			)
		})
	}

	embedContainer.setAttribute(TWITTER_LITE_ATTR, 'true')
	embedContainer.removeAttribute(TWITTER_LITE_LOADING_ATTR)
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
	if (window.__mvpEmbedListenerActive) return
	window.__mvpEmbedListenerActive = true

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
