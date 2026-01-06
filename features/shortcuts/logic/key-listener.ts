/**
 * Global Keyboard Shortcuts Listener
 * Handles user-defined shortcuts for navigation
 */
import { getSettings, initCrossTabSync } from '@/store/settings-store'
import { logger } from '@/lib/logger'
import { MV_SELECTORS, MV_URLS, getUserProfileUrl, getUserBookmarksUrl, STORAGE_KEYS } from '@/constants'
import { sendMessage } from '@/lib/messaging'
import { browser } from 'wxt/browser'

let shortcuts: Record<string, string | null> = {}
let username: string | null = null

// Store handler for cleanup
let keydownHandler: ((e: KeyboardEvent) => void) | null = null
let storeUnsubscribe: (() => void) | null = null

/**
 * Detects the current user's profile ID from the DOM if available.
 */
function getUsername(): string | null {
	if (username) return username
	const userLink = document.querySelector<HTMLAnchorElement>(MV_SELECTORS.USER.USER_DATA)
	username = userLink?.href?.split('/id/')[1] || null
	return username
}

/**
 * Performs navigation to the URL associated with a specific action ID.
 * @param actionId - The ID of the shortcut action
 */
function executeAction(actionId: string) {
	const user = getUsername()

	switch (actionId) {
		case 'home':
			window.location.href = '/'
			break
		case 'subforums':
			window.location.href = MV_URLS.FORUM
			break
		case 'favorite_threads':
			window.location.href = MV_URLS.FAVORITES
			break
		case 'spy':
			window.location.href = MV_URLS.SPY
			break
		case 'messages':
			window.location.href = MV_URLS.MESSAGES
			break

		// User specific actions
		case 'profile':
			if (user) window.location.href = getUserProfileUrl(user)
			break
		case 'bookmarks':
			if (user) window.location.href = getUserBookmarksUrl(user)
			break
		case 'saved':
			if (user) window.location.href = `${getUserProfileUrl(user)}/temas#guardados`
			break
		case 'pinned':
			if (user) window.location.href = `${getUserProfileUrl(user)}/temas#anclados`
			break

		// Panel & Tools
		case 'panel':
			// If already in dashboard, do nothing or maybe toggle?
			// But for now just open/focus
			sendMessage('openOptionsPage', undefined).catch(err => logger.error('Shortcut panel error:', err))
			break
		case 'new-draft':
			sendMessage('openOptionsPage', 'drafts/new').catch(err => logger.error('Shortcut new-draft error:', err))
			break
		case 'new-template':
			sendMessage('openOptionsPage', 'templates/new').catch(err => logger.error('Shortcut new-template error:', err))
			break
		case 'drafts':
			sendMessage('openOptionsPage', 'drafts').catch(err => logger.error('Shortcut drafts error:', err))
			break
		case 'templates':
			sendMessage('openOptionsPage', 'templates').catch(err => logger.error('Shortcut templates error:', err))
			break

		// Appearance
		case 'theme-toggle':
			// Use lazy import to avoid circular dependencies
			import('@/lib/theme-utils').then(({ isMVDarkMode }) => {
				const isDark = isMVDarkMode()
				const nextTheme = isDark ? 'light' : 'dark'

				// Persist
				browser.storage.local
					.set({
						[STORAGE_KEYS.THEME]: nextTheme,
						[STORAGE_KEYS.THEME_RAW]: nextTheme,
					})
					.catch(err => logger.error('Theme toggle storage error:', err))
			})
			break
	}
}

/**
 * Determines if a keyboard event should be ignored (e.g., when focus is on an input).
 */
function shouldIgnore(e: KeyboardEvent): boolean {
	// Ignore if target is input, textarea, or contenteditable
	const target = e.target as HTMLElement
	if (
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.tagName === 'SELECT' ||
		target.isContentEditable
	) {
		return true
	}

	// Ignore if modifier keys only
	if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return true

	return false
}

/**
 * Generates a standard string representation of a key combination (e.g., "Ctrl+Shift+K").
 */
function getCombo(e: KeyboardEvent): string {
	const modifiers = []
	if (e.ctrlKey) modifiers.push('Ctrl')
	if (e.altKey) modifiers.push('Alt')
	if (e.shiftKey) modifiers.push('Shift')
	if (e.metaKey) modifiers.push('Meta')

	const key = e.key.toUpperCase()
	return [...modifiers, key].join('+')
}

export async function initGlobalShortcuts() {
	// Avoid duplicate initialization
	if (keydownHandler) return

	// Initial load
	const settings = await getSettings()
	if (settings.shortcuts) {
		shortcuts = settings.shortcuts
	}

	// Listen for changes
	initCrossTabSync()

	const { useSettingsStore } = await import('@/store/settings-store')
	storeUnsubscribe = useSettingsStore.subscribe(state => {
		shortcuts = state.shortcuts
	})

	// Add listener
	keydownHandler = (e: KeyboardEvent) => {
		if (shouldIgnore(e)) return

		const combo = getCombo(e)

		// Find action for this combo
		const actionId = Object.entries(shortcuts).find(([_, s]) => s === combo)?.[0]

		if (actionId) {
			e.preventDefault()
			e.stopPropagation()
			executeAction(actionId)
		}
	}

	document.addEventListener('keydown', keydownHandler)
}

/**
 * Cleanup global shortcuts event listeners
 */
export function cleanupGlobalShortcuts(): void {
	if (keydownHandler) {
		document.removeEventListener('keydown', keydownHandler)
		keydownHandler = null
	}

	if (storeUnsubscribe) {
		storeUnsubscribe()
		storeUnsubscribe = null
	}
}
