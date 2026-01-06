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
 * - upload-handlers.ts   → ImgBB and Catbox image uploads
 * - api-handlers.ts      → Steam, TMDB API proxies
 * - ai-handlers.ts       → Gemini AI generation
 * - prism-highlighter.ts → Code syntax highlighting
 */

import { defineBackground } from '#imports'
import { browser } from 'wxt/browser'
import { onMessage } from '@/lib/messaging'
import { createContextMenus, setupContextMenuListener } from './context-menus'
import { setupUploadHandlers } from './upload-handlers'
import { setupApiHandlers } from './api-handlers'
import { setupAiHandlers } from './ai-handlers'
import { highlightCode } from './prism-highlighter'

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
	})

	// ==========================================================================
	// Setup All Handlers
	// ==========================================================================

	// Context menus (save thread, ignore user, mute word)
	setupContextMenuListener()

	// Upload handlers (ImgBB, Catbox)
	setupUploadHandlers()

	// API handlers (Steam, TMDB, options page)
	setupApiHandlers()

	// AI handlers (Gemini)
	setupAiHandlers()

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
