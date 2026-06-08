import { DOM_MARKERS } from '@/constants'
import {
	buildHiddenNumericIds,
	extractThreadPathFromRow,
	extractThreadTitleFromRow,
	isThreadUrlHidden,
	parseHiddenThreadFromUrl,
} from '@/features/hidden-threads/logic/thread-utils'
import { getHiddenThreads, hideThread, watchHiddenThreads, type HiddenThread } from '@/features/hidden-threads/logic/storage'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { useSettingsStore } from '@/store/settings-store'

const STYLE_ID = 'mvp-mobile-lite-hidden-threads-styles'
const THREAD_ROWS_SELECTOR = 'tbody#temas tr, table#temas tbody tr'
const HIDDEN_THREAD_ATTR = 'data-mvp-mobile-lite-hidden-thread'
const HIDE_BUTTON_ATTR = 'data-mvp-mobile-lite-hide-thread'
const HIDE_BUTTON_CLASS = 'mvp-mobile-lite-hide-thread-btn'
const ACTION_CELL_CLASS = 'mvp-mobile-lite-thread-action-cell'
const APPLY_DEBOUNCE_MS = 100

let initialized = false
let hiddenThreadIds = new Set<string>()
let hiddenNumericIds = new Set<number>()
let unwatchHiddenThreads: (() => void) | null = null
let contentObserver: MutationObserver | null = null
let clickListenerAttached = false
let applyTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteHiddenThreadsAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function areHiddenThreadsEnabled(): boolean {
	return useSettingsStore.getState().hideThreadEnabled !== false
}

