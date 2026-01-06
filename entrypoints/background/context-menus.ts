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

	// "Guardar hilo" - appears on thread links
	browser.contextMenus.create({
		id: 'mvp-save-thread',
		title: '📌 Guardar hilo',
		contexts: ['link'],
		targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
	})

	// "Silenciar palabra" - appears when text is selected on Mediavida
	browser.contextMenus.create({
		id: 'mvp-mute-word',
		title: '🔇 Silenciar palabra',
		contexts: ['selection'],
		documentUrlPatterns: ['*://www.mediavida.com/*'],
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
