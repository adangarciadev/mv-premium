import { DOM_MARKERS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { extractThreadNumericId } from '@/lib/url-helpers'
import { useSettingsStore } from '@/store/settings-store'
import { getSavedThreads, toggleSaveThreadFromUrl, watchSavedThreads } from '@/features/saved-threads/logic/storage'
import { showSavedThreadToggledToast, showSaveThreadErrorToast } from '@/features/saved-threads/logic/save-toast'
import { getHiddenThreads, hideThreadFromUrl, watchHiddenThreads } from './storage'
import { buildHiddenNumericIds, extractThreadPathFromRow, normalizeThreadPath } from './thread-utils'

const HIDDEN_THREAD_CLASS = DOM_MARKERS.CLASSES.HIDDEN_THREAD
const HIDDEN_THREAD_STYLE_ID = DOM_MARKERS.IDS.HIDDEN_THREADS_STYLES
const THREAD_ROWS_SELECTOR = 'tbody#temas tr, table#temas tbody tr'
const SIDEBAR_FEATURED_LINK_SELECTOR = 'a.featured-side[href*="/foro/"]'
const HIDDEN_THREADS_CACHE_KEY = RUNTIME_CACHE_KEYS.HIDDEN_THREADS
const EARLY_HIDDEN_THREAD_STYLE_IDS = [EARLY_STYLE_IDS.HIDDEN_THREADS, EARLY_STYLE_IDS.HIDDEN_THREADS_FALLBACK] as const

// Hide button constants
const HIDE_BTN_CLASS = 'mvp-hide-thread-btn'
const HIDE_BTN_FEATURED_CLASS = 'mvp-hide-featured-btn'
const SAVE_BTN_CLASS = 'mvp-save-thread-btn'
const SAVE_BTN_FEATURED_CLASS = 'mvp-save-featured-btn'
const SAVE_BTN_ACTIVE_CLASS = 'mvp-save-thread-btn-active'
const HIDE_BTN_CELL_CLASS = 'mvp-hide-thread-cell'
const HIDE_BTN_MARKER = 'data-mvp-hide-btn'
const SAVE_BTN_MARKER = 'data-mvp-save-btn'
const HIDE_BTN_URL_ATTR = 'data-thread-url'
const THREAD_ID_ATTR = 'data-thread-id'

let hiddenThreadIds = new Set<string>()
let hiddenNumericIds = new Set<number>()
let initialized = false
let initializationPromise: Promise<void> | null = null
let unwatchHiddenThreads: (() => void) | null = null
let unwatchSavedThreads: (() => void) | null = null
let delegationSetup = false
let savedThreadIds = new Set<string>()
let forumListObserver: MutationObserver | null = null
let forumListObserverTimer: ReturnType<typeof setTimeout> | null = null

function areHideThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().hideThreadEnabled !== false
}

function areSaveThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().saveThreadEnabled !== false
}

function updateHiddenThreadsCache(): void {
	try {
		const numericIds = Array.from(hiddenThreadIds)
			.map(id => extractThreadNumericId(id))
			.filter((id): id is number => id !== null)
			.map(String)

		if (numericIds.length === 0) {
			localStorage.removeItem(HIDDEN_THREADS_CACHE_KEY)
			return
		}

		// Keep unique IDs and a stable order for deterministic cache updates.
		const unique = Array.from(new Set(numericIds)).sort((a, b) => Number(a) - Number(b))
		localStorage.setItem(HIDDEN_THREADS_CACHE_KEY, JSON.stringify(unique))
	} catch {
		// localStorage can fail in restricted contexts; ignore.
	}
}

