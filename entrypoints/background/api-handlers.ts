/**
 * API Handlers Module
 * Handles external API requests (Steam, TMDB, GIPHY)
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { fetchSteamBundleDetails, fetchSteamGameDetails } from '@/services/api/steam'
import { onMessage, type TweetLiteData, type TweetLiteResult } from '@/lib/messaging'
import { API_URLS } from '@/constants'
import type { GiphyPaginatedResponse } from '@/services/api/giphy'
import { normalizeTweetUrl as normalizeTweetUrlBase } from '@/lib/content-modules/twitter-lite/utils'

// =============================================================================
// Constants
// =============================================================================

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = API_URLS.TMDB_BASE
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''
const GIPHY_BASE_URL = API_URLS.GIPHY
const GIPHY_PAGE_SIZE = 18
const TWITTER_OEMBED_URL = 'https://publish.twitter.com/oembed'
const TWITTER_SYNDICATION_URL = 'https://cdn.syndication.twimg.com/tweet-result'
const TWITTER_FETCH_TIMEOUT_MS = 3500

interface GiphyApiResponse {
	data: Array<{
		id: string
		title: string
		images: {
			original: { url: string }
			fixed_height_small: { url: string }
		}
	}>
	pagination: {
		total_count: number
		count: number
		offset: number
	}
}

function toGiphyPaginatedResponse(data: GiphyApiResponse): GiphyPaginatedResponse {
	return {
		gifs: data.data.map(gif => ({
			id: gif.id,
			title: gif.title || 'GIF',
			url: gif.images.original.url,
			previewUrl: gif.images.fixed_height_small.url,
		})),
		pagination: {
			totalCount: data.pagination.total_count,
			count: data.pagination.count,
			offset: data.pagination.offset,
		},
	}
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
}

function stripHtmlToPlainText(html: string): string {
	return decodeHtmlEntities(
		html
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	)
}

/** Wraps shared normalizeTweetUrl with HTML entity decoding for oEmbed HTML contexts. */
function normalizeTweetUrl(rawUrl: string): string | null {
	return normalizeTweetUrlBase(decodeHtmlEntities(rawUrl))
}

function extractStatusId(tweetUrl: string): string | null {
	const normalized = normalizeTweetUrl(tweetUrl)
	if (!normalized) return null
	return normalized.match(/\/status\/(\d+)/i)?.[1] || null
}

