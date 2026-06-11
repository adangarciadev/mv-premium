import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import {
	getUserCustomizations,
	saveUserCustomizations,
	watchUserCustomizations,
	type UserCustomization,
	type UserCustomizationsData,
} from '@/features/user-customizations/storage'
import { applyHideToPost, applyMuteToPost } from '@/features/user-customizations/logic/mute-placeholder'
import { showMobileLiteActionToast, teardownMobileLiteActionToast } from './action-toast'
import { getAvatarUrlFromImage } from './avatar-utils'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import {
	getCustomizationEntryForUser,
	getIgnoreTypeForUser,
	hasMeaningfulCustomizationValue,
	setUserIgnoreInData,
	type MobileLiteIgnoreType,
} from './ignore-helpers'
import { MOBILE_LITE_IGNORED_USERS_SYNC_EVENT, type MobileLiteIgnoredUsersSyncDetail } from './ignored-users-sync-event'

const POST_SELECTOR = `${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}`
const PRIMARY_POST_SELECTOR = `${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}`
const AUTHOR_SELECTORS = [
	'.post-meta a.autor[href^="/id/"]',
	'.post-header a.autor[href^="/id/"]',
	'a.autor[href^="/id/"]',
] as const

const STYLE_ID = 'mvp-mobile-lite-ignored-users-styles'
export const MOBILE_LITE_IGNORED_ATTR = 'data-mvp-mobile-lite-ignored-user'
const MOBILE_LITE_AUTHOR_ACTION_ATTR = 'data-mvp-mobile-lite-user-actions'
const MOBILE_LITE_USER_CARD_ACTIONS_ATTR = 'data-mvp-mobile-lite-user-card-actions'
const MOBILE_LITE_USER_CARD_ACTIONS_KEY_ATTR = 'data-mvp-mobile-lite-user-card-actions-key'
const USER_CARD_SELECTOR = '#user-card, .f-card'
const USER_LINK_SELECTOR = 'a.user-card[href*="/id/"], a.autor[href*="/id/"], .post-avatar a[href*="/id/"]'
const APPLY_DEBOUNCE_MS = 100
const MANUAL_IGNORE_WATCH_SUPPRESS_MS = 800
const MANUAL_IGNORE_STALE_DATA_TTL_MS = 60000
const USER_CARD_INJECTION_DELAYS_MS = [0, 50, 120, 250, 500, 900] as const

let initialized = false
let currentData: UserCustomizationsData | null = null
let unwatchUserCustomizations: (() => void) | null = null
let contentObserver: MutationObserver | null = null
let applyTimeout: ReturnType<typeof setTimeout> | null = null
let documentUserCardClickListenerAttached = false
let mutePlaceholderGuardAttached = false
let syncEventListenerAttached = false
let suppressWatchUntil = 0
const recentManualIgnoreChanges = new Map<
	string,
	{
		storageKey: string
		ignoreType: MobileLiteIgnoreType | null
		expiresAt: number
	}
>()

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

function normalizeUsernameKey(username: string): string {
	return username.toLowerCase()
}

function rememberManualIgnoreChange(storageKey: string, ignoreType: MobileLiteIgnoreType | null): void {
	const now = Date.now()
	recentManualIgnoreChanges.set(normalizeUsernameKey(storageKey), {
		storageKey,
		ignoreType,
		expiresAt: now + MANUAL_IGNORE_STALE_DATA_TTL_MS,
	})
}

function pruneExpiredManualIgnoreChanges(now = Date.now()): void {
	recentManualIgnoreChanges.forEach((change, key) => {
		if (change.expiresAt <= now) {
			recentManualIgnoreChanges.delete(key)
		}
	})
}

function hasRecentManualIgnoreConflict(data: UserCustomizationsData): boolean {
	pruneExpiredManualIgnoreChanges()

	for (const change of recentManualIgnoreChanges.values()) {
		if (getIgnoreTypeForUser(data, change.storageKey) !== change.ignoreType) {
			return true
		}

		recentManualIgnoreChanges.delete(normalizeUsernameKey(change.storageKey))
	}

	return false
}

