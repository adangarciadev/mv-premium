import { DOM_MARKERS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { extractThreadNumericId } from '@/lib/url-helpers'
import { useSettingsStore } from '@/store/settings-store'
import {
	CONTENT_RULE_HIDDEN_CLASS,
	CONTENT_RULE_HIGHLIGHT_CLASS,
	CONTENT_RULE_HIGHLIGHT_TINT_PERCENT,
	applyContentRuleRowState,
	createContentRule,
	getContentRules,
	matchContentRules,
	watchContentRules,
	type ContentRule,
} from '@/features/content-rules'
import { getSavedThreads, toggleSaveThreadFromUrl, watchSavedThreads } from '@/features/saved-threads/logic/storage'
import { showSavedThreadToggledToast, showSaveThreadErrorToast } from '@/features/saved-threads/logic/save-toast'
import {
	extractIgnoredHiddenUsernames,
	getIgnoredHiddenUsernames,
	watchUserCustomizations,
} from '@/features/user-customizations/storage'
import { getHiddenThreads, hideThreadFromUrl, watchHiddenThreads } from './storage'
import {
	buildHiddenNumericIds,
	canExtractThreadCreatorFromPath,
	extractThreadCreatorUsernameFromRow,
	extractThreadPathFromRow,
	extractThreadTitleFromRow,
	extractSubforumIdFromThreadPath,
	normalizeThreadPath,
} from './thread-utils'
import { getThreadActionsPresentation } from './thread-actions'

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
const PREMIUM_MENU_BTN_CLASS = 'mvp-premium-thread-menu-btn'
const PREMIUM_MENU_CLASS = 'mvp-premium-thread-menu'
const PREMIUM_MENU_OPEN_CLASS = 'mvp-premium-thread-menu-open'
const PREMIUM_MENU_MARKER = 'data-mvp-premium-menu'
const PREMIUM_MENU_ACTION_ATTR = 'data-mvp-menu-action'
const PREMIUM_MENU_AUTHOR_ATTR = 'data-thread-author'
const PREMIUM_MENU_ID_ATTR = 'data-mvp-premium-menu-id'
const PREMIUM_MENU_OWNER_ATTR = 'data-mvp-premium-menu-owner'
const PREMIUM_MENU_TITLE_ATTR = 'data-thread-title'
const HIDE_BTN_MARKER = 'data-mvp-hide-btn'
const SAVE_BTN_MARKER = 'data-mvp-save-btn'
const HIDE_BTN_URL_ATTR = 'data-thread-url'
const THREAD_ID_ATTR = 'data-thread-id'
const MENU_VIEWPORT_MARGIN = 8
const CONTENT_RULE_TITLE_MAX_LENGTH = 100
const CONTENT_RULE_AUTHOR_MIN_LENGTH = 3
const CONTENT_RULE_AUTHOR_MAX_LENGTH = 12

let hiddenThreadIds = new Set<string>()
let hiddenNumericIds = new Set<number>()
let contentRules: ContentRule[] = []
let ignoredHiddenUsernames = new Set<string>()
let ignoredAuthorThreadIds = new Set<string>()
let ignoredAuthorNumericIds = new Set<number>()
let initialized = false
let initializationPromise: Promise<void> | null = null
let unwatchHiddenThreads: (() => void) | null = null
let unwatchSavedThreads: (() => void) | null = null
let unwatchContentRules: (() => void) | null = null
let unwatchUserCustomizations: (() => void) | null = null
let delegationSetup = false
let savedThreadIds = new Set<string>()
let forumListObserver: MutationObserver | null = null
let forumListObserverTimer: ReturnType<typeof setTimeout> | null = null
let premiumMenuIdCounter = 0

function areHideThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().hideThreadEnabled !== false
}

function areSaveThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().saveThreadEnabled !== false
}

function areContentRulesEnabled(): boolean {
	return useSettingsStore.getState().contentRulesEnabled !== false
}

function areClassicThreadActionsEnabled(): boolean {
	return useSettingsStore.getState().classicThreadActionsEnabled === true
}

function areIgnoredAuthorThreadsHidden(): boolean {
	return useSettingsStore.getState().hideIgnoredUserThreadsEnabled !== false
}

function normalizeUsername(username: string): string {
	return username.trim().toLowerCase()
}