function extractReplyTargetUrlFromOEmbedHtml(html: string, currentTweetUrl: string): string | null {
	if (!html) return null

	const currentStatusId = extractStatusId(currentTweetUrl)
	const findTargetInHtml = (sourceHtml: string): string | null => {
		const matches = sourceHtml.matchAll(/href\s*=\s*"([^"]+)"/gi)
		for (const match of matches) {
			const href = match[1]
			const normalized = normalizeTweetUrl(href)
			if (!normalized) continue

			const statusId = extractStatusId(normalized)
			if (!statusId) continue
			if (currentStatusId && statusId === currentStatusId) continue

			return normalized
		}

		return null
	}

	// Prefer links outside the tweet body to avoid misclassifying tweet links shared in the text.
	const htmlWithoutFirstParagraph = html.replace(/<p[^>]*>[\s\S]*?<\/p>/i, '')
	return findTargetInHtml(htmlWithoutFirstParagraph) || findTargetInHtml(html)
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractThreadContextText(threadHtml: string, currentTweetText: string): string | null {
	if (!threadHtml || !currentTweetText.trim()) return null

	const paragraphMatches = [...threadHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
	const currentText = currentTweetText.trim()
	const currentTokens = currentText.match(/[A-Za-z0-9À-ÿ]+/g) || []
	const prefixTokens = currentTokens.slice(0, 8)
	const prefixPattern = prefixTokens.length >= 4
		? new RegExp(prefixTokens.map(escapeRegExp).join('[\\s\\W]+'), 'i')
		: null

	const candidates = paragraphMatches
		.map(match => stripHtmlToPlainText(match[1]))
		.filter(text => text.length > currentText.length + 24)
		.sort((a, b) => b.length - a.length)

	for (const candidate of candidates) {
		const directIndex = candidate.lastIndexOf(currentText)
		if (directIndex > 0) {
			const context = candidate.slice(0, directIndex).trim()
			if (context.length >= 24) return context
		}

		if (prefixPattern) {
			const prefixMatch = prefixPattern.exec(candidate)
			if (prefixMatch && typeof prefixMatch.index === 'number' && prefixMatch.index > 0) {
				const context = candidate.slice(0, prefixMatch.index).trim()
				if (context.length >= 24) return context
			}
		}
	}

	const currentComparable = currentText.toLowerCase().replace(/\s+/g, ' ').trim()
	const fallbackCandidate = candidates.find(candidate => {
		const comparable = candidate.toLowerCase().replace(/\s+/g, ' ').trim()
		return comparable !== currentComparable && !comparable.includes(currentComparable)
	})
	if (fallbackCandidate) return fallbackCandidate

	return null
}

async function fetchTwitterOEmbedPayload(
	tweetUrl: string,
	options: { hideThread?: boolean } = {}
): Promise<Record<string, unknown> | null> {
	const normalizedTweetUrl = normalizeTweetUrl(tweetUrl)
	if (!normalizedTweetUrl) return null

	const endpoint = new URL(TWITTER_OEMBED_URL)
	endpoint.searchParams.set('url', normalizedTweetUrl)
	endpoint.searchParams.set('omit_script', 'true')
	endpoint.searchParams.set('dnt', 'true')

	if (typeof options.hideThread === 'boolean') {
		endpoint.searchParams.set('hide_thread', options.hideThread ? 'true' : 'false')
	}

	return fetchRecordWithTimeout(endpoint.toString(), {
		headers: { Accept: 'application/json' },
	})
}

function extractTweetLiteDataFromOEmbed(payload: Record<string, unknown>, fallbackUrl: string): TweetLiteData | null {
	const authorName = typeof payload.author_name === 'string' ? payload.author_name.trim() : ''
	const authorUrl = typeof payload.author_url === 'string' ? payload.author_url.trim() : ''
	const html = typeof payload.html === 'string' ? payload.html : ''
	const type = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : ''
	const thumbnailUrl = typeof payload.thumbnail_url === 'string' ? payload.thumbnail_url.trim() : ''
	const paragraphMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
	const primaryTextSource = paragraphMatches[0]?.[1] || html
	const text = stripHtmlToPlainText(primaryTextSource)

	const usernameMatch = authorUrl.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i)
	const username = usernameMatch?.[1] || ''
	const displayName = authorName || (username ? `@${username}` : 'Tweet')
	const hasPicLink = /pic\.twitter\.com\/[A-Za-z0-9]+/i.test(html) || /pic\.twitter\.com\/[A-Za-z0-9]+/i.test(text)
	const hasMedia = !!thumbnailUrl || hasPicLink || type === 'photo'

	if (!text) return null

	return {
		username,
		displayName,
		text,
		url: fallbackUrl,
		hasMedia,
		thumbnailUrl: thumbnailUrl || undefined,
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

async function fetchRecordWithTimeout(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), TWITTER_FETCH_TIMEOUT_MS)

	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal,
		})
		if (!response.ok) return null

		const payload = (await response.json()) as unknown
		return isRecord(payload) ? payload : null
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			logger.debug('Twitter request timeout', { url, timeoutMs: TWITTER_FETCH_TIMEOUT_MS })
		}
		return null
	} finally {
		clearTimeout(timeoutId)
	}
}

function asTrimmedString(value: unknown): string {
	return typeof value === 'string' ? decodeHtmlEntities(value).trim() : ''
}