function ensureHiddenThreadStyles(): void {
	if (document.getElementById(HIDDEN_THREAD_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = HIDDEN_THREAD_STYLE_ID
	style.textContent = `
		.${HIDDEN_THREAD_CLASS} {
			display: none !important;
		}
		.${HIDE_BTN_CLASS},
		.${SAVE_BTN_CLASS} {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: none;
			background: transparent;
			color: #98a2ad;
			cursor: pointer;
			font-size: 12px;
			padding: 0;
			width: 24px;
			height: 24px;
			line-height: 1;
			border-radius: 4px;
			flex-shrink: 0;
			margin: 0;
			position: absolute;
			right: 8px;
			top: 50%;
			transform: translateY(-50%);
			z-index: 5;
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition:
				background 0.15s ease,
				color 0.15s ease,
				opacity 0.15s ease,
				visibility 0s linear 0.15s;
		}
		.${SAVE_BTN_CLASS} {
			right: 34px;
		}
		.${HIDE_BTN_CLASS}:hover {
			color: #fff;
			background: var(--mv-bg-hover, rgba(255, 255, 255, 0.08));
		}
		.${SAVE_BTN_CLASS}:hover {
			color: #fff;
			background: var(--mv-bg-hover, rgba(255, 255, 255, 0.08));
		}
		.${SAVE_BTN_CLASS}.${SAVE_BTN_ACTIVE_CLASS} {
			color: #f7be58;
		}
		/* Covers td.col-th (normal subforum rows) and plain td (spy compact rows) */
		td.${HIDE_BTN_CELL_CLASS} {
			position: relative;
			overflow: visible;
		}
		/* Keep thread title and inline unread/unfollow badges away from the
		   absolutely-positioned buttons. Using margin-right on .thread (specificity 0,2,1)
		   instead of padding-right on td (0,1,1) to win over MV's #temas td.col-th rules. */
		td.${HIDE_BTN_CELL_CLASS} > .thread {
			margin-right: var(--mvp-thread-actions-padding, 42px);
			word-break: break-word;
			overflow-wrap: break-word;
		}
		#temas tr:hover td.${HIDE_BTN_CELL_CLASS} .${HIDE_BTN_CLASS}:not(.${HIDE_BTN_FEATURED_CLASS}),
		#temas tr:hover td.${HIDE_BTN_CELL_CLASS} .${SAVE_BTN_CLASS}:not(.${SAVE_BTN_FEATURED_CLASS}),
		#temas td.${HIDE_BTN_CELL_CLASS} .${HIDE_BTN_CLASS}:not(.${HIDE_BTN_FEATURED_CLASS}):hover,
		#temas td.${HIDE_BTN_CELL_CLASS} .${SAVE_BTN_CLASS}:not(.${SAVE_BTN_FEATURED_CLASS}):hover,
		#temas td.${HIDE_BTN_CELL_CLASS} .${HIDE_BTN_CLASS}:not(.${HIDE_BTN_FEATURED_CLASS}):focus-visible,
		#temas td.${HIDE_BTN_CELL_CLASS} .${SAVE_BTN_CLASS}:not(.${SAVE_BTN_FEATURED_CLASS}):focus-visible {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
			transition-delay: 0s;
		}
		.${HIDE_BTN_FEATURED_CLASS},
		.${SAVE_BTN_FEATURED_CLASS} {
			display: none;
			position: absolute;
			left: auto;
			top: 4px;
			transform: none;
			margin: 0;
			padding: 0;
			width: 24px;
			height: 24px;
			background: rgba(0, 0, 0, 0.5);
			color: #fff;
			font-size: 12px;
			border-radius: 4px;
			backdrop-filter: blur(4px);
			z-index: 2;
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}
		.${HIDE_BTN_FEATURED_CLASS} {
			right: 4px;
		}
		.${SAVE_BTN_FEATURED_CLASS} {
			right: 32px;
		}
		.${HIDE_BTN_FEATURED_CLASS}:hover {
			background: rgba(0, 0, 0, 0.7);
			color: #fff;
		}
		.${SAVE_BTN_FEATURED_CLASS}:hover {
			background: rgba(0, 0, 0, 0.7);
			color: #fff;
		}
		li:hover > .${HIDE_BTN_FEATURED_CLASS},
		li:hover > .${SAVE_BTN_FEATURED_CLASS} {
			display: flex;
		}
	`
	document.head.appendChild(style)
}

function removeEarlyHiddenThreadStyles(): void {
	for (const styleId of EARLY_HIDDEN_THREAD_STYLE_IDS) {
		document.getElementById(styleId)?.remove()
	}
}

function isRowHidden(threadPath: string): boolean {
	if (hiddenThreadIds.has(threadPath)) return true

	const numericId = extractThreadNumericId(threadPath)
	return numericId !== null && hiddenNumericIds.has(numericId)
}

// ============================================================================
// Hide buttons
// ============================================================================

function createHideButton(url: string, featured: boolean): HTMLButtonElement {
	const btn = document.createElement('button')
	btn.className = featured ? `${HIDE_BTN_CLASS} ${HIDE_BTN_FEATURED_CLASS}` : HIDE_BTN_CLASS
	btn.setAttribute(HIDE_BTN_MARKER, '')
	btn.setAttribute(HIDE_BTN_URL_ATTR, url)
	btn.title = 'Ocultar hilo'
	btn.setAttribute('aria-label', 'Ocultar hilo')
	btn.type = 'button'

	const icon = document.createElement('i')
	icon.className = 'fa fa-eye-slash'
	btn.appendChild(icon)

	return btn
}

function createSaveButton(url: string, featured: boolean): HTMLButtonElement {
	const btn = document.createElement('button')
	btn.className = featured ? `${SAVE_BTN_CLASS} ${SAVE_BTN_FEATURED_CLASS}` : SAVE_BTN_CLASS
	btn.setAttribute(SAVE_BTN_MARKER, '')
	btn.setAttribute(HIDE_BTN_URL_ATTR, url)
	btn.title = 'Guardar hilo'
	btn.setAttribute('aria-label', 'Guardar hilo')
	btn.setAttribute('aria-pressed', 'false')
	btn.type = 'button'

	const threadId = normalizeThreadPath(url)
	if (threadId) {
		btn.setAttribute(THREAD_ID_ATTR, threadId)
	}

	const icon = document.createElement('i')
	icon.className = 'fa fa-bookmark'
	btn.appendChild(icon)

	return btn
}

function applySaveButtonState(button: HTMLElement, isSaved: boolean): void {
	button.classList.toggle(SAVE_BTN_ACTIVE_CLASS, isSaved)
	button.title = isSaved ? 'Quitar de guardados' : 'Guardar hilo'
	button.setAttribute('aria-label', isSaved ? 'Quitar de guardados' : 'Guardar hilo')
	button.setAttribute('aria-pressed', isSaved ? 'true' : 'false')
}

function updateAllSaveButtonsState(): void {
	document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(button => {
		const threadId = button.getAttribute(THREAD_ID_ATTR)
		if (!threadId) return
		applySaveButtonState(button, savedThreadIds.has(threadId))
	})
}

function updateSaveButtonsByThreadId(threadId: string, isSaved: boolean): void {
	document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(button => {
		if (button.getAttribute(THREAD_ID_ATTR) === threadId) {
			applySaveButtonState(button, isSaved)
		}
	})
}

function removeThreadActionButtons(): void {
	document.querySelectorAll<HTMLElement>(`[${HIDE_BTN_MARKER}]`).forEach(btn => {
		btn.remove()
	})
	document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(btn => {
		btn.remove()
	})

	document.querySelectorAll<HTMLElement>(`td.${HIDE_BTN_CELL_CLASS}`).forEach(cell => {
		cell.classList.remove(HIDE_BTN_CELL_CLASS)
		cell.style.removeProperty('--mvp-thread-actions-padding')
	})
}

function injectHideButtons(): void {
	const hideEnabled = areHideThreadControlsEnabled()
	const saveEnabled = areSaveThreadControlsEnabled()

	if (!hideEnabled && !saveEnabled) {
		removeThreadActionButtons()
		return
	}

	if (!hideEnabled) {
		document.querySelectorAll<HTMLElement>(`[${HIDE_BTN_MARKER}]`).forEach(btn => btn.remove())
	}

	if (!saveEnabled) {
		document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(btn => btn.remove())
	}

	// Thread table rows (spy, subforums, favorites, user posts…)
	//
	// Two different row structures exist on Mediavida:
	// - Normal subforum rows (cine, tv, etc.): td.col-th contains .thread
	// - Spy compact rows (live updates, no col-th): plain td contains .thread
	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadDiv = row.querySelector<HTMLElement>('.thread')
		if (!threadDiv) return

		const threadLink = threadDiv.querySelector<HTMLAnchorElement>('a[href*="/foro/"]')
		if (!threadLink) return

		const url = threadLink.getAttribute('href')
		if (!url) return

		// Prefer td.col-th (normal subforum rows); fall back to the thread's direct parent
		// td for spy compact rows that don't carry the col-th class.
		const cell = row.querySelector<HTMLElement>('td.col-th') ?? threadDiv.closest<HTMLElement>('td')
		if (!cell) return

		if (hideEnabled || saveEnabled) {
			cell.classList.add(HIDE_BTN_CELL_CLASS)
			cell.style.setProperty('--mvp-thread-actions-padding', hideEnabled && saveEnabled ? '70px' : '42px')
		} else {
			cell.classList.remove(HIDE_BTN_CELL_CLASS)
			cell.style.removeProperty('--mvp-thread-actions-padding')
		}

		if (hideEnabled && !row.querySelector(`[${HIDE_BTN_MARKER}]`)) {
			cell.appendChild(createHideButton(url, false))
		}

		if (saveEnabled) {
			const existingSaveBtn = row.querySelector<HTMLButtonElement>(`[${SAVE_BTN_MARKER}]`)
			if (existingSaveBtn) {
				existingSaveBtn.style.right = hideEnabled ? '34px' : '8px'
				const threadId = existingSaveBtn.getAttribute(THREAD_ID_ATTR)
				if (threadId) {
					applySaveButtonState(existingSaveBtn, savedThreadIds.has(threadId))
				}
			} else {
				const saveBtn = createSaveButton(url, false)
				saveBtn.style.right = hideEnabled ? '34px' : '8px'
				const threadId = saveBtn.getAttribute(THREAD_ID_ATTR)
				if (threadId) {
					applySaveButtonState(saveBtn, savedThreadIds.has(threadId))
				}
				cell.appendChild(saveBtn)
			}
		}
	})

	// Sidebar featured/news items
	document.querySelectorAll<HTMLAnchorElement>(SIDEBAR_FEATURED_LINK_SELECTOR).forEach(link => {
		const li = link.closest('li')
		if (!li) return

		const url = link.getAttribute('href')
		if (!url) return

		li.style.position = 'relative'

		if (hideEnabled && !li.querySelector(`[${HIDE_BTN_MARKER}]`)) {
			li.appendChild(createHideButton(url, true))
		}

		if (saveEnabled) {
			const existingSaveBtn = li.querySelector<HTMLButtonElement>(`[${SAVE_BTN_MARKER}]`)
			if (existingSaveBtn) {
				existingSaveBtn.style.right = hideEnabled ? '32px' : '4px'
				const threadId = existingSaveBtn.getAttribute(THREAD_ID_ATTR)
				if (threadId) {
					applySaveButtonState(existingSaveBtn, savedThreadIds.has(threadId))
				}
			} else {
				const saveBtn = createSaveButton(url, true)
				saveBtn.style.right = hideEnabled ? '32px' : '4px'
				const threadId = saveBtn.getAttribute(THREAD_ID_ATTR)
				if (threadId) {
					applySaveButtonState(saveBtn, savedThreadIds.has(threadId))
				}
				li.appendChild(saveBtn)
			}
		}
	})
}

