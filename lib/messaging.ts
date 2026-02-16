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
import type { SteamGameDetails, SteamBundleDetails } from '@/services/api/steam'
import type { GiphyPaginatedResponse } from '@/services/api/giphy'
import type { ChatMessage } from '@/types/ai'

// =============================================================================
// Response Types
// =============================================================================

export interface UploadResult {
	success: boolean
	url?: string
	deleteUrl?: string
	error?: string
	/** Size in bytes (for stats tracking) */
	size?: number
}

export interface GeminiResult {
	success: boolean
	text?: string
	error?: string
	/** The actual model that processed the request (may differ from requested due to fallback) */
	modelUsed?: string
}

export interface GroqResult {
	success: boolean
	text?: string
	error?: string
	/** The actual model that processed the request (may differ from requested due to fallback) */
	modelUsed?: string
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
	 * Fetch Steam game details (CORS proxy)
	 * @param appId - Steam App ID
	 * @returns Game details or null if not found
	 */
	fetchSteamGame: (appId: number) => SteamGameDetails | null

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
	uploadImageToImgbb: (data: { base64: string; fileName?: string }) => UploadResult

	/**
	 * Upload image to freeimage.host via background script
	 * Uses public API key - permanent storage, no user config needed
	 * @param data - Base64 image data and optional filename
	 * @returns Upload result with URL or error
	 */
	uploadImageToFreeimage: (data: { base64: string; fileName?: string }) => UploadResult

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
	 * Generate text with Groq API via background script
	 * Supports full chat history (OpenAI-compatible format)
	 */
	generateGroq: (data: {
		apiKey: string
		model: string
		history?: ChatMessage[]
		prompt?: string
	}) => GroqResult

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
}

// =============================================================================
// Export typed messaging functions
// =============================================================================

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