function getRecentManualIgnoreChangeForUser(
	data: UserCustomizationsData,
	username: string
): { storageKey: string; ignoreType: MobileLiteIgnoreType | null; expiresAt: number } | undefined {
	pruneExpiredManualIgnoreChanges()

	const entry = getCustomizationEntryForUser(data, username)
	return (
		recentManualIgnoreChanges.get(normalizeUsernameKey(entry?.storageKey ?? username)) ??
		recentManualIgnoreChanges.get(normalizeUsernameKey(username))
	)
}

function getEffectiveCustomizationEntryForUser(
	data: UserCustomizationsData,
	username: string
): { storageKey: string; customization: UserCustomization } | null {
	const entry = getCustomizationEntryForUser(data, username)
	const recentChange = getRecentManualIgnoreChangeForUser(data, username)
	if (!recentChange) return entry

	const storageKey = entry?.storageKey ?? recentChange.storageKey
	const existing = entry?.customization ?? {}
	if (recentChange.ignoreType) {
		return {
			storageKey,
			customization: {
				...existing,
				isIgnored: true,
				ignoreType: recentChange.ignoreType,
			},
		}
	}

	const { isIgnored: _isIgnored, ignoreType: _ignoreType, ...rest } = existing
	if (!hasMeaningfulCustomizationValue(rest)) return null

	return {
		storageKey,
		customization: rest,
	}
}

function getEffectiveCustomizationForUser(data: UserCustomizationsData, username: string): UserCustomization | undefined {
	return getEffectiveCustomizationEntryForUser(data, username)?.customization
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

		[${MOBILE_LITE_USER_CARD_ACTIONS_ATTR}="true"] {
			clear: both;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 8px;
			width: 100%;
			box-sizing: border-box;
			margin-top: 10px;
			padding: 10px 0 0;
			border-top: 1px solid rgba(255, 255, 255, 0.12);
			background: transparent;
		}

		[${MOBILE_LITE_USER_CARD_ACTIONS_ATTR}="true"] .mvp-mobile-lite-user-card-action-active {
			background: rgba(208, 109, 0, 0.28) !important;
			color: #fff !important;
		}

		[${MOBILE_LITE_USER_CARD_ACTIONS_ATTR}="true"] .btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			width: 100%;
			box-sizing: border-box;
			margin: 0 !important;
			white-space: nowrap;
		}
	`
	document.head.appendChild(style)
}

function getPrimaryAuthorLink(post: HTMLElement): HTMLAnchorElement | null {
	for (const selector of AUTHOR_SELECTORS) {
		const authorLink = post.querySelector<HTMLAnchorElement>(selector)
		if (authorLink) return authorLink
	}

	return null
}

function isMobileLitePostContainer(element: HTMLElement): boolean {
	if (!element.matches(POST_SELECTOR)) return false

	if (element.matches(MV_SELECTORS.THREAD.POST_DIV) && element.querySelector(PRIMARY_POST_SELECTOR)) {
		return false
	}

	return true
}

function createUserCardActionButton(
	label: string,
	iconClass: string,
	isActive: boolean,
	onClick: () => void | Promise<void>
): HTMLButtonElement {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = `btn btn-large${isActive ? ' mvp-mobile-lite-user-card-action-active' : ''}`
	button.innerHTML = `<i class="fa ${iconClass}" aria-hidden="true"></i><span>${label}</span>`
	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		void onClick()
	})
	return button
}

function getMobileLiteUserCardUsername(card: HTMLElement): string | null {
	const usernameLink = card.querySelector<HTMLAnchorElement>(
		'.user-info h4 a[href*="/id/"], .user-info a[href*="/id/"], h4 a[href*="/id/"], a[href*="/id/"]'
	)
	if (usernameLink) return getUsernameFromAuthorLink(usernameLink)

	const heading = card.querySelector<HTMLElement>('.user-info h4, h4')
	const username = heading?.textContent?.trim()
	return username || null
}

function getMobileLiteUserCardAvatarUrl(card: HTMLElement): string | undefined {
	const avatar = card.querySelector<HTMLImageElement>(
		'.user-info img.avatar, .user-info img, .post-avatar img, img.avatar, img'
	)
	return getAvatarUrlFromImage(avatar)
}

function injectMobileLiteUserCardActions(card: HTMLElement, data: UserCustomizationsData): void {
	const username = getMobileLiteUserCardUsername(card)
	if (!username) return
	if (!card.querySelector('.user-info, .user-controls')) return

	const avatarUrl = getMobileLiteUserCardAvatarUrl(card)
	const customizationEntry = getEffectiveCustomizationEntryForUser(data, username)
	const storageKey = customizationEntry?.storageKey ?? username
	const customization = customizationEntry?.customization
	const isHidden = Boolean(customization?.isIgnored && (customization.ignoreType || 'hide') === 'hide')
	const isMuted = Boolean(customization?.isIgnored && customization.ignoreType === 'mute')
	const actionsKey = `${storageKey.toLowerCase()}:${isMuted ? 'mute' : isHidden ? 'hide' : 'none'}`
	const existingActions = card.querySelector<HTMLElement>(`[${MOBILE_LITE_USER_CARD_ACTIONS_ATTR}="true"]`)
	if (existingActions?.getAttribute(MOBILE_LITE_USER_CARD_ACTIONS_KEY_ATTR) === actionsKey) return

	existingActions?.remove()

	const actions = document.createElement('div')
	actions.setAttribute(MOBILE_LITE_USER_CARD_ACTIONS_ATTR, 'true')
	actions.setAttribute(MOBILE_LITE_USER_CARD_ACTIONS_KEY_ATTR, actionsKey)
	actions.append(
		createUserCardActionButton(isMuted ? 'Silenciado' : 'Silenciar', 'fa-user-times', isMuted, () =>
			setMobileLiteUserIgnore(storageKey, isMuted ? null : 'mute', avatarUrl)
		),
		createUserCardActionButton(isHidden ? 'Oculto' : 'Ocultar', 'fa-eye-slash', isHidden, () =>
			setMobileLiteUserIgnore(storageKey, isHidden ? null : 'hide', avatarUrl)
		)
	)

	card.appendChild(actions)
}

function injectVisibleMobileLiteUserCards(data: UserCustomizationsData): void {
	document.querySelectorAll<HTMLElement>(USER_CARD_SELECTOR).forEach(card => {
		injectMobileLiteUserCardActions(card, data)
	})
}

function dismissVisibleMobileLiteUserCards(): void {
	document.querySelectorAll<HTMLElement>(USER_CARD_SELECTOR).forEach(card => {
		card.remove()
	})
}

function handleMutePlaceholderPointer(event: Event): void {
	const target = event.target
	if (!(target instanceof Element)) return
	if (!target.closest(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`)) return

	event.stopPropagation()
}

