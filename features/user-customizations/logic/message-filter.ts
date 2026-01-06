// features/user-customizations/logic/message-filter.ts
/**
 * Message filtering for ignored users.
 * Filters and hides private messages and notifications from ignored users.
 */

import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import type { UserCustomizationsData } from '../storage'

/**
 * Helper function to toggle visibility of a message item.
 */
function toggleVisibility(item: HTMLElement, isIgnored: boolean): void {
	if (isIgnored) {
		item.style.display = 'none'
		item.classList.add(DOM_MARKERS.CLASSES.IGNORED_MESSAGE)
	} else if (item.classList.contains(DOM_MARKERS.CLASSES.IGNORED_MESSAGE)) {
		item.style.display = ''
		item.classList.remove(DOM_MARKERS.CLASSES.IGNORED_MESSAGE)
	}
}

/**
 * Filters navigation dropdown messages (header flyout).
 * Selector: .flypos ul.mps li
 */
function filterDropdownMessages(ignoredUsers: Set<string>): void {
	document.querySelectorAll<HTMLElement>(MV_SELECTORS.MESSAGES.FLYOUT_LIST).forEach(item => {
		const usernameEl = item.querySelector('span.stuff strong')
		if (!usernameEl) return

		const username = usernameEl.textContent?.trim()
		if (!username) return

		toggleVisibility(item, ignoredUsers.has(username.toLowerCase()))
	})
}

/**
 * Filters sidebar conversation list on /mensajes page.
 * Finds a.message links, then gets their parent li.
 */
function filterSidebarConversations(ignoredUsers: Set<string>): void {
	document
		.querySelectorAll<HTMLAnchorElement>(`${MV_SELECTORS.MESSAGES.PM_LIST}, ${MV_SELECTORS.MESSAGES.PM_LIST_ALT}`)
		.forEach(link => {
			const item = link.closest('li') as HTMLElement | null
			if (!item) return

			const usernameEl = link.querySelector('.excerpt .pm-info strong')
			if (!usernameEl) return

			const username = usernameEl.textContent?.trim()
			if (!username) return

			toggleVisibility(item, ignoredUsers.has(username.toLowerCase()))
		})
}

/**
 * Filters individual chat messages in message threads.
 * Only li elements with class "pm" that have .wrap .pm-info a.autor.
 */
function filterChatMessages(ignoredUsers: Set<string>): void {
	document
		.querySelectorAll<HTMLElement>(`${MV_SELECTORS.MESSAGES.PM_ITEM}, ${MV_SELECTORS.MESSAGES.PM_ITEM_ALT}`)
		.forEach(item => {
			const autorLink = item.querySelector<HTMLAnchorElement>(MV_SELECTORS.MESSAGES.PM_AUTHOR)
			if (!autorLink) return

			const href = autorLink.getAttribute('href') || ''
			const hrefMatch = href.match(/\/id\/([^\/\?]+)/)
			const username = hrefMatch ? hrefMatch[1] : autorLink.textContent?.trim()

			if (!username) return

			toggleVisibility(item, ignoredUsers.has(username.toLowerCase()))
		})
}

/**
 * Creates a Set of ignored usernames for quick lookup.
 */
export function getIgnoredUsersSet(data: UserCustomizationsData): Set<string> {
	return new Set(
		Object.entries(data.users)
			.filter(([, customization]) => customization.isIgnored)
			.map(([username]) => username.toLowerCase())
	)
}

/**
 * Filters and hides private messages or notifications from ignored users.
 * Targets the navigation dropdown, message list sidebar, and individual chat items.
 */
export function filterIgnoredUserMessages(data: UserCustomizationsData): void {
	const ignoredUsers = getIgnoredUsersSet(data)
	if (ignoredUsers.size === 0) return

	filterDropdownMessages(ignoredUsers)
	filterSidebarConversations(ignoredUsers)
	filterChatMessages(ignoredUsers)
}

/**
 * Resets visibility for all ignored messages.
 * Called before re-applying customizations.
 */
export function resetIgnoredMessages(): void {
	document.querySelectorAll(`.${DOM_MARKERS.CLASSES.IGNORED_MESSAGE}`).forEach(el => {
		;(el as HTMLElement).style.display = ''
		el.classList.remove(DOM_MARKERS.CLASSES.IGNORED_MESSAGE)
	})
}

/**
 * Resets visibility for all ignored users (posts).
 */
export function resetIgnoredUsers(): void {
	document.querySelectorAll(`.${DOM_MARKERS.CLASSES.IGNORED_USER}`).forEach(el => {
		;(el as HTMLElement).style.display = ''
		el.classList.remove(DOM_MARKERS.CLASSES.IGNORED_USER)
	})
}
