/**
 * Background Script - Entry Point
 * Orchestrates all background handlers and extension lifecycle events
 *
 * ARCHITECTURE: All network requests are handled here to:
 * 1. Avoid CORS issues in content scripts
 * 2. Keep API keys secure (never exposed to page context)
 * 3. Centralize rate limiting and error handling
 *
 * Module Structure:
 * - context-menus.ts     → Context menu creation and click handlers
 * - upload-handlers.ts   → ImgBB and Freimage image uploads
 * - api-handlers.ts      → Steam, TMDB API proxies
 * - ai-handlers.ts       → Gemini AI generation
 * - prism-highlighter.ts → Code syntax highlighting
 */

import { defineBackground, storage } from '#imports'
import { browser } from 'wxt/browser'
import { onMessage } from '@/lib/messaging'
import { createContextMenus, setupContextMenuListener } from './context-menus'
import { setupUploadHandlers } from './upload-handlers'
import { setupApiHandlers } from './api-handlers'
import { setupAiHandlers } from './ai-handlers'
import { setupIgdbHandlers } from './igdb-handlers'
import { highlightCode } from './prism-highlighter'
import { setupTwitterLiteNetworkGuard } from './twitter-lite-network-guard'
import { clearCache } from '@/services/media/cache'

/**
 * Clean up legacy API cache entries that should not persist to storage.
 * APIs like TMDB, IMDB, Steam now use memory-only cache.
 */
async function cleanupLegacyApiCache(): Promise<void> {
	// Clean caches that use the format "prefix:key"
	await Promise.all([clearCache({ prefix: 'mv-resolver' }), clearCache({ prefix: 'mv-tmdb-v2' })])

	// Clean Steam cache which uses format "steam-game-{id}" directly
	try {
		const snapshot = await storage.snapshot('local')
		const steamKeys = Object.keys(snapshot).filter(key => key.startsWith('steam-game-'))
		if (steamKeys.length > 0) {
			await Promise.all(steamKeys.map(k => storage.removeItem(`local:${k}` as `local:${string}`)))
		}
	} catch {
		// Ignore errors
	}
}

// =============================================================================
// Background Entry Point
// =============================================================================

export default defineBackground(() => {
	// ==========================================================================
	// Extension Install/Update Handler
	// ==========================================================================

	browser.runtime.onInstalled.addListener(async () => {
		// Create context menus on install/update
		await createContextMenus()

		// Clean up legacy API cache entries (now uses memory-only cache)
		await cleanupLegacyApiCache()
	})

	// ==========================================================================
	// Setup All Handlers
	// ==========================================================================

	// Context menus (save thread, hide thread, mute word)
	createContextMenus().catch(() => {
		// Ignore startup menu creation errors; onInstalled will retry on updates.
	})
	setupContextMenuListener()

	// Upload handlers (ImgBB, Freeimage)
	setupUploadHandlers()

	// API handlers (Steam, TMDB, GIPHY, options page)
	setupApiHandlers()

	// AI handlers (Gemini)
	setupAiHandlers()

	// IGDB handlers (game database)
	setupIgdbHandlers()

	// Strict Twitter Lite network guard (blocks native Twitter embeds until explicit user action)
	setupTwitterLiteNetworkGuard()

	// ==========================================================================
	// Code Highlighting Handler
	// ==========================================================================

	/**
	 * Syntax highlight code using PrismJS
	 * Keeps the heavy Prism library out of the content script bundle
	 */
	onMessage('highlightCode', async ({ data }) => {
		return await highlightCode(data.code, data.language)
	})
})
