// features/user-customizations/index.ts
/**
 * User Customizations Feature
 *
 * Applies user customizations (custom nicks, colors, badges, ignore) to the forum.
 * Uses the storage module for data access.
 */

import {
	getUserCustomizations,
	watchUserCustomizations,
	type UserCustomization,
} from '@/features/user-customizations/storage'
import { cn } from '@/lib/utils'
import { MV_SELECTORS, DOM_MARKERS } from '@/constants'

// Extracted modules
import { applyGlobalStyles, NOTE_ICON_STYLES, NOTE_ICON_SVG, getBadgeStyles } from './logic/customizations-styles'
import { applyMuteToPost, applyHideToPost } from './logic/mute-placeholder'
import { filterIgnoredUserMessages, resetIgnoredMessages, resetIgnoredUsers } from './logic/message-filter'

let isApplying = false // Guard against re-entrant calls

/**
 * Applies user note icon to avatar container.
 */
function applyUserNote(avatarContainer: HTMLElement, note: string): void {
	// Force overflow visible to allow tooltip to extend outside
	avatarContainer.style.overflow = 'visible'
	avatarContainer.style.position = 'relative'

	// Check if note already exists
	if (avatarContainer.querySelector(`.${DOM_MARKERS.CLASSES.USER_NOTE}`)) return

	const noteIcon = document.createElement('div')
	noteIcon.className = DOM_MARKERS.CLASSES.USER_NOTE
	noteIcon.setAttribute('data-tooltip', note)
	noteIcon.style.cssText = NOTE_ICON_STYLES
	noteIcon.innerHTML = NOTE_ICON_SVG
	avatarContainer.appendChild(noteIcon)
}

/**
 * Applies custom badge/tag after the author link.
 */
function applyUserBadge(linkElement: HTMLAnchorElement, customization: UserCustomization): void {
	const isNativeStyle = customization.badgeStyle === 'text'
	const tagClassName = isNativeStyle ? DOM_MARKERS.CLASSES.USER_TAG_NATIVE : DOM_MARKERS.CLASSES.USER_BADGE

	// Check if already has our tag
	const existingTag = linkElement.parentElement?.querySelector(`.${tagClassName}`)
	if (existingTag) return

	const tag = document.createElement('span')

	if (isNativeStyle) {
		// Native style (span.ct)
		tag.className = cn(tagClassName, 'ct')
		tag.textContent = customization.badge!
		tag.style.color = customization.badgeColor || '#85939e'
		tag.style.fontSize = '13px'
	} else {
		// Badge style
		tag.className = DOM_MARKERS.CLASSES.USER_BADGE
		tag.textContent = customization.badge!
		tag.style.cssText = getBadgeStyles(customization.badgeColor, customization.badgeTextColor)
	}

	// Positioning: ALWAYS insert after existing .ct spans if they exist
	const parent = linkElement.parentElement
	const existingCtSpans = parent?.querySelectorAll(MV_SELECTORS.USER.NATIVE_TAG)

	if (existingCtSpans && existingCtSpans.length > 0) {
		// Insert after the LAST native .ct (not one we added)
		const lastCt = Array.from(existingCtSpans)
			.filter(
				el =>
					!el.classList.contains(DOM_MARKERS.CLASSES.USER_TAG_NATIVE) &&
					!el.classList.contains(DOM_MARKERS.CLASSES.USER_BADGE)
			)
			.pop()

		if (lastCt) {
			lastCt.insertAdjacentElement('afterend', tag)
		} else {
			linkElement.insertAdjacentElement('afterend', tag)
		}
	} else {
		linkElement.insertAdjacentElement('afterend', tag)
	}
}

/**
 * Handles ignored user logic (hide or mute).
 */
