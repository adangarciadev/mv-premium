import { DOM_MARKERS } from '@/constants'
import { extractThreadCreatorUsernameFromRow, extractThreadPathFromRow } from '@/features/hidden-threads/logic/thread-utils'
import {
	extractIgnoredHiddenUsernames,
	getUserCustomizations,
	watchUserCustomizations,
	type UserCustomizationsData,
} from '@/features/user-customizations/storage'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { useSettingsStore } from '@/store/settings-store'

const STYLE_ID = 'mvp-mobile-lite-ignored-user-threads-styles'
const THREAD_ROWS_SELECTOR = 'tbody#temas tr, table#temas tbody tr'
const HIDDEN_BY_IGNORED_AUTHOR_ATTR = 'data-mvp-mobile-lite-hidden-ignored-author'
const APPLY_DEBOUNCE_MS = 100

let initialized = false
let ignoredHiddenUsernames = new Set<string>()
let unwatchUserCustomizations: (() => void) | null = null
let contentObserver: MutationObserver | null = null
let applyTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteIgnoredUserThreadsAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function areIgnoredAuthorThreadsHidden(): boolean {
	return useSettingsStore.getState().hideIgnoredUserThreadsEnabled !== false
}

function normalizeUsername(username: string): string {
	return username.trim().toLowerCase()
}

export function isNormalMobileLiteSubforumPath(pathname: string): boolean {
	if (!pathname.startsWith('/foro/')) return false
	if (pathname.startsWith('/foro/spy')) return false

	const segments = pathname.split('/').filter(Boolean)
	if (segments.length < 2) return false

	const maybeThreadSlug = segments[2]
	return !maybeThreadSlug || !/-\d+$/.test(maybeThreadSlug)
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		[${HIDDEN_BY_IGNORED_AUTHOR_ATTR}="true"] {
			display: none !important;
		}
	`
	document.head.appendChild(style)
}

function clearHiddenRow(row: HTMLTableRowElement): void {
	if (!row.hasAttribute(HIDDEN_BY_IGNORED_AUTHOR_ATTR)) return

	row.removeAttribute(HIDDEN_BY_IGNORED_AUTHOR_ATTR)
	row.classList.remove(DOM_MARKERS.CLASSES.HIDDEN_THREAD)
	row.style.removeProperty('display')
}

function hideRow(row: HTMLTableRowElement): void {
	row.setAttribute(HIDDEN_BY_IGNORED_AUTHOR_ATTR, 'true')
	row.classList.add(DOM_MARKERS.CLASSES.HIDDEN_THREAD)
	row.style.setProperty('display', 'none', 'important')
}

export function resetMobileLiteIgnoredUserThreads(): void {
	document.querySelectorAll<HTMLTableRowElement>(`[${HIDDEN_BY_IGNORED_AUTHOR_ATTR}="true"]`).forEach(clearHiddenRow)
}

export function applyMobileLiteIgnoredUserThreads(hiddenUsernames: Iterable<string> = ignoredHiddenUsernames): void {
	ensureStyles()

	if (!areIgnoredAuthorThreadsHidden() || !isNormalMobileLiteSubforumPath(window.location.pathname)) {
		resetMobileLiteIgnoredUserThreads()
		return
	}

	const normalizedHiddenUsernames = new Set(Array.from(hiddenUsernames, normalizeUsername))

	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadPath = extractThreadPathFromRow(row)
		const creator = extractThreadCreatorUsernameFromRow(row)
		const shouldHide = Boolean(threadPath && creator && normalizedHiddenUsernames.has(normalizeUsername(creator)))

		if (shouldHide) {
			hideRow(row)
		} else {
			clearHiddenRow(row)
		}
	})
}

function syncIgnoredUserThreads(data: UserCustomizationsData): void {
	ignoredHiddenUsernames = new Set(extractIgnoredHiddenUsernames(data).map(normalizeUsername))
	applyMobileLiteIgnoredUserThreads()
}

function hasThreadRowsInMutations(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation =>
		Array.from(mutation.addedNodes).some(node => {
			if (!(node instanceof HTMLElement)) return false
			return node.matches(THREAD_ROWS_SELECTOR) || Boolean(node.querySelector(THREAD_ROWS_SELECTOR))
		})
	)
}

function scheduleApply(): void {
	if (applyTimeout) clearTimeout(applyTimeout)

	applyTimeout = setTimeout(() => {
		applyTimeout = null
		if (!isMobileLiteIgnoredUserThreadsAllowed()) return
		applyMobileLiteIgnoredUserThreads()
	}, APPLY_DEBOUNCE_MS)
}

export function initMobileLiteIgnoredUserThreads(): void {
	if (!isMobileLiteIgnoredUserThreadsAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true

	getUserCustomizations()
		.then(data => {
			if (!isMobileLiteIgnoredUserThreadsAllowed()) return
			syncIgnoredUserThreads(data)
		})
		.catch(error => {
			logger.error('Error initializing Mobile Lite ignored user threads:', error)
		})

	unwatchUserCustomizations = watchUserCustomizations(data => {
		if (!isMobileLiteIgnoredUserThreadsAllowed()) return
		syncIgnoredUserThreads(data)
	})

	contentObserver = new MutationObserver(mutations => {
		if (hasThreadRowsInMutations(mutations)) scheduleApply()
	})
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLiteIgnoredUserThreads(): void {
	if (applyTimeout) {
		clearTimeout(applyTimeout)
		applyTimeout = null
	}

	contentObserver?.disconnect()
	contentObserver = null

	unwatchUserCustomizations?.()
	unwatchUserCustomizations = null

	resetMobileLiteIgnoredUserThreads()
	document.getElementById(STYLE_ID)?.remove()

	ignoredHiddenUsernames = new Set()
	initialized = false
}
