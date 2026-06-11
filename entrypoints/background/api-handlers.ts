/**
 * API Handlers Module
 * Handles external API requests (Steam, TMDB, GIPHY)
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { fetchSteamBundleDetails, fetchSteamGameDetails, searchSteamApps } from '@/services/api/steam'
import {
	onMessage,
	type MvUserAvatarResult,
	type MvUserSearchResult,
	type MvUserSearchUser,
	type ThreadPageHtmlFetchResult,
	type TweetLiteData,
	type TweetLiteResult,
} from '@/lib/messaging'
import { API_URLS, MV_BASE_URL, MV_URLS } from '@/constants'
import type { GiphyPaginatedResponse } from '@/services/api/giphy'
import { normalizeTweetUrl as normalizeTweetUrlBase } from '@/lib/content-modules/twitter-lite/utils'
import { uploadBase64ImageToBestProvider } from './upload-handlers'

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
const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co'
const ANILIST_IMAGE_HOST = 's4.anilist.co'
const MAX_REHOST_IMAGE_BYTES = 8 * 1024 * 1024
const TWITTER_FETCH_TIMEOUT_MS = 3500
const MEDIAVIDA_THREAD_HOSTS = new Set(['www.mediavida.com', 'mediavida.com'])
const MV_USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,13}$/
const MV_USER_SEARCH_MAX_RESULTS = 6

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	const chunkSize = 0x8000
	let binary = ''

	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize)
		binary += String.fromCharCode(...chunk)
	}

	return btoa(binary)
}

function extensionFromContentType(contentType: string | null): string {
	if (!contentType) return 'jpg'
	if (/png/i.test(contentType)) return 'png'
	if (/webp/i.test(contentType)) return 'webp'
	if (/gif/i.test(contentType)) return 'gif'
	return 'jpg'
}

function getSafeAniListImageFileName(rawUrl: string, contentType: string | null): string {
	try {
		const url = new URL(rawUrl)
		const rawName = url.pathname.split('/').pop()?.replace(/[^a-z0-9._-]/gi, '-') || ''
		if (rawName && /\.[a-z0-9]{2,5}$/i.test(rawName)) return rawName
		return `anilist-image.${extensionFromContentType(contentType)}`
	} catch {
		return `anilist-image.${extensionFromContentType(contentType)}`
	}
}

function assertAllowedAniListImageUrl(rawUrl: string): URL {
	const url = new URL(rawUrl)
	if (url.protocol !== 'https:' || url.hostname !== ANILIST_IMAGE_HOST) {
		throw new Error('URL de imagen AniList no permitida')
	}
	return url
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

function asNonNegativeInteger(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
		return Math.trunc(value)
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (!trimmed) return undefined
		const parsed = Number(trimmed)
		if (Number.isFinite(parsed) && parsed >= 0) {
			return Math.trunc(parsed)
		}
	}

	return undefined
}

function readTweetCount(payload: Record<string, unknown>, ...keys: string[]): number | undefined {
	for (const key of keys) {
		const count = asNonNegativeInteger(payload[key])
		if (typeof count === 'number') return count
	}

	const legacy = isRecord(payload.legacy) ? payload.legacy : null
	if (!legacy) return undefined

	for (const key of keys) {
		const count = asNonNegativeInteger(legacy[key])
		if (typeof count === 'number') return count
	}

	return undefined
}

function isAllowedMediavidaThreadUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl)
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
		if (!MEDIAVIDA_THREAD_HOSTS.has(url.hostname.toLowerCase())) return false
		return url.pathname.startsWith('/foro/')
	} catch {
		return false
	}
}

function normalizeMediavidaAvatarUrl(rawAvatar: string): string | undefined {
	const avatar = rawAvatar.trim()
	if (!avatar) return undefined
	if (/^https?:\/\//i.test(avatar)) return avatar
	if (avatar.startsWith('//')) return `https:${avatar}`
	if (avatar.startsWith('/')) return `${MV_BASE_URL}${avatar}`
	return `${MV_URLS.AVATAR_BASE}/${avatar}`
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
	return Array.isArray(value) && value.every(isRecord)
}

function getStringValue(value: unknown): string {
	return typeof value === 'string' ? value.trim() : ''
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function extractMvUserSuggestions(payload: unknown): Record<string, unknown>[] {
	if (isRecord(payload) && isRecordArray(payload.suggestions)) return payload.suggestions
	if (isRecordArray(payload)) return payload
	return []
}

function extractAttribute(html: string, attributeName: string): string {
	const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, 'i')
	return decodeHtmlEntities(pattern.exec(html)?.[1] || '')
}

function extractAvatarSourceFromHtml(html: string): string {
	const imageMatches = html.matchAll(/<img\b[^>]*>/gi)
	for (const match of imageMatches) {
		const src = extractAttribute(match[0], 'src')
		if (src && /\/img\/users\/avatar\//i.test(src)) return src
	}

	return ''
}

function extractMvUserSuggestionsFromHtml(html: string): Record<string, unknown>[] {
	const suggestions: Record<string, unknown>[] = []
	const seenUsernames = new Set<string>()
	const userLinkMatches = html.matchAll(/<a\b[^>]*href\s*=\s*["']\/id\/([^"'/?#]+)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)

	for (const match of userLinkMatches) {
		const username = safeDecodeURIComponent(match[1] || '').trim()
		const usernameKey = username.toLowerCase()
		if (!username || seenUsernames.has(usernameKey)) continue

		seenUsernames.add(usernameKey)
		const linkHtml = match[0]
		const matchIndex = match.index ?? 0
		const nearbyHtml = html.slice(Math.max(0, matchIndex - 400), matchIndex + linkHtml.length + 400)
		const avatar = extractAvatarSourceFromHtml(linkHtml) || extractAvatarSourceFromHtml(nearbyHtml)

		suggestions.push({
			value: username,
			data: {
				nombre: username,
				avatar,
			},
		})
	}

	return suggestions
}

function parseMvUserSuggestionsPayload(text: string): unknown {
	const trimmed = text.trim()
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			return JSON.parse(trimmed)
		} catch {
			// Fall through to the HTML parser; MV can return non-standard responses.
		}
	}

	return extractMvUserSuggestionsFromHtml(text)
}

function getSuggestionUsername(suggestion: Record<string, unknown>): string {
	const data = isRecord(suggestion.data) ? suggestion.data : null
	return (
		getStringValue(data?.nombre) ||
		getStringValue(suggestion.nombre) ||
		getStringValue(suggestion.value) ||
		getStringValue(suggestion.username)
	)
}

function getSuggestionAvatar(suggestion: Record<string, unknown>): string {
	const data = isRecord(suggestion.data) ? suggestion.data : null
	return getStringValue(data?.avatar) || getStringValue(suggestion.avatar)
}

async function fetchMvUserSuggestions(
	query: string
): Promise<{ suggestions: Record<string, unknown>[] } | { error: string }> {
	const url = `${MV_URLS.USERS_LIST}?query=${encodeURIComponent(query)}`
	const response = await fetch(url, {
		credentials: 'include',
		headers: {
			Accept: 'application/json, text/javascript, */*; q=0.01',
			'X-Requested-With': 'XMLHttpRequest',
		},
	})

	if (!response.ok) {
		return { error: `HTTP ${response.status}` }
	}

	return { suggestions: extractMvUserSuggestions(parseMvUserSuggestionsPayload(await response.text())) }
}