/**
 * Sets up a dedicated MutationObserver for the forum thread list table.
 * This handles dynamic pages like /foro/spy where rows appear and move
 * without the global mutation observer necessarily catching them.
 */
function setupForumListObserver(): void {
	if (forumListObserver) return

	const tbody = document.querySelector<HTMLElement>('tbody#temas')
	if (!tbody) return

	const container = tbody.closest('table') ?? tbody.parentElement
	if (!container) return

	forumListObserver = new MutationObserver((mutations) => {
		let hasNewElements = false
		for (const mutation of mutations) {
			if (mutation.type !== 'childList') continue
			for (let i = 0; i < mutation.addedNodes.length; i++) {
				if (mutation.addedNodes[i].nodeType === Node.ELEMENT_NODE) {
					hasNewElements = true
					break
				}
			}
			if (hasNewElements) break
		}

		if (!hasNewElements) return

		if (forumListObserverTimer) clearTimeout(forumListObserverTimer)
		forumListObserverTimer = setTimeout(() => {
			updateRowsVisibility()
			forumListObserverTimer = null
		}, 50)
	})

	forumListObserver.observe(container, {
		childList: true,
		subtree: true,
	})
}

function setupHideButtonDelegation(): void {
	if (delegationSetup) return
	delegationSetup = true

	document.addEventListener('click', (e) => {
		const target = e.target as Element
		const hideBtn = target.closest<HTMLElement>(`.${HIDE_BTN_CLASS}`)
		const saveBtn = target.closest<HTMLElement>(`.${SAVE_BTN_CLASS}`)
		if (!hideBtn && !saveBtn) return

		const btn = hideBtn || saveBtn
		if (!btn) return

		const url = btn.getAttribute(HIDE_BTN_URL_ATTR)
		if (!url) return

		e.preventDefault()
		e.stopPropagation()

		if (hideBtn) {
			if (!areHideThreadControlsEnabled()) return
			void hideThreadFromUrl(url)
			btn.blur()
			return
		}

		if (!areSaveThreadControlsEnabled()) return

		const threadId = btn.getAttribute(THREAD_ID_ATTR)
		void toggleSaveThreadFromUrl(url).then(saved => {
			if (saved === null) {
				showSaveThreadErrorToast('No se pudo guardar el hilo')
				return
			}

			if (threadId) {
				if (saved) {
					savedThreadIds.add(threadId)
				} else {
					savedThreadIds.delete(threadId)
				}
				updateSaveButtonsByThreadId(threadId, saved)
			} else {
				// Fallback for uncommon cases where the row URL can't be normalized.
				updateAllSaveButtonsState()
			}

			showSavedThreadToggledToast(saved)
		}).catch(error => {
			logger.error('Failed to toggle saved thread from hover button:', error)
			showSaveThreadErrorToast()
		})

		// Prevent sticky visibility due to element focus after click.
		btn.blur()
	})
}