function ensureMutePlaceholderGuard(): void {
	if (mutePlaceholderGuardAttached) return

	document.addEventListener('click', handleMutePlaceholderPointer)
	document.addEventListener('touchstart', handleMutePlaceholderPointer)
	mutePlaceholderGuardAttached = true
}

function scheduleMobileLiteUserCardInjection(data: UserCustomizationsData): void {
	for (const delay of USER_CARD_INJECTION_DELAYS_MS) {
		window.setTimeout(() => {
			if (!isMobileLiteIgnoredUsersAllowed()) return
			injectVisibleMobileLiteUserCards(data)
		}, delay)
	}
}

function handleDocumentUserCardClick(event: MouseEvent): void {
	if (!currentData || !isMobileLiteIgnoredUsersAllowed()) return
	const target = event.target
	if (!(target instanceof Element)) return
	if (!target.closest(USER_LINK_SELECTOR)) return

	scheduleMobileLiteUserCardInjection(currentData)
}

function ensureDocumentUserCardClickListener(): void {
	if (documentUserCardClickListenerAttached) return

	document.addEventListener('click', handleDocumentUserCardClick, true)
	documentUserCardClickListenerAttached = true
}

function updateMobileLiteAuthorActionState(authorLink: HTMLAnchorElement, username: string, data: UserCustomizationsData): void {
	const customization = getEffectiveCustomizationForUser(data, username)
	if (customization?.isIgnored) {
		authorLink.title = `Filtro MVP activo: ${(customization.ignoreType || 'hide') === 'mute' ? 'silenciado' : 'oculto'}`
		return
	}

	authorLink.removeAttribute('title')
}

