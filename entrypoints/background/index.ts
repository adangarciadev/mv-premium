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
import {
	createContextMenus,
	setupContextMenuListener,
	setupContextMenuRefreshHandler,
	setupThreadClipperTrayListener,
} from './context-menus'
import { setupUploadHandlers } from './upload-handlers'
import { setupApiHandlers } from './api-handlers'
import { setupAiHandlers } from './ai-handlers'
import { setupIgdbHandlers } from './igdb-handlers'
import { setupItadHandlers } from './itad-handlers'
import { highlightCode } from './prism-highlighter'
import { setupTwitterLiteNetworkGuard } from './twitter-lite-network-guard'

/**
 * Every API cache prefix is memory-only now, so any persisted entry under
 * these prefixes is stale garbage from older versions. The worst offender was
 * IGDB upcoming-releases (~500KB per time-window key), which could exhaust
 * Firefox's 5MB storage quota on its own.
 */
const LEGACY_API_CACHE_KEY_PREFIXES = [
	'mv-cache:',
	'mv-resolver:',
	'mv-tmdb-v2:',
	'mv-igdb-v1:',
	'mv-anilist-v1:',
	'mv-anilist-image-v1:',
	// Steam cache used the format "steam-game-{id}" directly, without prefix:key
	'steam-game-',
]

/**
 * Clean up legacy API cache entries that should not persist to storage.
 * Single snapshot pass over all known cache prefixes.
 */
async function cleanupLegacyApiCache(): Promise<void> {
	try {
		const snapshot = await storage.snapshot('local')
		const staleKeys = Object.keys(snapshot).filter(key =>
			LEGACY_API_CACHE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
		)
		if (staleKeys.length > 0) {
			await Promise.all(staleKeys.map(k => storage.removeItem(`local:${k}` as `local:${string}`)))
		}
	} catch {
		// Ignore errors
	}
}

// =============================================================================
// Background Entry Point
// =============================================================================

export default defineBackground({
	persistent: {
		firefox: false,
	},
	main() {
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

		// Upload handlers (ImgBB, Freeimage)
		setupUploadHandlers()

		// Context menus (save thread, hide thread, mute word)
		try {
			createContextMenus().catch(() => {
				// Ignore startup menu creation errors; onInstalled will retry on updates.
			})
			setupContextMenuListener()
			setupContextMenuRefreshHandler()
			setupThreadClipperTrayListener()
		} catch {
			// Firefox Android can lack full contextMenus support. Keep non-menu handlers alive.
		}

		// API handlers (Steam, TMDB, GIPHY, options page)
		setupApiHandlers()

		// AI handlers (Gemini)
		setupAiHandlers()

		// IGDB handlers (game database)
		setupIgdbHandlers()

		// IsThereAnyDeal handlers (game prices)
		setupItadHandlers()

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
	},
})
