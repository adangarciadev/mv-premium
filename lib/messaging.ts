/**
 * Messaging Protocol - Type-safe RPC between contexts
 *
 * Uses @webext-core/messaging for fully typed message passing
 * between background, content scripts, popup, and options page.
 *
 * ARCHITECTURE: All network requests go through background script
 * to avoid CORS issues and keep API keys secure.
 *
 * USAGE:
 * - Background: Import `onMessage` and register handlers
 * - Frontend: Import `sendMessage` to call background functions
 */
import { defineExtensionMessaging } from '@webext-core/messaging'
import type { SteamGameDetails, SteamBundleDetails, SteamAppSearchResult } from '@/services/api/steam'
import type { GiphyPaginatedResponse } from '@/services/api/giphy'
import type { ItadGamePriceOverview, ItadGamePrices, ItadGameSearchResult } from '@/services/api/itad'
import type { ChatMessage } from '@/types/ai'
import type { UploadAttemptInfo, UploadErrorCode, UploadProvider } from '@/lib/upload-errors'

// =============================================================================
// Response Types
// =============================================================================

export interface UploadResult {
	success: boolean
	url?: string
	deleteUrl?: string
	error?: string
	errorCode?: UploadErrorCode
	provider?: UploadProvider
	attempts?: UploadAttemptInfo[]
	/** Size in bytes (for stats tracking) */
	size?: number
}

export interface UploadPayload {
	base64: string
	fileName?: string
	mimeType?: string
	fileSize?: number
}

export interface GeminiResult {
	success: boolean
	text?: string
	error?: string
	/** The actual model that processed the request (may differ from requested due to fallback) */
	modelUsed?: string
}

export interface TweetLiteData {
	username: string
	displayName: string
	text: string
	url: string
	hasMedia?: boolean
	thumbnailUrl?: string
	isVerified?: boolean
	createdAt?: string
	replyCount?: number
	retweetCount?: number
	quoteCount?: number
	likeCount?: number
	replyTo?: {
		username: string
		displayName: string
		text: string
		url?: string
		isVerified?: boolean
		verifiedType?: string // 'Business' | 'Government' | 'None' (default blue if isVerified=true)
		createdAt?: string
		authorAvatarUrl?: string
		mediaUrls?: string[]
	}
	authorAvatarUrl?: string
	verifiedType?: string
	mediaUrls?: string[]
	hasVideo?: boolean
	videoThumbnailUrls?: string[]
	quotedTweet?: {
		username: string
		displayName: string
		text: string
		url: string
		isVerified?: boolean
		verifiedType?: string
		createdAt?: string
		authorAvatarUrl?: string
		hasMedia?: boolean
		mediaUrls?: string[]
	}
}

export interface TweetLiteResult {
	success: boolean
	data?: TweetLiteData
	error?: string
}

export interface ThreadPageHtmlFetchResult {
	success: boolean
	html?: string
	error?: string
	status?: number
	finalUrl?: string
}

export interface MvUserAvatarResult {
	success: boolean
	username?: string
	avatarUrl?: string
	error?: string
}

// =============================================================================
// Protocol Map - Define all RPC messages here
// =============================================================================

export interface AgentPageContext {
	url: string
	title: string
	selection?: string
	username?: string
	threadId?: string
}

interface ProtocolMap {
	/**
	 * Show toast in a specific tab/content script
	 * Used by background handlers (e.g. context menus) to notify users
	 */
	showToast: (data: { message: string }) => void

	/**
	 * Get context from the active content script/tab
	 */
	getPageContext: () => AgentPageContext

	/**
	 * Open the options/dashboard page
	 * @param view - Optional view path (e.g., 'drafts', 'settings')
	 */
	openOptionsPage: (view?: string) => void

	/**
	 * Rebuild extension context menus after settings changes.
	 */
	refreshContextMenus: (data?: { threadClipperSubforums?: string[] }) => boolean

	/**
	 * Fetch raw HTML for a Mediavida thread page via background script.
	 * Keeps thread-page network requests out of content scripts.
	 */
	fetchThreadPageHtml: (data: { url: string }) => ThreadPageHtmlFetchResult

	/**
	 * Resolve a Mediavida user's avatar by username via background script.
	 */
	resolveMvUserAvatar: (data: { username: string }) => MvUserAvatarResult

	/**
	 * Fetch Steam game details (CORS proxy)
	 * @param appId - Steam App ID
	 * @returns Game details or null if not found
	 */
	fetchSteamGame: (appId: number) => SteamGameDetails | null