function injectMobileLiteAuthorAction(post: HTMLElement, data: UserCustomizationsData): void {
	const authorLink = getPrimaryAuthorLink(post)
	if (!authorLink) return

	const username = getUsernameFromAuthorLink(authorLink)
	if (!username) return

	if (authorLink.getAttribute(MOBILE_LITE_AUTHOR_ACTION_ATTR) === 'true') {
		updateMobileLiteAuthorActionState(authorLink, username, data)
		return
	}

	authorLink.setAttribute(MOBILE_LITE_AUTHOR_ACTION_ATTR, 'true')
	authorLink.addEventListener('click', () => {
		if (!isMobileLiteIgnoredUsersAllowed()) return
		scheduleMobileLiteUserCardInjection(currentData ?? data)
	})
	updateMobileLiteAuthorActionState(authorLink, username, data)
}

function resetMobileLiteIgnoredUsers(): void {
	const postsToReset = new Set<HTMLElement>()
	document
		.querySelectorAll<HTMLElement>(
			`[${MOBILE_LITE_IGNORED_ATTR}], .${DOM_MARKERS.CLASSES.MUTED_USER}, .${DOM_MARKERS.CLASSES.IGNORED_USER}`
		)
		.forEach(post => {
			postsToReset.add(post)
		})
	document.querySelectorAll<HTMLElement>(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`).forEach(placeholder => {
		const post = placeholder.closest<HTMLElement>(POST_SELECTOR)
		if (post) postsToReset.add(post)
	})

	postsToReset.forEach(post => {
		post.removeAttribute(MOBILE_LITE_IGNORED_ATTR)
		post.style.display = ''
		post.classList.remove(DOM_MARKERS.CLASSES.IGNORED_USER, DOM_MARKERS.CLASSES.MUTED_USER)
		post.querySelectorAll(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`).forEach(placeholder => placeholder.remove())
		delete post.dataset.mvpHasPlaceholder
		delete post.dataset.mvpRevealed

		const wrap = (post.querySelector('.wrap') || post.querySelector('.pm-content')) as HTMLElement | null
		if (wrap) {
			wrap.style.display = ''
		} else {
			Array.from(post.children).forEach(child => {
				if (child instanceof HTMLElement && !child.classList.contains(DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER)) {
					child.style.display = ''
				}
			})
		}
	})
}

export function applyMobileLiteIgnoredUsers(data: UserCustomizationsData, root: ParentNode = document): void {
	injectMobileLiteIgnoredUsersStyles()

	root.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach(post => {
		if (!isMobileLitePostContainer(post)) return

		const username = getMobileLitePostAuthor(post)
		if (!username) return

		injectMobileLiteAuthorAction(post, data)

		const customization = getEffectiveCustomizationForUser(data, username)
		if (!customization?.isIgnored) return

		post.setAttribute(MOBILE_LITE_IGNORED_ATTR, 'true')

		if ((customization.ignoreType || 'hide') === 'mute') {
			applyMuteToPost(username, post)
			return
		}

		applyHideToPost(post)
	})

	injectVisibleMobileLiteUserCards(data)
}

export function syncMobileLiteIgnoredUsers(data: UserCustomizationsData): void {
	currentData = data
	resetMobileLiteIgnoredUsers()
	if (!isMobileLiteIgnoredUsersAllowed()) return
	applyMobileLiteIgnoredUsers(data)
}

export function markMobileLiteIgnoredUsersManualChange(storageKey: string, ignoreType: MobileLiteIgnoreType | null): void {
	rememberManualIgnoreChange(storageKey, ignoreType)
	suppressWatchUntil = Date.now() + MANUAL_IGNORE_WATCH_SUPPRESS_MS
}

function handleMobileLiteIgnoredUsersSync(event: Event): void {
	const detail = event instanceof CustomEvent ? (event.detail as MobileLiteIgnoredUsersSyncDetail | undefined) : undefined
	if (!detail?.data) return
	if (detail.manualChange) {
		markMobileLiteIgnoredUsersManualChange(detail.manualChange.storageKey, detail.manualChange.ignoreType)
	}
	syncMobileLiteIgnoredUsers(detail.data)
}

