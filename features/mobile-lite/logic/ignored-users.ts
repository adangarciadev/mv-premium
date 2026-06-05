import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { getUserCustomizations, watchUserCustomizations, type UserCustomization, type UserCustomizationsData } from '@/features/user-customizations/storage'
import { applyHideToPost, applyMuteToPost } from '@/features/user-customizations/logic/mute-placeholder'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'

const POST_SELECTOR = `${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}`
const AUTHOR_SELECTORS = [
	'.post-meta a.autor[href^="/id/"]',
	'.post-header a.autor[href^="/id/"]',
	'a.autor[href^="/id/"]',
] as const

const STYLE_ID = 'mvp-mobile-lite-ignored-users-styles'
const MOBILE_LITE_IGNORED_ATTR = 'data-mvp-mobile-lite-ignored-user'
const APPLY_DEBOUNCE_MS = 100

let initialized = false
let currentData: UserCustomizationsData | null = null
let unwatchUserCustomizations: (() => void) | null = null
let contentObserver: MutationObserver | null = null
let applyTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteIgnoredUsersAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function decodeUsername(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function getUsernameFromAuthorLink(link: HTMLAnchorElement): string | null {
	const href = link.getAttribute('href') || ''
	const usernameMatch = href.match(/\/id\/([^/?#]+)/)
	return usernameMatch?.[1] ? decodeUsername(usernameMatch[1]) : null
}

export function getMobileLitePostAuthor(post: HTMLElement): string | null {
	for (const selector of AUTHOR_SELECTORS) {
		const authorLink = post.querySelector<HTMLAnchorElement>(selector)
		if (!authorLink) continue

		const username = getUsernameFromAuthorLink(authorLink)
		if (username) return username
	}

	return null
}

function getCustomizationForUser(data: UserCustomizationsData, username: string): UserCustomization | undefined {
	const directCustomization = data.users[username]
	if (directCustomization) return directCustomization

	const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
	return matchingKey ? data.users[matchingKey] : undefined
}

function injectMobileLiteIgnoredUsersStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		.${DOM_MARKERS.CLASSES.MUTED_USER} {
			position: relative !important;
			min-height: auto !important;
		}

		.${DOM_MARKERS.CLASSES.MUTED_USER} > *:not(.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}) {
			display: none !important;
		}

		.${DOM_MARKERS.CLASSES.MUTED_USER} .post-avatar,
		.${DOM_MARKERS.CLASSES.MUTED_USER} .wrap,
		.${DOM_MARKERS.CLASSES.MUTED_USER} .post-contents,
		.${DOM_MARKERS.CLASSES.MUTED_USER} .pm-content {
			display: none !important;
		}
	`
	document.head.appendChild(style)
}

function resetMobileLiteIgnoredUsers(): void {
	document.querySelectorAll<HTMLElement>(`[${MOBILE_LITE_IGNORED_ATTR}]`).forEach(post => {
		post.removeAttribute(MOBILE_LITE_IGNORED_ATTR)
		post.style.display = ''
		post.classList.remove(DOM_MARKERS.CLASSES.IGNORED_USER, DOM_MARKERS.CLASSES.MUTED_USER)
		post.querySelectorAll(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`).forEach(placeholder => placeholder.remove())
		delete post.dataset.mvpHasPlaceholder
		delete post.dataset.mvpRevealed
	})
}

export function applyMobileLiteIgnoredUsers(data: UserCustomizationsData, root: ParentNode = document): void {
	injectMobileLiteIgnoredUsersStyles()

	root.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach(post => {
		const username = getMobileLitePostAuthor(post)
		if (!username) return

		const customization = getCustomizationForUser(data, username)
		if (!customization?.isIgnored) return

		post.setAttribute(MOBILE_LITE_IGNORED_ATTR, 'true')

		if ((customization.ignoreType || 'hide') === 'mute') {
			applyMuteToPost(username, post)
			return
		}

		applyHideToPost(post)
	})
}

function hasRelevantAddedContent(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation =>
		Array.from(mutation.addedNodes).some(node => {
			if (!(node instanceof HTMLElement)) return false
			return node.matches(POST_SELECTOR) || Boolean(node.querySelector(POST_SELECTOR))
		})
	)
}

function scheduleApplyCurrentData(): void {
	if (!currentData) return
	if (applyTimeout) clearTimeout(applyTimeout)

	applyTimeout = setTimeout(() => {
		applyTimeout = null
		if (!currentData || !isMobileLiteIgnoredUsersAllowed()) return
		applyMobileLiteIgnoredUsers(currentData)
	}, APPLY_DEBOUNCE_MS)
}

export function initMobileLiteIgnoredUsers(): void {
	if (!isMobileLiteIgnoredUsersAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true

	getUserCustomizations()
		.then(data => {
			currentData = data
			if (!isMobileLiteIgnoredUsersAllowed()) return
			applyMobileLiteIgnoredUsers(data)
		})
		.catch(error => {
			logger.error('Error initializing Mobile Lite ignored users:', error)
		})

	unwatchUserCustomizations = watchUserCustomizations(data => {
		currentData = data
		if (!isMobileLiteIgnoredUsersAllowed()) return

		resetMobileLiteIgnoredUsers()
		applyMobileLiteIgnoredUsers(data)
	})

	contentObserver = new MutationObserver(mutations => {
		if (!hasRelevantAddedContent(mutations)) return
		scheduleApplyCurrentData()
	})
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLiteIgnoredUsers(): void {
	if (applyTimeout) {
		clearTimeout(applyTimeout)
		applyTimeout = null
	}

	contentObserver?.disconnect()
	contentObserver = null

	unwatchUserCustomizations?.()
	unwatchUserCustomizations = null

	resetMobileLiteIgnoredUsers()
	document.getElementById(STYLE_ID)?.remove()

	currentData = null
	initialized = false
}