// ============================================================================
// Visibility updates
// ============================================================================

function updateRowsVisibility(): void {
	ensureHiddenThreadStyles()
	injectHideButtons()

	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadPath = extractThreadPathFromRow(row)
		const shouldHide = threadPath ? isRowHidden(threadPath) : false

		if (shouldHide) {
			row.classList.add(HIDDEN_THREAD_CLASS)
			return
		}

		row.classList.remove(HIDDEN_THREAD_CLASS)
	})

	// Also filter sidebar featured/news items (present on some subforum pages)
	document.querySelectorAll<HTMLAnchorElement>(SIDEBAR_FEATURED_LINK_SELECTOR).forEach(link => {
		const threadPath = normalizeThreadPath(link.getAttribute('href') || link.href)
		const li = link.closest('li')
		if (!li || !threadPath) return

		if (isRowHidden(threadPath)) {
			li.classList.add(HIDDEN_THREAD_CLASS)
		} else {
			li.classList.remove(HIDDEN_THREAD_CLASS)
		}
	})
}

export function applyHiddenThreadsFilter(): void {
	if (!initialized && !initializationPromise) {
		void initHiddenThreadsFiltering()
		return
	}

	updateRowsVisibility()
}

export async function initHiddenThreadsFiltering(): Promise<void> {
	if (initialized) {
		updateRowsVisibility()
		return
	}

	if (initializationPromise) {
		await initializationPromise
		updateRowsVisibility()
		return
	}

	initializationPromise = (async () => {
		try {
			const threads = await getHiddenThreads()
			hiddenThreadIds = new Set(threads.map(thread => thread.id))
			hiddenNumericIds = buildHiddenNumericIds(hiddenThreadIds)
			updateHiddenThreadsCache()
			setupHideButtonDelegation()
			const savedThreads = await getSavedThreads()
			savedThreadIds = new Set(savedThreads.map(thread => thread.id))

			if (!unwatchHiddenThreads) {
				unwatchHiddenThreads = watchHiddenThreads(nextThreads => {
					hiddenThreadIds = new Set(nextThreads.map(thread => thread.id))
					hiddenNumericIds = buildHiddenNumericIds(hiddenThreadIds)
					updateHiddenThreadsCache()
					updateRowsVisibility()
				})
			}

			if (!unwatchSavedThreads) {
				unwatchSavedThreads = watchSavedThreads(nextThreads => {
					savedThreadIds = new Set(nextThreads.map(thread => thread.id))
					updateAllSaveButtonsState()
				})
			}

			initialized = true
			setupForumListObserver()
		} catch (error) {
			logger.error('Failed to initialize hidden threads filtering:', error)
			removeEarlyHiddenThreadStyles()
		}
	})()

	try {
		await initializationPromise
	} finally {
		initializationPromise = null
	}

	updateRowsVisibility()
	removeEarlyHiddenThreadStyles()
}