async function resolveMvUserAvatar(username: string): Promise<MvUserAvatarResult> {
	const normalizedUsername = username.trim()
	if (!MV_USERNAME_PATTERN.test(normalizedUsername)) {
		return { success: false, error: 'Nick no valido' }
	}

	const result = await fetchMvUserSuggestions(normalizedUsername)
	if ('error' in result) {
		return { success: false, error: result.error }
	}

	const exactSuggestion = result.suggestions.find(
		suggestion => getSuggestionUsername(suggestion).toLowerCase() === normalizedUsername.toLowerCase()
	)
	if (!exactSuggestion) {
		return { success: false, error: 'Usuario no encontrado' }
	}

	const avatarUrl = normalizeMediavidaAvatarUrl(getSuggestionAvatar(exactSuggestion))
	return {
		success: Boolean(avatarUrl),
		username: getSuggestionUsername(exactSuggestion) || normalizedUsername,
		avatarUrl,
		error: avatarUrl ? undefined : 'Avatar no encontrado',
	}
}

async function searchMvUsers(query: string): Promise<MvUserSearchResult> {
	const normalizedQuery = query.trim()
	if (!MV_USERNAME_PATTERN.test(normalizedQuery)) {
		return { success: false, error: 'Consulta no valida' }
	}

	const result = await fetchMvUserSuggestions(normalizedQuery)
	if ('error' in result) {
		return { success: false, error: result.error }
	}

	const users: MvUserSearchUser[] = []
	const seenUsernames = new Set<string>()
	for (const suggestion of result.suggestions) {
		const username = getSuggestionUsername(suggestion)
		const usernameKey = username.toLowerCase()
		if (!username || seenUsernames.has(usernameKey)) continue

		seenUsernames.add(usernameKey)
		users.push({
			username,
			avatarUrl: normalizeMediavidaAvatarUrl(getSuggestionAvatar(suggestion)) || undefined,
		})
		if (users.length >= MV_USER_SEARCH_MAX_RESULTS) break
	}

	return { success: true, users }
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
	const replyCount = readTweetCount(payload, 'reply_count', 'replyCount', 'conversation_count', 'conversationCount')
	const retweetCount = readTweetCount(payload, 'retweet_count', 'retweetCount')
	const quoteCount = readTweetCount(payload, 'quote_count', 'quoteCount')
	const likeCount = readTweetCount(payload, 'favorite_count', 'like_count', 'favoriteCount', 'likeCount')

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
		replyCount,
		retweetCount,
		quoteCount,
		likeCount,
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

	onMessage('searchSteamApps', async ({ data }) => {
		try {
			return await searchSteamApps(data.query, data.limit)
		} catch (error) {
			logger.error('Steam search error:', error)
			return []
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
 * Setup AniList GraphQL API request handler.
 */
export function setupAniListRequestHandler(): void {
	onMessage('anilistRequest', async ({ data }) => {
		try {
			const response = await fetch(ANILIST_GRAPHQL_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({
					query: data.query,
					variables: data.variables ?? {},
				}),
			})

			if (!response.ok) {
				if (response.status === 429) {
					throw new Error('AniList está limitando las peticiones. Prueba de nuevo en unos segundos.')
				}
				throw new Error(`AniList API error: ${response.status}`)
			}

			const payload = await response.json()
			if (payload?.errors?.length) {
				throw new Error(payload.errors[0]?.message || 'AniList API error')
			}

			return payload
		} catch (error) {
			logger.error('AniList request error:', error)
			throw error
		}
	})

	onMessage('rehostAniListImage', async ({ data }) => {
		try {
			const url = assertAllowedAniListImageUrl(data.url)
			const response = await fetch(url.toString(), {
				headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
			})

			if (!response.ok) {
				throw new Error(`AniList image fetch error: ${response.status}`)
			}

			const contentType = response.headers.get('content-type')
			if (!contentType?.startsWith('image/')) {
				throw new Error('La URL de AniList no devolvió una imagen')
			}

			const contentLength = Number(response.headers.get('content-length') || '0')
			if (contentLength > MAX_REHOST_IMAGE_BYTES) {
				throw new Error('La imagen de AniList es demasiado grande')
			}

			const buffer = await response.arrayBuffer()
			if (buffer.byteLength > MAX_REHOST_IMAGE_BYTES) {
				throw new Error('La imagen de AniList es demasiado grande')
			}

			return uploadBase64ImageToBestProvider({
				base64: arrayBufferToBase64(buffer),
				fileName: getSafeAniListImageFileName(url.toString(), contentType),
				mimeType: contentType,
				fileSize: buffer.byteLength,
			})
		} catch (error) {
			logger.error('AniList image rehost error:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'No se pudo rehostear la imagen',
			}
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
 * Fetch Mediavida thread page HTML in background context (typed RPC).
 * Used by thread summarizer multi-page fetching to keep network out of content scripts.
 */
export function setupMediavidaThreadFetchHandler(): void {
	onMessage('fetchThreadPageHtml', async ({ data }): Promise<ThreadPageHtmlFetchResult> => {
		const rawUrl = data?.url?.trim()
		if (!rawUrl) {
			return { success: false, error: 'URL vacía' }
		}
		if (!isAllowedMediavidaThreadUrl(rawUrl)) {
			return { success: false, error: 'URL no permitida' }
		}

		try {
			const response = await fetch(rawUrl, {
				credentials: 'include',
				headers: { Accept: 'text/html' },
			})

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}`,
					status: response.status,
					finalUrl: response.url || rawUrl,
				}
			}

			return {
				success: true,
				html: await response.text(),
				finalUrl: response.url || rawUrl,
			}
		} catch (error) {
			logger.warn('Mediavida thread page fetch failed:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Fetch failed',
				finalUrl: rawUrl,
			}
		}
	})
}

export function setupMvUserAvatarHandler(): void {
	onMessage('resolveMvUserAvatar', async ({ data }): Promise<MvUserAvatarResult> => {
		try {
			return await resolveMvUserAvatar(data.username)
		} catch (error) {
			logger.warn('Mediavida user avatar resolve failed:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' }
		}
	})

	onMessage('searchMvUsers', async ({ data }): Promise<MvUserSearchResult> => {
		try {
			return await searchMvUsers(data.query)
		} catch (error) {
			logger.warn('Mediavida user search failed:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' }
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
	tweetData.replyCount = syndicationData.replyCount
	tweetData.retweetCount = syndicationData.retweetCount
	tweetData.quoteCount = syndicationData.quoteCount
	tweetData.likeCount = syndicationData.likeCount

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
	oEmbedPayload: Record<string, unknown> | null,
	syndicationPayload: Record<string, unknown> | null,
	normalizedTweetUrl: string,
	statusId: string | null
): Promise<void> {
	const html = typeof oEmbedPayload?.html === 'string' ? oEmbedPayload.html : ''
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

			const tweetData =
				(payload ? extractTweetLiteDataFromOEmbed(payload, normalizedTweetUrl) : null) ||
				(syndicationPayload ? extractTweetLiteDataFromSyndication(syndicationPayload, normalizedTweetUrl) : null)
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
	setupMediavidaThreadFetchHandler()
	setupMvUserAvatarHandler()
	setupSteamHandler()
	setupTmdbKeyCheckHandler()
	setupTmdbRequestHandler()
	setupAniListRequestHandler()
	setupGiphyHandlers()
	setupTwitterLiteHandler()
}