function ensureMobileLiteIgnoredUsersSyncListener(): void {
	if (syncEventListenerAttached) return

	window.addEventListener(MOBILE_LITE_IGNORED_USERS_SYNC_EVENT, handleMobileLiteIgnoredUsersSync)
	syncEventListenerAttached = true
}

export async function setMobileLiteUserIgnore(
	username: string,
	ignoreType: MobileLiteIgnoreType | null,
	avatarUrl?: string
): Promise<void> {
	if (!isMobileLiteIgnoredUsersAllowed()) return

	const data = await getUserCustomizations()
	const { storageKey } = setUserIgnoreInData(data, username, ignoreType)
	if (ignoreType && avatarUrl) {
		data.users[storageKey] = { ...data.users[storageKey], avatarUrl }
	}

	markMobileLiteIgnoredUsersManualChange(storageKey, ignoreType)
	syncMobileLiteIgnoredUsers(data)
	dismissVisibleMobileLiteUserCards()
	showUserIgnoreToast(username, ignoreType)
	await saveUserCustomizations(data)
}

function showUserIgnoreToast(username: string, ignoreType: MobileLiteIgnoreType | null): void {
	if (ignoreType === 'mute') {
		showMobileLiteActionToast(`${username} ha sido silenciado`, 'fa-user-times')
		return
	}
	if (ignoreType === 'hide') {
		showMobileLiteActionToast(`${username} ha sido ocultado`, 'fa-eye-slash')
		return
	}
	showMobileLiteActionToast(`${username} vuelve a ser visible`, 'fa-eye')
}

function hasUserCardContent(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation =>
		(mutation.target instanceof HTMLElement &&
			Boolean(mutation.target.closest(USER_CARD_SELECTOR)) &&
			!mutation.target.hasAttribute(MOBILE_LITE_USER_CARD_ACTIONS_ATTR)) ||
		Array.from(mutation.addedNodes).some(node => {
			if (!(node instanceof HTMLElement)) return false
			return node.matches(USER_CARD_SELECTOR) || Boolean(node.querySelector(USER_CARD_SELECTOR))
		})
	)
}

function hasRelevantAddedContent(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation =>
		Array.from(mutation.addedNodes).some(node => {
			if (!(node instanceof HTMLElement)) return false
			return isMobileLitePostContainer(node) || Boolean(Array.from(node.querySelectorAll<HTMLElement>(POST_SELECTOR)).some(isMobileLitePostContainer))
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
	ensureDocumentUserCardClickListener()
	ensureMutePlaceholderGuard()
	ensureMobileLiteIgnoredUsersSyncListener()

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
		if (Date.now() < suppressWatchUntil) return
		if (hasRecentManualIgnoreConflict(data)) return

		currentData = data
		if (!isMobileLiteIgnoredUsersAllowed()) return

		resetMobileLiteIgnoredUsers()
		applyMobileLiteIgnoredUsers(data)
	})

	contentObserver = new MutationObserver(mutations => {
		if (hasRelevantAddedContent(mutations)) {
			scheduleApplyCurrentData()
		}

		if (currentData && hasUserCardContent(mutations)) {
			injectVisibleMobileLiteUserCards(currentData)
		}
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

	if (documentUserCardClickListenerAttached) {
		document.removeEventListener('click', handleDocumentUserCardClick, true)
		documentUserCardClickListenerAttached = false
	}

	if (mutePlaceholderGuardAttached) {
		document.removeEventListener('click', handleMutePlaceholderPointer)
		document.removeEventListener('touchstart', handleMutePlaceholderPointer)
		mutePlaceholderGuardAttached = false
	}

	if (syncEventListenerAttached) {
		window.removeEventListener(MOBILE_LITE_IGNORED_USERS_SYNC_EVENT, handleMobileLiteIgnoredUsersSync)
		syncEventListenerAttached = false
	}

	unwatchUserCustomizations?.()
	unwatchUserCustomizations = null

	resetMobileLiteIgnoredUsers()
	teardownMobileLiteActionToast()
	document.getElementById(STYLE_ID)?.remove()

	currentData = null
	recentManualIgnoreChanges.clear()
	suppressWatchUntil = 0
	initialized = false
}