function buildCanonicalTweetUrl(username: string, statusId: string, fallbackUrl: string): string {
	if (username && statusId) {
		return `https://twitter.com/${username}/status/${statusId}`
	}
	if (statusId) {
		return `https://twitter.com/i/status/${statusId}`
	}
	return normalizeTweetUrl(fallbackUrl) || fallbackUrl
}

function formatTweetDateLabel(rawCreatedAt: string): string | undefined {
	const normalized = asTrimmedString(rawCreatedAt)
	if (!normalized) return undefined

	const parsed = new Date(normalized)
	if (Number.isNaN(parsed.getTime())) return undefined

	return new Intl.DateTimeFormat('es-ES', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(parsed)
}

function buildSyndicationToken(statusId: string): string {
	const numericId = Number(statusId)
	if (!Number.isFinite(numericId)) return ''
	return ((numericId / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
}

function extractTweetLiteDataFromSyndication(payload: Record<string, unknown>, fallbackUrl: string): TweetLiteData | null {
	const statusId = asTrimmedString(payload.id_str)
	const text = asTrimmedString(payload.full_text) || asTrimmedString(payload.text)
	if (!text) return null

	const user = isRecord(payload.user) ? payload.user : null
	const username = asTrimmedString(user?.screen_name)
	const displayName = asTrimmedString(user?.name) || (username ? `@${username}` : 'Tweet')
	const isVerified = Boolean(user?.verified === true || user?.is_blue_verified === true)
	const createdAt = formatTweetDateLabel(asTrimmedString(payload.created_at))

	const photosRaw = payload.photos
	const photos = Array.isArray(photosRaw) ? photosRaw : []
	const mediaUrls: string[] = []
	let hasVideo = false
	const videoThumbnailUrls: string[] = []

	// 1. Photos array (syndication-specific field)
	for (const photo of photos) {
		if (!isRecord(photo)) continue
		const url = asTrimmedString(photo.url) || asTrimmedString(photo.media_url_https) || asTrimmedString(photo.media_url)
		if (url && url.includes('pbs.twimg.com')) mediaUrls.push(url)
	}

	// 2. mediaDetails (syndication-specific, usually most reliable)
	const details = payload.mediaDetails
	if (Array.isArray(details)) {
		for (const media of details) {
			if (!isRecord(media)) continue
			const type = asTrimmedString(media.type)
			const url = asTrimmedString(media.media_url_https) || asTrimmedString(media.media_url)
			if (!url) continue

			if (type === 'video' || type === 'animated_gif') {
				hasVideo = true
				if (!videoThumbnailUrls.includes(url)) videoThumbnailUrls.push(url)
			} else if (!mediaUrls.includes(url)) {
				mediaUrls.push(url)
			}
		}
	}

	// 3. Fallback: entities.media (standard Twitter API structure)
	if (mediaUrls.length === 0 && videoThumbnailUrls.length === 0) {
		const entities = isRecord(payload.entities) ? payload.entities : null
		const extEntities = isRecord(payload.extended_entities) ? payload.extended_entities : null
		const mediaSources = [extEntities?.media, entities?.media].filter(Array.isArray)
		for (const mediaArray of mediaSources) {
			for (const media of mediaArray as unknown[]) {
				if (!isRecord(media)) continue
				const type = asTrimmedString(media.type)
				const url = asTrimmedString(media.media_url_https) || asTrimmedString(media.media_url)
				if (!url) continue

				if (type === 'video' || type === 'animated_gif') {
					hasVideo = true
					if (!videoThumbnailUrls.includes(url)) videoThumbnailUrls.push(url)
				} else if (!mediaUrls.includes(url)) {
					mediaUrls.push(url)
				}
			}
			if (mediaUrls.length > 0 || videoThumbnailUrls.length > 0) break
		}
	}

	// 4. Video poster fallback
	if (isRecord(payload.video)) {
		hasVideo = true
		const poster = asTrimmedString(payload.video.poster)
		if (poster && !videoThumbnailUrls.includes(poster)) {
			videoThumbnailUrls.push(poster)
		}
	}

	// Debug: log what we found for media
	logger.debug('Twitter lite media extraction', {
		statusId,
		photosCount: photos.length,
		mediaDetailsCount: Array.isArray(details) ? details.length : 0,
		extractedMediaUrls: mediaUrls,
		hasVideo,
		videoThumbnailUrls,
		payloadKeys: Object.keys(payload).filter(k => ['photos', 'mediaDetails', 'video', 'entities', 'extended_entities', 'media'].includes(k)),
	})

	// Extract Avatar URL
	const authorAvatarUrl = asTrimmedString(user?.profile_image_url_https) || undefined

	// Extract Verified Type
	const verifiedType = asTrimmedString(user?.verified_type) || undefined

	const hasMedia = mediaUrls.length > 0 || hasVideo

	return {
		username,
		displayName,
		text,
		url: buildCanonicalTweetUrl(username, statusId, fallbackUrl),
		hasMedia,
		thumbnailUrl: mediaUrls[0] || videoThumbnailUrls[0] || undefined,
		mediaUrls,
		hasVideo,
		videoThumbnailUrls,
		isVerified,
		verifiedType,
		createdAt,
		authorAvatarUrl,
	}
}

async function fetchSyndicationTweetById(statusId: string): Promise<Record<string, unknown> | null> {
	const trimmedId = statusId.trim()
	if (!trimmedId) return null

	const fetchPayload = async (useToken: boolean): Promise<Record<string, unknown> | null> => {
		const endpoint = new URL(TWITTER_SYNDICATION_URL)
		endpoint.searchParams.set('id', trimmedId)
		endpoint.searchParams.set('lang', 'en')

		if (useToken) {
			const token = buildSyndicationToken(trimmedId)
			if (token) endpoint.searchParams.set('token', token)
		}

		return fetchRecordWithTimeout(endpoint.toString(), {
			headers: { Accept: 'application/json' },
		})
	}

	// Newer X deployments often require a deterministic token.
	const withToken = await fetchPayload(true)
	if (withToken) return withToken

	// Keep a fallback for environments where tokenless requests still work.
	return fetchPayload(false)
}

async function requestGiphy(
	endpoint: 'trending' | 'search',
	params: URLSearchParams
): Promise<GiphyPaginatedResponse> {
	if (!GIPHY_API_KEY) {
		throw new Error('GIPHY API key not configured in environment')
	}

	params.set('api_key', GIPHY_API_KEY)
	params.set('limit', String(GIPHY_PAGE_SIZE))
	params.set('rating', 'g')

	const response = await fetch(`${GIPHY_BASE_URL}/${endpoint}?${params.toString()}`)

	if (!response.ok) {
		throw new Error(`GIPHY API error: ${response.status}`)
	}

	const data = (await response.json()) as GiphyApiResponse
	return toGiphyPaginatedResponse(data)
}

// =============================================================================
// API Handlers
// =============================================================================

/**
 * Setup options page opener handler
 */
export function setupOptionsHandler(): void {
	onMessage('openOptionsPage', async ({ data: view }) => {
		let url = browser.runtime.getURL('/options.html')
		if (view) {
			// Support query params in view: "settings?tab=ai" -> "#/settings?tab=ai"
			url += `#/${view}`
		}

		const baseOptionsUrl = browser.runtime.getURL('/options.html')
		const existingTabs = await browser.tabs.query({ url: `${baseOptionsUrl}*` })
		const existingTab = existingTabs[0]

		if (existingTab?.id) {
			if (existingTab.url !== url) {
				await browser.tabs.update(existingTab.id, { url })
			}

			await browser.tabs.update(existingTab.id, { active: true })

			if (typeof existingTab.windowId === 'number') {
				await browser.windows.update(existingTab.windowId, { focused: true })
			}

			return
		}

		await browser.tabs.create({ url })
	})
}

/**
 * Setup Steam API handler (CORS proxy)
 */
export function setupSteamHandler(): void {
	onMessage('fetchSteamGame', async ({ data: appId }) => {
		try {
			return await fetchSteamGameDetails(appId)
		} catch (error) {
			logger.error('Steam fetch error:', error)
			return null
		}
	})

	onMessage('fetchSteamBundle', async ({ data: bundleId }) => {
		try {
			return await fetchSteamBundleDetails(bundleId)
		} catch (error) {
			logger.error('Steam bundle fetch error:', error)
			return null
		}
	})
}

/**
 * Setup TMDB API key check handler
 */
export function setupTmdbKeyCheckHandler(): void {
	onMessage('hasTmdbApiKey', () => {
		return !!TMDB_API_KEY
	})
}

/**
 * Setup TMDB API request handler
 * Reads API key from env and proxies requests
 */
export function setupTmdbRequestHandler(): void {
	onMessage('tmdbRequest', async ({ data }) => {
		try {
			if (!TMDB_API_KEY) {
				throw new Error('TMDB API key not configured in environment')
			}

			const url = new URL(`${TMDB_BASE_URL}${data.endpoint}`)
			url.searchParams.set('api_key', TMDB_API_KEY)
			url.searchParams.set('language', 'es-ES')

			if (data.params) {
				for (const [key, value] of Object.entries(data.params)) {
					url.searchParams.set(key, value)
				}
			}

			const response = await fetch(url.toString())

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('API key inválida')
				}
				throw new Error(`TMDB API error: ${response.status}`)
			}

			return await response.json()
		} catch (error) {
			logger.error('TMDB request error:', error)
			throw error // Re-throw so the caller can handle it
		}
	})
}

/**
 * Setup GIPHY API handlers
 * Reads API key from env and proxies requests
 */
export function setupGiphyHandlers(): void {
	onMessage('giphyTrending', async ({ data }) => {
		try {
			const offset = Math.max(0, data.offset ?? 0)
			return await requestGiphy('trending', new URLSearchParams({ offset: String(offset) }))
		} catch (error) {
			logger.error('GIPHY trending request error:', error)
			throw error
		}
	})

	onMessage('giphySearch', async ({ data }) => {
		try {
			const query = data.query.trim()
			if (!query) {
				return { gifs: [], pagination: { totalCount: 0, count: 0, offset: 0 } }
			}

			const offset = Math.max(0, data.offset ?? 0)
			return await requestGiphy(
				'search',
				new URLSearchParams({
					q: query,
					offset: String(offset),
					lang: 'es',
				})
			)
		} catch (error) {
			logger.error('GIPHY search request error:', error)
			throw error
		}
	})
}

/**
 * Merges syndication metadata (avatar, verified, media, quoted tweet) into the base oEmbed data.
 */
function enrichWithSyndicationData(
	tweetData: TweetLiteData,
	syndicationPayload: Record<string, unknown> | null,
	normalizedUrl: string
): void {
	const syndicationData = syndicationPayload
		? extractTweetLiteDataFromSyndication(syndicationPayload, normalizedUrl)
		: null
	if (!syndicationData) return

	tweetData.isVerified = syndicationData.isVerified
	tweetData.verifiedType = syndicationData.verifiedType
	tweetData.createdAt = syndicationData.createdAt
	tweetData.authorAvatarUrl = syndicationData.authorAvatarUrl

	if (syndicationData.mediaUrls && syndicationData.mediaUrls.length > 0) {
		tweetData.mediaUrls = syndicationData.mediaUrls
		tweetData.thumbnailUrl = syndicationData.thumbnailUrl
		tweetData.hasMedia = true
	}
	if (syndicationData.hasVideo) {
		tweetData.hasVideo = true
		tweetData.videoThumbnailUrls = syndicationData.videoThumbnailUrls
	}

	// Extract quoted tweet from syndication
	const quotedRaw = syndicationPayload?.quoted_tweet
	if (isRecord(quotedRaw)) {
		const quotedData = extractTweetLiteDataFromSyndication(quotedRaw, '')
		if (quotedData?.text) {
			tweetData.quotedTweet = {
				username: quotedData.username,
				displayName: quotedData.displayName,
				text: quotedData.text,
				url: quotedData.url,
				isVerified: quotedData.isVerified,
				verifiedType: quotedData.verifiedType,
				createdAt: quotedData.createdAt,
				authorAvatarUrl: quotedData.authorAvatarUrl,
				hasMedia: quotedData.hasMedia,
				mediaUrls: quotedData.mediaUrls && quotedData.mediaUrls.length > 0 ? quotedData.mediaUrls : undefined,
			}
		}
	}
}

/**
 * Tries multiple strategies to find the parent tweet for reply context:
 * 1. oEmbed HTML link extraction (hidden-thread and full-thread modes)
 * 2. Syndication `in_reply_to_status_id_str` field
 * 3. Thread context text inference from full-thread HTML
 */
async function resolveReplyContext(
	tweetData: TweetLiteData,
	oEmbedPayload: Record<string, unknown>,
	syndicationPayload: Record<string, unknown> | null,
	normalizedTweetUrl: string,
	statusId: string | null
): Promise<void> {
	const html = typeof oEmbedPayload.html === 'string' ? oEmbedPayload.html : ''
	let replyTargetUrl = extractReplyTargetUrlFromOEmbedHtml(html, normalizedTweetUrl)
	let threadHtml = ''

	// Strategy 1a: check full-thread oEmbed if hidden-thread mode didn't reveal a parent
	if (!replyTargetUrl) {
		const threadPayload = await fetchTwitterOEmbedPayload(normalizedTweetUrl, { hideThread: false })
		threadHtml = typeof threadPayload?.html === 'string' ? threadPayload.html : ''
		replyTargetUrl = extractReplyTargetUrlFromOEmbedHtml(threadHtml, normalizedTweetUrl)
	}

	// Strategy 1b: fetch the parent tweet via oEmbed + syndication (for rich metadata)
	if (replyTargetUrl) {
		const replyStatusId = extractStatusId(replyTargetUrl)
		const [replyPayload, replySyndicationPayload] = await Promise.all([
			fetchTwitterOEmbedPayload(replyTargetUrl, { hideThread: true }),
			replyStatusId ? fetchSyndicationTweetById(replyStatusId) : Promise.resolve(null),
		])
		const replyData = replyPayload ? extractTweetLiteDataFromOEmbed(replyPayload, replyTargetUrl) : null
		if (replyData && replyData.text !== tweetData.text) {
			// Enrich with syndication metadata (avatar, verified, date)
			const replySyndication = replySyndicationPayload
				? extractTweetLiteDataFromSyndication(replySyndicationPayload, replyTargetUrl)
				: null

			tweetData.replyTo = {
				username: replySyndication?.username || replyData.username,
				displayName: replySyndication?.displayName || replyData.displayName,
				text: replyData.text,
				url: replyData.url,
				isVerified: replySyndication?.isVerified,
				verifiedType: replySyndication?.verifiedType,
				createdAt: replySyndication?.createdAt,
				authorAvatarUrl: replySyndication?.authorAvatarUrl,
			}
		}
	}

	// Strategy 2: syndication in_reply_to lookup
	if (!tweetData.replyTo && statusId) {
		const parentStatusId = asTrimmedString(syndicationPayload?.in_reply_to_status_id_str)
		logger.debug('Twitter lite syndication lookup', {
			statusId,
			hasTweetPayload: !!syndicationPayload,
			parentStatusId: parentStatusId || null,
		})
		if (parentStatusId) {
			const parentFallbackUrl = `https://twitter.com/i/status/${parentStatusId}`
			const parentPayload = await fetchSyndicationTweetById(parentStatusId)
			const parentData = parentPayload
				? extractTweetLiteDataFromSyndication(parentPayload, parentFallbackUrl)
				: null

			if (parentData && parentData.text !== tweetData.text) {
				tweetData.replyTo = {
					username: parentData.username,
					displayName: parentData.displayName,
					text: parentData.text,
					url: parentData.url,
					isVerified: parentData.isVerified,
					verifiedType: parentData.verifiedType,
					createdAt: parentData.createdAt,
					authorAvatarUrl: parentData.authorAvatarUrl,
				}
				logger.debug('Twitter lite reply resolved via syndication', { statusId, parentStatusId })
			}
		}
	}

	// Strategy 3: infer reply context from thread HTML text
	if (!tweetData.replyTo && !threadHtml) {
		const threadPayload = await fetchTwitterOEmbedPayload(normalizedTweetUrl, { hideThread: false })
		threadHtml = typeof threadPayload?.html === 'string' ? threadPayload.html : ''
	}

	if (!tweetData.replyTo && threadHtml) {
		const inferredContext = extractThreadContextText(threadHtml, tweetData.text)
		if (inferredContext) {
			tweetData.replyTo = {
				username: '',
				displayName: '',
				text: inferredContext,
			}
			logger.debug('Twitter lite reply inferred from thread context', { tweetUrl: normalizedTweetUrl })
		}
	}

	logger.debug('Twitter lite reply detection finished', {
		tweetUrl: normalizedTweetUrl,
		hasReplyTargetUrl: !!replyTargetUrl,
		hasThreadHtml: threadHtml.length > 0,
		hasReplyTo: !!tweetData.replyTo,
	})
}

/**
 * Setup Twitter oEmbed handler for lightweight tweet rendering.
 */
export function setupTwitterLiteHandler(): void {
	onMessage('fetchTweetLiteData', async ({ data }): Promise<TweetLiteResult> => {
		try {
			const tweetUrl = data.tweetUrl?.trim()
			if (!tweetUrl) {
				return { success: false, error: 'Tweet URL is required' }
			}

			const normalizedTweetUrl = normalizeTweetUrl(tweetUrl)
			const hasStatusPath = !!normalizedTweetUrl && /\/status\/\d+/i.test(normalizedTweetUrl)
			if (!normalizedTweetUrl || !hasStatusPath) {
				return { success: false, error: 'Invalid tweet URL' }
			}

			// Fetch oEmbed and syndication in parallel — they are independent
			const statusId = extractStatusId(normalizedTweetUrl)
			const [payload, syndicationPayload] = await Promise.all([
				fetchTwitterOEmbedPayload(normalizedTweetUrl, { hideThread: true }),
				statusId ? fetchSyndicationTweetById(statusId) : Promise.resolve(null),
			])

			if (!payload) {
				return { success: false, error: 'oEmbed error' }
			}

			const tweetData = extractTweetLiteDataFromOEmbed(payload, normalizedTweetUrl)
			if (!tweetData) {
				return { success: false, error: 'Tweet content unavailable' }
			}

			enrichWithSyndicationData(tweetData, syndicationPayload, normalizedTweetUrl)
			await resolveReplyContext(tweetData, payload, syndicationPayload, normalizedTweetUrl, statusId)

			return { success: true, data: tweetData }
		} catch (error) {
			logger.warn('Twitter lite fetch failed:', error)
			return { success: false, error: 'Failed to fetch tweet' }
		}
	})
}

/**
 * Setup all API handlers
 */
export function setupApiHandlers(): void {
	setupOptionsHandler()
	setupSteamHandler()
	setupTmdbKeyCheckHandler()
	setupTmdbRequestHandler()
	setupGiphyHandlers()
	setupTwitterLiteHandler()
}