function handleIgnoredUser(linkElement: HTMLAnchorElement, username: string, customization: UserCustomization): void {
	// Robust selector for Mediavida posts/replies
	let postContainer = linkElement.closest(
		`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}, li.pm`
	) as HTMLElement
	if (!postContainer) return

	// FIX: If we matched .rep (often .post-body), check if it is inside a .post
	// This prevents double-muting since .closest() finds the innermost match first
	if (postContainer.classList.contains('rep') && !postContainer.id.startsWith('post-')) {
		const parentPost = postContainer.closest(`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}`)
		if (parentPost) {
			postContainer = parentPost as HTMLElement
		}
	}

	const ignoreType = customization.ignoreType || 'hide'

	if (ignoreType === 'hide') {
		applyHideToPost(postContainer)
	} else if (ignoreType === 'mute') {
		applyMuteToPost(username, postContainer)
	}
}

/**
 * Applies individual user customizations (nick, color, badge, note, ignore) to a specific link element.
 * Handles both the author link styling and post-level changes like highlighting or hiding.
 */
function applyUserCustomizationToLink(
	linkElement: HTMLAnchorElement,
	username: string,
	customization: UserCustomization
): void {
	// Skip if already processed
	if (linkElement.dataset.mvpCustomized === 'true') return
	linkElement.dataset.mvpCustomized = 'true'

	// Check if this link is inside .post-avatar (we don't modify those, except for notes)
	const isInAvatar = linkElement.closest(MV_SELECTORS.THREAD.POST_AVATAR)

	// Apply User Note (only in avatar)
	if (isInAvatar && customization.note) {
		applyUserNote(isInAvatar as HTMLElement, customization.note)
	}

	// Apply Post Highlight
	if (customization.highlightColor) {
		const postContainer = linkElement.closest(
			`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}`
		) as HTMLElement
		if (postContainer) {
			postContainer.style.transition = 'background-color 0.2s ease'
			postContainer.style.backgroundColor = customization.highlightColor
		}
	}

	// Apply custom nick (only in post-meta, not avatar)
	if (customization.usernameCustom && !isInAvatar) {
		if (!linkElement.dataset.mvOriginalText) {
			linkElement.dataset.mvOriginalText = linkElement.textContent || username
		}
		linkElement.title = `Original: ${username}`
		linkElement.textContent = customization.usernameCustom
	}

	// Apply color (only in post-meta, not avatar)
	if (customization.usernameColour && !isInAvatar) {
		linkElement.style.color = customization.usernameColour
		linkElement.style.setProperty('color', customization.usernameColour, 'important')
	}

	// Apply badge/tag (only in post-meta, not avatar)
	if (customization.badge && !isInAvatar) {
		applyUserBadge(linkElement, customization)
	}

	// Handle ignored users
	if (customization.isIgnored) {
		handleIgnoredUser(linkElement, username, customization)
	}
}

/**
 * Resets all customized elements so they can be re-processed.
 */