export function isMobileLiteHiddenThreadsPath(pathname: string): boolean {
	if (pathname === '/foro/spy' || pathname.startsWith('/foro/spy/')) return true
	if (!pathname.startsWith('/foro/')) return false

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
		[${HIDDEN_THREAD_ATTR}="true"] {
			display: none !important;
		}
		td.${ACTION_CELL_CLASS} {
			position: relative;
			overflow: visible;
		}
		td.${ACTION_CELL_CLASS} > .thread {
			margin-right: 42px;
			word-break: break-word;
			overflow-wrap: break-word;
		}
		.${HIDE_BUTTON_CLASS} {
			align-items: center;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 8px;
			color: rgba(220, 226, 234, 0.72);
			cursor: pointer;
			display: inline-flex;
			height: 40px;
			justify-content: center;
			line-height: 1;
			margin: 0;
			padding: 0;
			position: absolute;
			right: 0;
			top: 50%;
			transform: translateY(-50%);
			width: 40px;
			z-index: 5;
		}
		.${HIDE_BUTTON_CLASS} i {
			font-size: 15px;
			opacity: 0.78;
		}
		.${HIDE_BUTTON_CLASS}:active,
		.${HIDE_BUTTON_CLASS}:focus-visible {
			background: rgba(128, 86, 4, 0.86);
			border-color: rgba(208, 109, 0, 0.84);
			color: #fff;
			outline: none;
			opacity: 1;
		}
		.${HIDE_BUTTON_CLASS}:active i,
		.${HIDE_BUTTON_CLASS}:focus-visible i {
			opacity: 1;
		}
	`
	document.head.appendChild(style)
}

function syncHiddenThreadSets(threads: HiddenThread[]): void {
	hiddenThreadIds = new Set(threads.map(thread => thread.id))
	hiddenNumericIds = buildHiddenNumericIds(hiddenThreadIds)
}

function clearHiddenRow(row: HTMLTableRowElement): void {
	row.removeAttribute(HIDDEN_THREAD_ATTR)
	row.classList.remove(DOM_MARKERS.CLASSES.HIDDEN_THREAD)
	row.style.removeProperty('display')
}

function hideRow(row: HTMLTableRowElement): void {
	row.setAttribute(HIDDEN_THREAD_ATTR, 'true')
	row.classList.add(DOM_MARKERS.CLASSES.HIDDEN_THREAD)
	row.style.setProperty('display', 'none', 'important')
}

function getThreadActionCell(row: HTMLTableRowElement): HTMLElement | null {
	const thread = row.querySelector<HTMLElement>('.thread')
	return row.querySelector<HTMLElement>('td.col-th') ?? thread?.closest<HTMLElement>('td') ?? null
}

function ensureHideButton(row: HTMLTableRowElement, threadPath: string): void {
	const cell = getThreadActionCell(row)
	if (!cell) return

	cell.classList.add(ACTION_CELL_CLASS)

	const existingButton = cell.querySelector<HTMLButtonElement>(`[${HIDE_BUTTON_ATTR}]`)
	if (existingButton) {
		existingButton.dataset.threadPath = threadPath
		return
	}

	const button = document.createElement('button')
	button.type = 'button'
	button.className = HIDE_BUTTON_CLASS
	button.title = 'Ocultar hilo'
	button.setAttribute('aria-label', 'Ocultar hilo')
	button.setAttribute(HIDE_BUTTON_ATTR, 'true')
	button.dataset.threadPath = threadPath
	button.innerHTML = '<i class="fa fa-eye-slash" aria-hidden="true"></i>'
	cell.appendChild(button)
}

function removeHideButtons(): void {
	document.querySelectorAll<HTMLElement>(`[${HIDE_BUTTON_ATTR}]`).forEach(button => button.remove())
	document.querySelectorAll<HTMLElement>(`td.${ACTION_CELL_CLASS}`).forEach(cell => {
		cell.classList.remove(ACTION_CELL_CLASS)
	})
}

export function resetMobileLiteHiddenThreads(): void {
	document.querySelectorAll<HTMLTableRowElement>(`[${HIDDEN_THREAD_ATTR}="true"]`).forEach(clearHiddenRow)
}

export function applyMobileLiteHiddenThreads(): void {
	ensureStyles()

	if (!areHiddenThreadsEnabled() || !isMobileLiteHiddenThreadsPath(window.location.pathname)) {
		resetMobileLiteHiddenThreads()
		removeHideButtons()
		return
	}

	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadPath = extractThreadPathFromRow(row)
		if (!threadPath) return

		if (isThreadUrlHidden(threadPath, hiddenThreadIds, hiddenNumericIds)) {
			hideRow(row)
			return
		}

		clearHiddenRow(row)
		ensureHideButton(row, threadPath)
	})
}

function scheduleApply(): void {
	if (applyTimeout) clearTimeout(applyTimeout)

	applyTimeout = setTimeout(() => {
		applyTimeout = null
		if (!isMobileLiteHiddenThreadsAllowed()) return
		applyMobileLiteHiddenThreads()
	}, APPLY_DEBOUNCE_MS)
}

function hasThreadRowsInMutations(mutations: MutationRecord[]): boolean {
	return mutations.some(mutation =>
		Array.from(mutation.addedNodes).some(node => {
			if (!(node instanceof HTMLElement)) return false
			return node.matches(THREAD_ROWS_SELECTOR) || Boolean(node.querySelector(THREAD_ROWS_SELECTOR))
		})
	)
}

function handleHideButtonClick(event: MouseEvent): void {
	const target = event.target
	if (!(target instanceof Element)) return

	const button = target.closest<HTMLButtonElement>(`[${HIDE_BUTTON_ATTR}]`)
	if (!button) return

	event.preventDefault()
	event.stopPropagation()

	const threadPath = button.dataset.threadPath
	if (!threadPath) return

	const parsed = parseHiddenThreadFromUrl(threadPath)
	if (!parsed) return

	const row = button.closest<HTMLTableRowElement>('tr')
	const title = row ? extractThreadTitleFromRow(row) : null

	void hideThread({
		...parsed,
		title: title || parsed.title,
	})
		.then(() => {
			if (row) hideRow(row)
		})
		.catch(error => {
			logger.error('Error hiding Mobile Lite thread:', error)
		})
}

function ensureClickListener(): void {
	if (clickListenerAttached) return
	document.addEventListener('click', handleHideButtonClick, true)
	clickListenerAttached = true
}

export function initMobileLiteHiddenThreads(): void {
	if (!isMobileLiteHiddenThreadsAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	ensureClickListener()

	getHiddenThreads()
		.then(threads => {
			if (!isMobileLiteHiddenThreadsAllowed()) return
			syncHiddenThreadSets(threads)
			applyMobileLiteHiddenThreads()
		})
		.catch(error => {
			logger.error('Error initializing Mobile Lite hidden threads:', error)
		})

	unwatchHiddenThreads = watchHiddenThreads(threads => {
		if (!isMobileLiteHiddenThreadsAllowed()) return
		syncHiddenThreadSets(threads)
		applyMobileLiteHiddenThreads()
	})

	contentObserver = new MutationObserver(mutations => {
		if (hasThreadRowsInMutations(mutations)) scheduleApply()
	})
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLiteHiddenThreads(): void {
	if (applyTimeout) {
		clearTimeout(applyTimeout)
		applyTimeout = null
	}

	contentObserver?.disconnect()
	contentObserver = null

	unwatchHiddenThreads?.()
	unwatchHiddenThreads = null

	if (clickListenerAttached) {
		document.removeEventListener('click', handleHideButtonClick, true)
		clickListenerAttached = false
	}

	resetMobileLiteHiddenThreads()
	removeHideButtons()
	document.getElementById(STYLE_ID)?.remove()

	hiddenThreadIds = new Set()
	hiddenNumericIds = new Set()
	initialized = false
}
