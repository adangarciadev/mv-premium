/**
 * Context Menus Module
 * Handles creation and event handling for browser context menus
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'
import { saveThreadFromUrl } from '@/features/saved-threads/logic/storage'
import { hideThreadFromUrl, isThreadHidden } from '@/features/hidden-threads/logic/storage'
import { sendMessage } from '@/lib/messaging'

const CONTEXT_MENU_IDS = {
	SAVE_THREAD: 'mvp-save-thread',
	HIDE_THREAD: 'mvp-hide-thread',
	MUTE_WORD: 'mvp-mute-word',
} as const

// =============================================================================
// Context Menu Creation
// =============================================================================

/**
 * Create all context menu items
 */
export async function createContextMenus(): Promise<void> {
	// Remove existing menus first (for updates)
	await browser.contextMenus.removeAll()

	// "Guardar hilo" - always available from context menu
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.SAVE_THREAD,
		title: '📌  Guardar hilo',
		contexts: ['link'],
		targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
	})

	// "Ocultar hilo" - always available from context menu
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.HIDE_THREAD,
		title: '🙈  Ocultar hilo',
		contexts: ['link'],
		targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
	})

	// "Silenciar palabra" - appears when text is selected on Mediavida
	// This is core functionality (muted words) but could be toggled too if requested.
	// For now keeping it always available as it's the primary way to add muted words.
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.MUTE_WORD,
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
			case CONTEXT_MENU_IDS.SAVE_THREAD:
				if (linkUrl) await handleSaveThread(linkUrl, tab?.id)
				break
			case CONTEXT_MENU_IDS.HIDE_THREAD:
				if (linkUrl) await handleHideThread(linkUrl, tab?.id)
				break
			case CONTEXT_MENU_IDS.MUTE_WORD:
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
		const savedThread = await saveThreadFromUrl(url)
		if (!savedThread) {
			notifyTab(tabId, '❌ URL de hilo no válida')
			return
		}
		notifyTab(tabId, '✅ Hilo guardado')
	} catch (error) {
		logger.error('Error saving thread:', error)
		notifyTab(tabId, '❌ Error al guardar')
	}
}

/**
 * Hide a thread from context menu
 */
async function handleHideThread(url: string, tabId?: number): Promise<void> {
	try {
		const alreadyHidden = await isThreadHidden(url)
		if (alreadyHidden) {
			notifyTab(tabId, 'ℹ️ El hilo ya estaba oculto')
			return
		}

		const hiddenThread = await hideThreadFromUrl(url)
		if (!hiddenThread) {
			notifyTab(tabId, '❌ URL de hilo no válida')
			return
		}

		notifyTab(tabId, '🙈 Hilo ocultado')
	} catch (error) {
		logger.error('Error hiding thread:', error)
		notifyTab(tabId, '❌ Error al ocultar hilo')
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
	sendMessage('showToast', { message }, tabId).catch(() => {
		// Tab might not have content script, ignore
	})
}