function isSpyThreadListPage(): boolean {
	return !canExtractThreadCreatorFromPath(window.location.pathname)
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
			--mvp-thread-action-muted: var(--mv-text-muted, var(--muted-foreground, #98a2ad));
			--mvp-thread-action-foreground: var(--mv-text-primary, var(--foreground, #dce2ea));
			--mvp-thread-action-hover: var(--mv-bg-hover, var(--accent, rgba(255, 255, 255, 0.08)));
			--mvp-thread-action-saved: var(--mv-accent, var(--primary, #f7be58));
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: none;
			background: transparent;
			color: var(--mvp-thread-action-muted);
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
			color: var(--mvp-thread-action-foreground);
			background: var(--mvp-thread-action-hover);
		}
		.${SAVE_BTN_CLASS}:hover {
			color: var(--mvp-thread-action-foreground);
			background: var(--mvp-thread-action-hover);
		}
		.${SAVE_BTN_CLASS}.${SAVE_BTN_ACTIVE_CLASS} {
			color: var(--mvp-thread-action-saved);
		}
		.${CONTENT_RULE_HIGHLIGHT_CLASS} {
		}
		.${CONTENT_RULE_HIGHLIGHT_CLASS} > td {
			background:
				color-mix(in srgb, var(--mvp-content-rule-highlight-color, #f7be58) ${CONTENT_RULE_HIGHLIGHT_TINT_PERCENT}%, transparent) !important;
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
			--mvp-thread-action-featured-bg: color-mix(in srgb, var(--mv-bg-secondary, var(--card, #1f242b)) 82%, transparent);
			--mvp-thread-action-featured-hover: var(--mv-bg-hover, var(--accent, rgba(255, 255, 255, 0.12)));
			--mvp-thread-action-featured-fg: var(--mv-text-primary, var(--foreground, #fff));
			display: none;
			position: absolute;
			left: auto;
			top: 4px;
			transform: none;
			margin: 0;
			padding: 0;
			width: 24px;
			height: 24px;
			background: var(--mvp-thread-action-featured-bg);
			color: var(--mvp-thread-action-featured-fg);
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
			background: var(--mvp-thread-action-featured-hover);
			color: var(--mvp-thread-action-featured-fg);
		}
		.${SAVE_BTN_FEATURED_CLASS}:hover {
			background: var(--mvp-thread-action-featured-hover);
			color: var(--mvp-thread-action-featured-fg);
		}
		li:hover > .${HIDE_BTN_FEATURED_CLASS},
		li:hover > .${SAVE_BTN_FEATURED_CLASS} {
			display: flex;
		}
		.${PREMIUM_MENU_BTN_CLASS} {
			--mvp-premium-menu-trigger-muted: var(--muted-foreground, #98a2ad);
			--mvp-premium-menu-trigger-foreground: var(--foreground, #dce2ea);
			--mvp-premium-menu-trigger-hover: var(--accent, rgba(255, 255, 255, 0.08));
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: none;
			background: transparent;
			color: var(--mvp-premium-menu-trigger-muted);
			cursor: pointer;
			font-size: 13px;
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
			z-index: 8;
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition:
				background 0.15s ease,
				color 0.15s ease,
				opacity 0.15s ease;
		}
		.${PREMIUM_MENU_BTN_CLASS}:hover,
		.${PREMIUM_MENU_OPEN_CLASS} > .${PREMIUM_MENU_BTN_CLASS} {
			color: var(--mvp-premium-menu-trigger-foreground);
			background: var(--mvp-premium-menu-trigger-hover);
		}
		#temas tr:hover td.${HIDE_BTN_CELL_CLASS} .${PREMIUM_MENU_BTN_CLASS},
		td.${HIDE_BTN_CELL_CLASS} .${PREMIUM_MENU_BTN_CLASS}:focus-visible,
		td.${HIDE_BTN_CELL_CLASS} .${PREMIUM_MENU_OPEN_CLASS} .${PREMIUM_MENU_BTN_CLASS} {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}
		.${PREMIUM_MENU_CLASS} {
			--mvp-premium-menu-surface: var(--popover, var(--card, #1f242b));
			--mvp-premium-menu-foreground: var(--popover-foreground, var(--foreground, #dce2ea));
			--mvp-premium-menu-border: var(--border, rgba(255, 255, 255, 0.12));
			--mvp-premium-menu-hover: var(--accent, rgba(255, 255, 255, 0.08));
			display: none;
			position: fixed;
			left: var(--mvp-premium-menu-left, 0);
			top: var(--mvp-premium-menu-top, 0);
			min-width: 184px;
			z-index: 2147483647;
			padding: 6px;
			border-radius: 6px;
			border: 1px solid var(--mvp-premium-menu-border);
			background: var(--mvp-premium-menu-surface);
			color: var(--mvp-premium-menu-foreground);
			box-shadow: 0 12px 30px color-mix(in srgb, var(--mvp-premium-menu-surface) 35%, transparent);
			backdrop-filter: blur(8px);
		}
		.${PREMIUM_MENU_OPEN_CLASS} > .${PREMIUM_MENU_CLASS} {
			display: block;
		}
		.${PREMIUM_MENU_CLASS}.${PREMIUM_MENU_OPEN_CLASS} {
			display: block;
		}
		.${PREMIUM_MENU_CLASS} button {
			display: block;
			width: 100%;
			border: 0;
			background: transparent;
			color: var(--mvp-premium-menu-foreground);
			cursor: pointer;
			text-align: left;
			border-radius: 4px;
			padding: 7px 8px;
			font-size: 12px;
			line-height: 1.2;
		}
		.${PREMIUM_MENU_CLASS} button:hover,
		.${PREMIUM_MENU_CLASS} button:focus-visible {
			background: var(--mvp-premium-menu-hover);
			outline: none;
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

function isIgnoredAuthorThread(threadPath: string): boolean {
	if (ignoredAuthorThreadIds.has(threadPath)) return true

	const numericId = extractThreadNumericId(threadPath)
	return numericId !== null && ignoredAuthorNumericIds.has(numericId)
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
	document.querySelectorAll<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`).forEach(menuRoot => {
		const threadId = menuRoot.getAttribute(THREAD_ID_ATTR)
		if (!threadId) return
		updatePremiumMenuSaveLabel(menuRoot, savedThreadIds.has(threadId))
	})
}

function updateSaveButtonsByThreadId(threadId: string, isSaved: boolean): void {
	document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(button => {
		if (button.getAttribute(THREAD_ID_ATTR) === threadId) {
			applySaveButtonState(button, isSaved)
		}
	})
	document.querySelectorAll<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`).forEach(menuRoot => {
		if (menuRoot.getAttribute(THREAD_ID_ATTR) === threadId) {
			updatePremiumMenuSaveLabel(menuRoot, isSaved)
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
	document.querySelectorAll<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`).forEach(menu => {
		menu.remove()
	})
	document.querySelectorAll<HTMLElement>(`.${PREMIUM_MENU_CLASS}`).forEach(menu => {
		menu.remove()
	})

	document.querySelectorAll<HTMLElement>(`td.${HIDE_BTN_CELL_CLASS}`).forEach(cell => {
		cell.classList.remove(HIDE_BTN_CELL_CLASS)
		cell.style.removeProperty('--mvp-thread-actions-padding')
	})
}

function createMenuAction(label: string, action: string): HTMLButtonElement {
	const btn = document.createElement('button')
	btn.type = 'button'
	btn.textContent = label
	btn.setAttribute(PREMIUM_MENU_ACTION_ATTR, action)
	return btn
}

function updatePremiumMenuSaveLabel(menuRoot: HTMLElement, isSaved: boolean): void {
	const saveAction = getPremiumMenuForRoot(menuRoot)?.querySelector<HTMLButtonElement>(
		`[${PREMIUM_MENU_ACTION_ATTR}="toggle-save"]`
	)
	if (!saveAction) return
	saveAction.textContent = isSaved ? 'Quitar de guardados' : 'Guardar hilo'
}

function getPremiumMenuForRoot(menuRoot: HTMLElement): HTMLElement | null {
	const menuId = menuRoot.getAttribute(PREMIUM_MENU_ID_ATTR)
	if (!menuId) return null
	return document.querySelector<HTMLElement>(`.${PREMIUM_MENU_CLASS}[${PREMIUM_MENU_OWNER_ATTR}="${menuId}"]`)
}

function closePremiumMenu(menuRoot: HTMLElement): void {
	menuRoot.classList.remove(PREMIUM_MENU_OPEN_CLASS)
	menuRoot.querySelector(`.${PREMIUM_MENU_BTN_CLASS}`)?.setAttribute('aria-expanded', 'false')
	getPremiumMenuForRoot(menuRoot)?.classList.remove(PREMIUM_MENU_OPEN_CLASS)
}

function closePremiumMenusExcept(target: Element, exceptRoot?: HTMLElement): void {
	document.querySelectorAll<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`).forEach(menuRoot => {
		if (exceptRoot === menuRoot) return
		const menu = getPremiumMenuForRoot(menuRoot)
		if (menuRoot.contains(target) || menu?.contains(target)) return
		closePremiumMenu(menuRoot)
	})
}

function removeOrphanPremiumMenus(): void {
	document.querySelectorAll<HTMLElement>(`.${PREMIUM_MENU_CLASS}[${PREMIUM_MENU_OWNER_ATTR}]`).forEach(menu => {
		const ownerId = menu.getAttribute(PREMIUM_MENU_OWNER_ATTR)
		if (!ownerId) return
		if (!document.querySelector(`[${PREMIUM_MENU_ID_ATTR}="${ownerId}"]`)) {
			menu.remove()
		}
	})
}

function positionPremiumMenu(menuRoot: HTMLElement): void {
	const trigger = menuRoot.querySelector<HTMLElement>(`.${PREMIUM_MENU_BTN_CLASS}`)
	const menu = getPremiumMenuForRoot(menuRoot)
	if (!trigger || !menu) return

	const triggerRect = trigger.getBoundingClientRect()
	const menuRect = menu.getBoundingClientRect()
	const menuWidth = menuRect.width || 184
	const menuHeight = menuRect.height || 120
	const maxLeft = window.innerWidth - menuWidth - MENU_VIEWPORT_MARGIN
	const maxTop = window.innerHeight - menuHeight - MENU_VIEWPORT_MARGIN
	const preferredLeft = triggerRect.right - menuWidth
	const preferredTop = triggerRect.bottom + 6
	const left = Math.max(MENU_VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft))
	const top = Math.max(MENU_VIEWPORT_MARGIN, Math.min(preferredTop, maxTop))

	menu.style.setProperty('--mvp-premium-menu-left', `${left}px`)
	menu.style.setProperty('--mvp-premium-menu-top', `${top}px`)
}

function createPremiumMenu(url: string, row: HTMLTableRowElement): HTMLSpanElement {
	const root = document.createElement('span')
	const menuId = `mvp-premium-menu-${++premiumMenuIdCounter}`
	root.setAttribute(PREMIUM_MENU_MARKER, '')
	root.setAttribute(PREMIUM_MENU_ID_ATTR, menuId)
	root.setAttribute(HIDE_BTN_URL_ATTR, url)

	const threadId = normalizeThreadPath(url)
	if (threadId) {
		root.setAttribute(THREAD_ID_ATTR, threadId)
	}

	const title = extractThreadTitleFromRow(row)
	if (title) {
		root.setAttribute(PREMIUM_MENU_TITLE_ATTR, title)
	}

	const author = isSpyThreadListPage() ? null : extractThreadCreatorUsernameFromRow(row)
	if (author) {
		root.setAttribute(PREMIUM_MENU_AUTHOR_ATTR, author)
	}

	const trigger = document.createElement('button')
	trigger.type = 'button'
	trigger.className = PREMIUM_MENU_BTN_CLASS
	trigger.title = 'Acciones Premium'
	trigger.setAttribute('aria-label', 'Acciones Premium')
	trigger.setAttribute('aria-expanded', 'false')
	trigger.textContent = '⋯'

	const menu = document.createElement('div')
	menu.className = PREMIUM_MENU_CLASS
	menu.setAttribute('role', 'menu')
	menu.setAttribute(PREMIUM_MENU_OWNER_ATTR, menuId)
	if (areSaveThreadControlsEnabled()) {
		menu.appendChild(createMenuAction('Guardar hilo', 'toggle-save'))
	}
	if (areHideThreadControlsEnabled()) {
		menu.appendChild(createMenuAction('Ocultar hilo', 'hide-thread'))
	}
	if (areContentRulesEnabled()) {
		menu.appendChild(createMenuAction('Crear regla por título', 'rule-title'))
		if (author) {
			menu.appendChild(createMenuAction('Crear regla por autor', 'rule-author'))
		}
	}

	root.appendChild(trigger)
	document.body.appendChild(menu)

	if (threadId) {
		updatePremiumMenuSaveLabel(root, savedThreadIds.has(threadId))
	}

	return root
}

function injectHideButtons(): void {
	const hideEnabled = areHideThreadControlsEnabled()
	const saveEnabled = areSaveThreadControlsEnabled()
	const contentRulesEnabled = areContentRulesEnabled()
	const classicActionsEnabled = areClassicThreadActionsEnabled()
	const actionPresentation = getThreadActionsPresentation({
		hideEnabled,
		saveEnabled,
		contentRulesEnabled,
		classicActionsEnabled,
	})
	const premiumMenuEnabled = actionPresentation === 'compact-menu'
	const classicButtonsEnabled = actionPresentation === 'classic-buttons'

	if (actionPresentation === 'none') {
		removeThreadActionButtons()
		return
	}

	if (!hideEnabled) {
		document.querySelectorAll<HTMLElement>(`[${HIDE_BTN_MARKER}]`).forEach(btn => btn.remove())
	}

	if (!saveEnabled) {
		document.querySelectorAll<HTMLElement>(`[${SAVE_BTN_MARKER}]`).forEach(btn => btn.remove())
	}
	if (!premiumMenuEnabled) {
		document.querySelectorAll<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`).forEach(menu => menu.remove())
		document.querySelectorAll<HTMLElement>(`.${PREMIUM_MENU_CLASS}`).forEach(menu => menu.remove())
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

		if (classicButtonsEnabled || premiumMenuEnabled) {
			cell.classList.add(HIDE_BTN_CELL_CLASS)
			cell.style.setProperty(
				'--mvp-thread-actions-padding',
				premiumMenuEnabled || (hideEnabled && saveEnabled) ? '70px' : '42px'
			)
		} else {
			cell.classList.remove(HIDE_BTN_CELL_CLASS)
			cell.style.removeProperty('--mvp-thread-actions-padding')
		}

		if (premiumMenuEnabled) {
			document.querySelectorAll<HTMLElement>(`[${HIDE_BTN_MARKER}], [${SAVE_BTN_MARKER}]`).forEach(btn => {
				if (row.contains(btn)) btn.remove()
			})
			if (!row.querySelector(`[${PREMIUM_MENU_MARKER}]`)) {
				cell.appendChild(createPremiumMenu(url, row))
			}
			return
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
	removeOrphanPremiumMenus()

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

		const menuTrigger = target.closest<HTMLElement>(`.${PREMIUM_MENU_BTN_CLASS}`)
		if (menuTrigger) {
			e.preventDefault()
			e.stopPropagation()
			const menuRoot = menuTrigger.closest<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`)
			if (!menuRoot) return
			closePremiumMenusExcept(target, menuRoot)
			const menu = getPremiumMenuForRoot(menuRoot)
			const isOpen = menuRoot.classList.toggle(PREMIUM_MENU_OPEN_CLASS)
			menu?.classList.toggle(PREMIUM_MENU_OPEN_CLASS, isOpen)
			menuTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
			if (isOpen) {
				positionPremiumMenu(menuRoot)
			}
			return
		}

		closePremiumMenusExcept(target)

		const menuAction = target.closest<HTMLElement>(`[${PREMIUM_MENU_ACTION_ATTR}]`)
		if (menuAction) {
			e.preventDefault()
			e.stopPropagation()
			const ownerId = menuAction.closest<HTMLElement>(`.${PREMIUM_MENU_CLASS}`)?.getAttribute(PREMIUM_MENU_OWNER_ATTR)
			const menuRoot =
				menuAction.closest<HTMLElement>(`[${PREMIUM_MENU_MARKER}]`) ||
				(ownerId ? document.querySelector<HTMLElement>(`[${PREMIUM_MENU_ID_ATTR}="${ownerId}"]`) : null)
			const url = menuRoot?.getAttribute(HIDE_BTN_URL_ATTR)
			const action = menuAction.getAttribute(PREMIUM_MENU_ACTION_ATTR)
			if (!menuRoot || !url || !action) return

			closePremiumMenu(menuRoot)

			if (action === 'hide-thread') {
				if (areHideThreadControlsEnabled()) void hideThreadFromUrl(url)
				return
			}

			if (action === 'toggle-save') {
				if (!areSaveThreadControlsEnabled()) return
				const threadId = menuRoot.getAttribute(THREAD_ID_ATTR)
				void toggleSaveThreadFromUrl(url).then(saved => {
					if (saved === null) {
						showSaveThreadErrorToast('No se pudo guardar el hilo')
						return
					}

					if (threadId) {
						if (saved) savedThreadIds.add(threadId)
						else savedThreadIds.delete(threadId)
						updateSaveButtonsByThreadId(threadId, saved)
					} else {
						updateAllSaveButtonsState()
					}
					showSavedThreadToggledToast(saved)
				}).catch(error => {
					logger.error('Failed to toggle saved thread from premium menu:', error)
					showSaveThreadErrorToast()
				})
				return
			}

			if (action === 'rule-title' || action === 'rule-author') {
				const threadId = menuRoot.getAttribute(THREAD_ID_ATTR)
				const title = menuRoot.getAttribute(PREMIUM_MENU_TITLE_ATTR) || ''
				const author = menuRoot.getAttribute(PREMIUM_MENU_AUTHOR_ATTR) || ''
				const subforumId = extractSubforumIdFromThreadPath(threadId)
				const matchTitle = action === 'rule-title' ? title.trim().slice(0, CONTENT_RULE_TITLE_MAX_LENGTH) : ''
				const matchAuthor = action === 'rule-author' ? author.trim().slice(0, CONTENT_RULE_AUTHOR_MAX_LENGTH) : ''

				if (!matchTitle && !matchAuthor) return
				if (matchAuthor && matchAuthor.length < CONTENT_RULE_AUTHOR_MIN_LENGTH) return

				void createContentRule({
					name: action === 'rule-title' ? `Título: ${matchTitle}` : `Autor: ${matchAuthor}`,
					enabled: true,
					action: 'highlight',
					matchTitle,
					matchAuthor,
					subforumIds: subforumId ? [subforumId] : [],
				}).then(() => updateRowsVisibility())
				return
			}
		}

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
	ignoredAuthorThreadIds = new Set<string>()

	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadPath = extractThreadPathFromRow(row)
		const threadTitle = extractThreadTitleFromRow(row) || ''
		const subforumId = extractSubforumIdFromThreadPath(threadPath)
		const threadCreator = isSpyThreadListPage() ? null : extractThreadCreatorUsernameFromRow(row)
		const normalizedThreadCreator = threadCreator ? normalizeUsername(threadCreator) : null
		const ruleMatch = areContentRulesEnabled()
			? matchContentRules(contentRules, {
					title: threadTitle,
					author: threadCreator,
					subforumId,
				})
			: { action: null, matchedRules: [] }
		const highlightRule = ruleMatch.matchedRules.find(rule => rule.action === 'highlight')

		const shouldHideByIgnoredAuthor =
			Boolean(threadPath) &&
			Boolean(normalizedThreadCreator) &&
			areIgnoredAuthorThreadsHidden() &&
			(normalizedThreadCreator ? ignoredHiddenUsernames.has(normalizedThreadCreator) : false)

		if (threadPath && shouldHideByIgnoredAuthor) {
			ignoredAuthorThreadIds.add(threadPath)
		}

		const shouldHide = threadPath
			? isRowHidden(threadPath) || shouldHideByIgnoredAuthor || ruleMatch.action === 'hide'
			: false

		if (shouldHide) {
			row.classList.add(HIDDEN_THREAD_CLASS)
			applyContentRuleRowState(row, ruleMatch.action === 'hide' ? 'hide' : null, HIDDEN_THREAD_CLASS)
			return
		}

		row.classList.remove(HIDDEN_THREAD_CLASS)
		applyContentRuleRowState(
			row,
			ruleMatch.action === 'highlight' ? 'highlight' : null,
			HIDDEN_THREAD_CLASS,
			highlightRule?.highlightColor
		)
	})
	ignoredAuthorNumericIds = buildHiddenNumericIds(ignoredAuthorThreadIds)

	// Also filter sidebar featured/news items (present on some subforum pages)
	document.querySelectorAll<HTMLAnchorElement>(SIDEBAR_FEATURED_LINK_SELECTOR).forEach(link => {
		const threadPath = normalizeThreadPath(link.getAttribute('href') || link.href)
		const li = link.closest('li')
		if (!li || !threadPath) return

		if (isRowHidden(threadPath) || isIgnoredAuthorThread(threadPath)) {
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
			contentRules = await getContentRules()
			updateHiddenThreadsCache()
			setupHideButtonDelegation()
			const savedThreads = await getSavedThreads()
			savedThreadIds = new Set(savedThreads.map(thread => thread.id))
			const ignoredHiddenUsers = await getIgnoredHiddenUsernames()
			ignoredHiddenUsernames = new Set(ignoredHiddenUsers.map(normalizeUsername))

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

			if (!unwatchContentRules) {
				unwatchContentRules = watchContentRules(nextRules => {
					contentRules = nextRules
					updateRowsVisibility()
				})
			}

			if (!unwatchUserCustomizations) {
				unwatchUserCustomizations = watchUserCustomizations(nextData => {
					ignoredHiddenUsernames = new Set(extractIgnoredHiddenUsernames(nextData).map(normalizeUsername))
					updateRowsVisibility()
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