function resetCustomizedElements(): void {
	// Clean up any orphaned tags first
	document
		.querySelectorAll(`.${DOM_MARKERS.CLASSES.USER_BADGE}, .${DOM_MARKERS.CLASSES.USER_TAG_NATIVE}`)
		.forEach(el => el.remove())

	// Reset all customized elements
	document.querySelectorAll(`[${DOM_MARKERS.DATA_ATTRS.USER_CUSTOMIZED}]`).forEach(el => {
		const link = el as HTMLAnchorElement

		// 1. Reset Nickname/Text
		if (link.dataset.mvOriginalText) {
			link.textContent = link.dataset.mvOriginalText
		} else if (link.title.startsWith('Original: ')) {
			link.textContent = link.title.replace('Original: ', '')
			link.title = ''
		}

		// 2. Reset Color
		link.style.color = ''
		link.style.removeProperty('color')

		// 3. Reset Highlight
		const postContainer = link.closest(
			`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}, li.pm`
		) as HTMLElement
		if (postContainer) {
			postContainer.style.backgroundColor = ''
		}

		// 4. Reset Note & Avatar Overflow
		const avatarContainer = link.closest(MV_SELECTORS.THREAD.POST_AVATAR) as HTMLElement
		if (avatarContainer) {
			const existingNote = avatarContainer.querySelector(`.${DOM_MARKERS.CLASSES.USER_NOTE}`)
			if (existingNote) existingNote.remove()
			avatarContainer.style.overflow = ''
			avatarContainer.style.position = ''
		}

		// 5. Reset Ignored/Muted states
		if (postContainer) {
			postContainer.style.display = ''
			postContainer.classList.remove(DOM_MARKERS.CLASSES.IGNORED_USER, DOM_MARKERS.CLASSES.MUTED_USER)
			postContainer.querySelector(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`)?.remove()
			delete postContainer.dataset.mvpRevealed

			// Restore hidden content
			const wrap = (postContainer.querySelector('.wrap') || postContainer.querySelector('.pm-content')) as HTMLElement
			if (wrap) {
				wrap.style.display = ''
			} else {
				Array.from(postContainer.children).forEach(child => {
					if (child instanceof HTMLElement && !child.classList.contains(DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER)) {
						child.style.display = ''
					}
				})
			}
		}

		delete link.dataset.mvpCustomized
	})
}

/**
 * Scans the current document and applies all stored customizations to user elements.
 * Handles cleanup of previous states to support dynamic switching and re-runs.
 */
async function applyCustomizations(): Promise<void> {
	// Guard against re-entrant calls
	if (isApplying) return
	isApplying = true

	try {
		const data = await getUserCustomizations()

		// Reset all customized elements so they can be re-processed
		resetCustomizedElements()

		// Apply global role styles
		if (data.globalSettings) {
			applyGlobalStyles(data.globalSettings)
		}

		// Find all user author links
		const userElements = document.querySelectorAll<HTMLAnchorElement>(MV_SELECTORS.USER.AUTHOR_ALL)

		userElements.forEach(element => {
			const href = element.getAttribute('href') || ''
			const usernameMatch = href.match(/\/id\/([^\/\?]+)/)
			if (!usernameMatch) return

			const username = usernameMatch[1]

			// Try case-insensitive matching
			const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
			const customization = matchingKey ? data.users[matchingKey] : undefined

			if (customization) {
				applyUserCustomizationToLink(element, username, customization)
			}
		})

		// Also filter messages dropdown
		filterIgnoredUserMessages(data)
	} finally {
		isApplying = false
	}
}

/**
 * Initializes the user customizations feature.
 * Sets up initial application, storage watchers, and a MutationObserver for dynamic content.
 */
export function initUserCustomizations(): void {
	// Initial application
	applyCustomizations()

	// Listen for storage changes using WXT storage.watch()
	watchUserCustomizations(() => {
		resetIgnoredUsers()
		resetIgnoredMessages()
		applyCustomizations()
	})

	// Observe for dynamically loaded content (dropdowns, live thread posts)
	let filterTimeout: ReturnType<typeof setTimeout> | null = null
	let postProcessTimeout: ReturnType<typeof setTimeout> | null = null

	const contentObserver = new MutationObserver(mutations => {
		let hasNewPosts = false
		let hasDropdown = false

		for (const mutation of mutations) {
			if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLElement) {
						// Check for dropdowns
						const hasMessageContent =
							node.classList.contains('fly') ||
							node.classList.contains('flyout') ||
							node.querySelector('ul.mps') ||
							node.matches('ul.mps') ||
							node.closest('.flypos')

						if (hasMessageContent) {
							hasDropdown = true
						}

						// Check for new posts (live thread updates)
						const isPost =
							node.classList.contains('post') ||
							node.classList.contains('rep') ||
							(node.id && node.id.startsWith('post-'))

						const containsPosts = node.querySelector?.('.post, .rep, div[id^="post-"]')

						if (isPost || containsPosts) {
							hasNewPosts = true
						}
					}
				}
			}
		}

		// Handle dropdowns
		if (hasDropdown) {
			if (filterTimeout) clearTimeout(filterTimeout)
			filterTimeout = setTimeout(() => {
				void applyCustomizations()
			}, 150)
		}

		// Handle new posts (live threads)
		if (hasNewPosts) {
			if (postProcessTimeout) clearTimeout(postProcessTimeout)
			postProcessTimeout = setTimeout(() => {
				void applyCustomizations()
			}, 100)
		}
	})

	// Observe the entire document body for dynamic content
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

/**
 * Forces a re-application of customizations to the current page.
 */
export function reapplyUserCustomizations(): void {
	applyCustomizations()
}