	/**
	 * Search Steam apps by title (CORS proxy)
	 * @param data - Search query and optional result limit
	 * @returns Steam app search results
	 */
	searchSteamApps: (data: { query: string; limit?: number }) => SteamAppSearchResult[]

	/**
	 * Fetch Steam bundle details (CORS proxy)
	 * @param bundleId - Steam Bundle ID
	 * @returns Bundle details or null if not found
	 */
	fetchSteamBundle: (bundleId: number) => SteamBundleDetails | null

	/**
	 * Upload image to ImgBB via background script
	 * Background reads API key and makes the POST request
	 * @param data - Base64 image data and optional filename
	 * @returns Upload result with URL or error
	 */
	uploadImageToImgbb: (data: UploadPayload) => UploadResult

	/**
	 * Upload image to freeimage.host via background script
	 * Uses public API key - permanent storage, no user config needed
	 * @param data - Base64 image data and optional filename
	 * @returns Upload result with URL or error
	 */
	uploadImageToFreeimage: (data: UploadPayload) => UploadResult

	/**
	 * Check if TMDB API key is configured in the background script
	 * @returns true if API key is available (from .env or user config)
	 */
	hasTmdbApiKey: () => boolean

	/**
	 * Generic TMDB API request via background script
	 * Background reads API key and proxies the request
	 * @param data - Endpoint and query params
	 * @returns JSON response from TMDB
	 */
	tmdbRequest: (data: { endpoint: string; params?: Record<string, string> }) => unknown

	/**
	 * Get trending GIPHY results via background script
	 * Keeps API key and external request in service worker
	 */
	giphyTrending: (data: { offset?: number }) => GiphyPaginatedResponse

	/**
	 * Search GIPHY results via background script
	 * Keeps API key and external request in service worker
	 */
	giphySearch: (data: { query: string; offset?: number }) => GiphyPaginatedResponse

	/**
	 * Generate text with Gemini API via background script
	 * Supports full chat history with model fallback on rate limits
	 */
	generateGemini: (data: {
		apiKey: string
		model: string
		history?: ChatMessage[]
		prompt?: string
	}) => GeminiResult

	/**
	 * Syntax highlight code using PrismJS in background script
	 * Keeps the heavy Prism library out of the content script bundle
	 * @param data - Code string and language identifier
	 * @returns Highlighted HTML string
	 */
	highlightCode: (data: { code: string; language: string }) => string

	/**
	 * Check if IGDB credentials are configured in environment
	 * @returns true if Client ID and Secret are set in .env
	 */
	hasIgdbCredentials: () => boolean

	/**
	 * Generic IGDB API request via background script
	 * Background handles Twitch OAuth and proxies the request
	 * @param data - API endpoint and query body
	 * @returns JSON response from IGDB
	 */
	igdbRequest: (data: { endpoint: string; body: string }) => unknown

	/**
	 * Generic AniList GraphQL request via background script.
	 * Keeps anime/manga external requests out of content scripts.
	 */
	anilistRequest: (data: { query: string; variables?: Record<string, unknown> }) => unknown

	/**
	 * Download an AniList CDN image and rehost it through the configured image provider.
	 * Keeps cross-origin image fetching and upload credentials in the background script.
	 */
	rehostAniListImage: (data: { url: string }) => UploadResult

	/**
	 * Check if the IsThereAnyDeal public API key is configured.
	 */
	hasItadApiKey: () => boolean

	/**
	 * Search IsThereAnyDeal games by title via background script.
	 */
	itadSearchGames: (data: { query: string; results?: number }) => ItadGameSearchResult[]

	/**
	 * Fetch IsThereAnyDeal current best price and historical low snapshots.
	 */
	itadPriceOverview: (data: {
		gameIds: string[]
		country?: string
	}) => Record<string, ItadGamePriceOverview>

	/**
	 * Fetch IsThereAnyDeal full current price rows across shops.
	 */
	itadGamePrices: (data: {
		gameIds: string[]
		country?: string
		capacity?: number
	}) => Record<string, ItadGamePrices>

	/**
	 * Fetch a lightweight tweet payload (username + text) via background script.
	 * Keeps network requests out of content scripts.
	 */
	fetchTweetLiteData: (data: { tweetUrl: string }) => TweetLiteResult
}

// =============================================================================
// Export typed messaging functions
// =============================================================================

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
