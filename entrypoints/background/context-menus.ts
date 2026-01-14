/**
 * Context Menus Module
 * Handles creation and event handling for browser context menus
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { saveThread, type SavedThread } from '@/features/saved-threads/logic/storage'

// =============================================================================
// Context Menu Creation
// =============================================================================

/**
 * Create all context menu items
 */
export async function createContextMenus(): Promise<void> {
	// Remove existing menus first (for updates)
	await browser.contextMenus.removeAll()

	// Get current settings to check enabled features
	const rawSettings = await storage.getItem<string>(`local:${STORAGE_KEYS.SETTINGS}`)
	let saveThreadEnabled = true // Default to true

	if (rawSettings) {
		try {
			const parsed = JSON.parse(rawSettings)
			// state.saveThreadEnabled might be undefined if key doesn't exist yet, default to true
			if (parsed.state?.saveThreadEnabled === false) {
				saveThreadEnabled = false
			}
		} catch {
			// Ignore parse error, use default
		}
	}

	// "Guardar hilo" - ONLY if enabled
	if (saveThreadEnabled) {
		browser.contextMenus.create({
			id: 'mvp-save-thread',
			title: '📌  Guardar hilo',
			contexts: ['link'],
			targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
		})
	}

	// "Silenciar palabra" - appears when text is selected on Mediavida
	// This is core functionality (muted words) but could be toggled too if requested.
	// For now keeping it always available as it's the primary way to add muted words.
	browser.contextMenus.create({
		id: 'mvp-mute-word',
		title: '🔇 Silenciar palabra',
		contexts: ['selection'],
		documentUrlPatterns: ['*://www.mediavida.com/*'],
	})
}

/**
 * Watch for settings changes to update context menus dynamically
 */
export function initContextMenuWatcher(): void {
	storage.watch<string>(`local:${STORAGE_KEYS.SETTINGS}`, (newValue, oldValue) => {
		if (!newValue) return

		try {
			const newSettings = JSON.parse(newValue)
			const oldSettings = oldValue ? JSON.parse(oldValue) : {}

			// Only update if the relevant setting changed
			if (newSettings.state?.saveThreadEnabled !== oldSettings.state?.saveThreadEnabled) {
				createContextMenus().catch(err => logger.error('Failed to update context menus:', err))
			}
		} catch (error) {
			logger.warn('Error watching settings for context menus:', error)
		}
	})
}

// =============================================================================
// Context Menu Click Handler
// =============================================================================

/**
 * Setup context menu click listener
 */
export function setupContextMenuListener(): void {
	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		const { menuItemId, linkUrl, selectionText } = info

		switch (menuItemId) {
			case 'mvp-save-thread':
				if (linkUrl) await handleSaveThread(linkUrl, tab?.id)
				break
			case 'mvp-mute-word':
				if (selectionText) await handleMuteWord(selectionText, tab?.id)
				break
		}
	})
}

// =============================================================================
// Handler Functions
// =============================================================================

/**
 * Save a thread from context menu
 */
async function handleSaveThread(url: string, tabId?: number): Promise<void> {
	try {
		// Parse thread URL: /foro/subforum/title-123456
		const match = url.match(/mediavida\.com(\/foro\/([^/]+)\/([^/?#]+))/)
		if (!match) {
			notifyTab(tabId, '❌ URL de hilo no válida')
			return
		}

		const [, threadPath, subforum, slug] = match

		// Clean path (remove page number if present)
		const cleanPath = threadPath.replace(/\/\d+$/, '')

		// Extract title from slug (replace dashes with spaces, capitalize)
		const titleFromSlug = slug
			.replace(/-\d+$/, '') // Remove ID suffix
			.replace(/-/g, ' ')
			.replace(/\b\w/g, c => c.toUpperCase())

		const thread: SavedThread = {
			id: cleanPath,
			title: titleFromSlug,
			subforum: subforum,
			subforumId: `/foro/${subforum}`,
			savedAt: Date.now(),
		}

		await saveThread(thread)
		notifyTab(tabId, '✅ Hilo guardado')
	} catch (error) {
		logger.error('Error saving thread:', error)
		notifyTab(tabId, '❌ Error al guardar')
	}
}

/**
 * Add a word/phrase to the muted words list
 */
async function handleMuteWord(word: string, tabId?: number): Promise<void> {
	try {
		// Normalize the word (lowercase, trimmed)
		const normalizedWord = word.trim().toLowerCase()

		if (!normalizedWord) {
			notifyTab(tabId, '❌ Selección vacía')
			return
		}

		// Validation: Single words only
		if (/\s/.test(normalizedWord)) {
			notifyTab(tabId, '❌ Solo se pueden silenciar palabras sueltas')
			return
		}

		if (normalizedWord.length > 20) {
			notifyTab(tabId, '❌ Selección demasiado larga (máx. 20)')
			return
		}

		// Read current settings from storage
		const raw = await storage.getItem<string>(`local:${STORAGE_KEYS.SETTINGS}`)
		let settings: { state?: { mutedWords?: string[]; mutedWordsEnabled?: boolean } } = {}

		if (raw) {
			try {
				settings = JSON.parse(raw)
			} catch {
				settings = {}
			}
		}

		const currentWords = settings.state?.mutedWords || []

		// Check if already muted
		if (currentWords.includes(normalizedWord)) {
			notifyTab(tabId, `ℹ️ "${normalizedWord}" ya está silenciada`)
			return
		}

		// Add the word
		const newWords = [...currentWords, normalizedWord]

		// Update settings
		const newSettings = {
			...settings,
			state: {
				...settings.state,
				mutedWords: newWords,
				mutedWordsEnabled: true, // Auto-enable when adding words
			},
		}

		await storage.setItem(`local:${STORAGE_KEYS.SETTINGS}`, JSON.stringify(newSettings))

		notifyTab(tabId, `🔇 "${normalizedWord}" silenciada`)

		// Optionally reload the tab so the word gets filtered immediately
		if (tabId) {
			try {
				await browser.tabs.reload(tabId)
			} catch {
				// Ignore reload errors
			}
		}
	} catch (error) {
		logger.error('Error muting word:', error)
		notifyTab(tabId, '❌ Error al silenciar palabra')
	}
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Send a notification to a tab (shows as a toast via content script)
 */
function notifyTab(tabId: number | undefined, message: string): void {
	if (!tabId) return
	browser.tabs
		.sendMessage(tabId, {
			type: 'MVP_TOAST',
			message,
		})
		.catch(() => {
			// Tab might not have content script, ignore
		})
}
