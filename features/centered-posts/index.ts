/**
 * Centered Posts Mode Feature
 *
 * Hides the sidebar (.c-side) and expands posts to full width.
 * Relocates critical controls to a horizontal bar below the thread title.
 *
 * Only active on thread pages when enabled.
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, MV_SELECTORS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

const STYLE_ID = DOM_MARKERS.IDS.CENTERED_POSTS_STYLES
const EARLY_STYLE_ID = 'mvp-centered-posts-early'
const CONTROL_BAR_ID = DOM_MARKERS.IDS.CENTERED_CONTROL_BAR
const CACHE_KEY = 'mvp-centered-posts-cache'
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`

interface SettingsState {
	state: {
		centeredPostsEnabled: boolean
		centeredControlsSticky: boolean
	}
}

/**
 * CSS styles to hide sidebar and expand posts
 * Uses 100% width - no dynamic calculations to prevent layout shift
 * @param sticky - Whether the control bar should be sticky
 */
function generateStyles(sticky: boolean): string {
	return `
		/* MVP Centered Posts Mode */

		/* 1. Hide Sidebar completely */
		${MV_SELECTORS.GLOBAL.C_SIDE},
		.wrw > .c-side,
		#main .c-side {
			display: none !important;
		}

		/* 2. Content wrapper - force full width */
		${MV_SELECTORS.GLOBAL.CONTENT_WRAPPER},
		.wrw,
		#main > .wrw,
		#main.wrp > .wrw {
			display: block !important;
			width: 100% !important;
			max-width: none !important;
		}

		/* 3. Main Content Area - expand to full width */
		${MV_SELECTORS.GLOBAL.MAIN_CONTENT},
		.c-main,
		#post-container,
		.wrw > .c-main,
		#main .wrw .c-main,
		#main.wrp .wrw .c-main,
		div.c-main#post-container {
			width: 100% !important;
			max-width: none !important;
			padding-right: 0 !important;
			padding-left: 0 !important;
			float: none !important;
			display: block !important;
			margin-left: auto !important;
			margin-right: auto !important;
			flex: unset !important;
			box-sizing: border-box !important;
		}

		/* 4. Inner content container */
		.wpx,
		.c-main > .wpx,
		#post-container > .wpx {
			width: 100% !important;
			max-width: none !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			box-sizing: border-box !important;
		}

		/* 5. Topic block and control bar */
		#topic,
		.block#topic,
		.wpx > .block#topic,
		#${CONTROL_BAR_ID} {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 6. Posts container */
		#posts-wrap,
		#topic > #posts-wrap,
		.block#topic > #posts-wrap {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 7. Individual posts */
		.post,
		#posts-wrap > .post,
		div.post.cf {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 7b. Postit should match posts width */
		#postit.postit,
		.postit {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
			position: relative !important;
			padding-top: 40px !important;
		}

		/* 7b-collapsed. Postit collapsed state - no extra padding */
		#postit.postit.oculto,
		.postit.oculto {
			padding-top: 0 !important;
		}

		/* 7c. Postit toggle button - preserve visibility and position */
		#postit.postit > a.toggle,
		.postit > a.toggle {
			position: absolute !important;
			top: 8px !important;
			right: 8px !important;
			z-index: 10 !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
		}

		/* =====================================================
		   Control Bar - Horizontal button bar
		   ===================================================== */
		#${CONTROL_BAR_ID} {
			display: flex !important;
			flex-direction: row !important;
			flex-wrap: wrap !important;
			gap: 12px;
			align-items: center;
			justify-content: flex-start;
			padding: 12px 16px !important;
			margin-top: 16px !important;
			margin-bottom: 20px !important;
			width: 100% !important;
			background: var(--mv-bg-alt, #1e1e1e);
			border: 1px solid rgba(128, 128, 128, 0.15);
			border-radius: var(--radius, 8px);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			box-sizing: border-box !important;
			${
				sticky
					? `
			position: sticky !important;
			top: 40px !important;
			z-index: 50 !important;
			`
					: ''
			}
		}

		/* Control Groups - horizontal layout */
		#${CONTROL_BAR_ID} .mvp-control-group {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			flex-shrink: 0;
		}

		/* Vertical Separator between groups */
		#${CONTROL_BAR_ID} .mvp-control-separator {
			width: 1px;
			height: 24px;
			background: rgba(128, 128, 128, 0.25);
			flex-shrink: 0;
		}

		/* =====================================================
		   Native MV Elements inside control bar
		   ===================================================== */

		/* Reset all elements inside control bar */
		#${CONTROL_BAR_ID} * {
			float: none !important;
		}

		/* #topic-reply: Responder + Compartir buttons */
		#${CONTROL_BAR_ID} #topic-reply {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			border: none !important;
		}

		/* #more-actions: Native MV action icons (Favoritos, Ignorar, Resumen) */
		#${CONTROL_BAR_ID} #more-actions {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			border: none !important;
		}

		/* #topic-nav: Navigation arrows */
		#${CONTROL_BAR_ID} #topic-nav {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 10px;
			margin: 0 !important;
			border: none !important;
		}

		/* =====================================================
		   MVP Extra Actions (inside #more-actions)
		   ===================================================== */

		/* Main MVP container - make horizontal and remove all borders */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			margin-top: 0 !important;
			padding: 0 !important;
			padding-top: 0 !important;
			border: none !important;
			border-top: none !important;
		}

		/* Main actions row (Gallery, Save, Summarize) */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 6px;
		}

		/* Hide the separator inside control bar */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: none !important;
		}

		/* Status actions row (Live, Infinite Scroll) */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 6px;
		}

		/* =====================================================
		   Button containers (ensure proper sizing)
		   ===================================================== */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.LIVE_BUTTON_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.INFINITE_SCROLL_BUTTON_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.GALLERY_BTN} {
			display: flex !important;
			align-items: center !important;
		}

		/* Navigation arrows spacing */
		#${CONTROL_BAR_ID} #topic-nav a {
			margin: 0 !important;
		}

		/* Force pointer cursor for action buttons */
		#${CONTROL_BAR_ID} a,
		#${CONTROL_BAR_ID} button,
		#${CONTROL_BAR_ID} [role='button'] {
			cursor: pointer !important;
		}

		/* 8. Side navigation - align with content edge (always, not just when affix) */
		#side-nav {
			transform: translateX(-11px) !important;
		}
	`
}

/**
 * Updates localStorage cache for instant access on next page load
 */
function updateCache(enabled: boolean): void {
	try {
		if (enabled) {
			localStorage.setItem(CACHE_KEY, 'true')
		} else {
			localStorage.removeItem(CACHE_KEY)
		}
	} catch {
		// localStorage might be disabled
	}
}

/**
 * Creates the control bar by MOVING (not cloning) sidebar elements.
 * Moving preserves all event listeners attached by Mediavida's JavaScript.
 *
 * Layout order:
 * 1. Native MV buttons (Reply, Share)
 * 2. Separator
 * 3. Native MV actions + MVP injected buttons (Fav, Ignore, Summary + Gallery, Save, Live, Scroll)
 * 4. Separator
 * 5. Navigation arrows (Up/Down)
 */
function createControlBar(): HTMLElement {
	const bar = document.createElement('div')
	bar.id = CONTROL_BAR_ID

	const sidebar = document.querySelector(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return bar

	// === GROUP 1: Reply & Share ===
	const group1 = document.createElement('div')
	group1.className = 'mvp-control-group mvp-reply-group'

	const topicReply = sidebar.querySelector('#topic-reply') as HTMLElement | null
	if (topicReply) {
		group1.appendChild(topicReply)
	}

	if (group1.children.length > 0) {
		bar.appendChild(group1)
	}

	// === SEPARATOR 1 ===
	if (group1.children.length > 0) {
		const sep1 = document.createElement('div')
		sep1.className = 'mvp-control-separator'
		bar.appendChild(sep1)
	}

	// === GROUP 2: Actions (MV native + MVP buttons) ===
	// Move #more-actions which already contains MVP extra actions inside it
	const group2 = document.createElement('div')
	group2.className = 'mvp-control-group mvp-actions-group'

	const moreActions = sidebar.querySelector('#more-actions') as HTMLElement | null
	if (moreActions) {
		group2.appendChild(moreActions)
	}

	if (group2.children.length > 0) {
		bar.appendChild(group2)
	}

	// === SEPARATOR 2 ===
	const hasContent = group1.children.length > 0 || group2.children.length > 0

	// === GROUP 3: Navigation ===
	const group3 = document.createElement('div')
	group3.className = 'mvp-control-group mvp-nav-group'

	const topicNav = sidebar.querySelector('#topic-nav') as HTMLElement | null
	if (topicNav) {
		group3.appendChild(topicNav)
	}

	if (group3.children.length > 0 && hasContent) {
		const sep2 = document.createElement('div')
		sep2.className = 'mvp-control-separator'
		bar.appendChild(sep2)
	}

	if (group3.children.length > 0) {
		bar.appendChild(group3)
	}

	return bar
}

/**
 * Injects the control bar into the page
 */
function injectControlBar(): void {
	// Remove existing bar if present (and restore elements first!)
	const existingBar = document.getElementById(CONTROL_BAR_ID)
	if (existingBar) {
		removeControlBar()
	}

	// Find insertion point: place bar OUTSIDE #topic (before it)
	const topic = document.querySelector('#topic')
	const postit = document.querySelector('#postit')

	if (!topic) return

	const bar = createControlBar()
	const topicParent = topic.parentElement

	// If postit exists outside #topic (e.g., native live), insert above postit
	if (postit && postit.parentElement && postit.parentElement !== topic) {
		postit.parentElement.insertBefore(bar, postit)
		return
	}

	// Default: insert before #topic to avoid inheriting its border/line styles
	if (topicParent) {
		topicParent.insertBefore(bar, topic)
	} else {
		// Fallback: insert at start of topic if parent is missing
		topic.insertBefore(bar, topic.firstChild)
	}

	// Clean up inline styles from MVP containers that were designed for sidebar
	const extraActions = bar.querySelector<HTMLElement>(`#${DOM_MARKERS.IDS.EXTRA_ACTIONS}`)
	if (extraActions) {
		extraActions.style.borderTop = 'none'
		extraActions.style.marginTop = '0'
		extraActions.style.paddingTop = '0'
		extraActions.style.flexDirection = 'row'
	}
}

/**
 * Restores native elements back to the sidebar before removing the control bar.
 * This ensures that disabling the feature doesn't delete the native buttons.
 */
function restoreNativeElements(bar: HTMLElement): void {
	const sidebar = document.querySelector(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return

	// functionality to move elements back to sidebar
	const moveBack = (selector: string) => {
		const element = bar.querySelector(selector)
		if (element) {
			sidebar.appendChild(element)
		}
	}

	// Restore in logical order
	moveBack('#topic-reply')
	moveBack('#more-actions')
	moveBack('#topic-nav')
}

/**
 * Removes the control bar from the page
 */
function removeControlBar(): void {
	const bar = document.getElementById(CONTROL_BAR_ID)
	if (bar) {
		// Restore native elements to sidebar before removing
		restoreNativeElements(bar)

		// Clean up MVP-specific containers if necessary (though they are inside bar, so removing bar kills them)
		// But native elements must be saved!
		bar.remove()
	}
}

/**
 * Applies or removes the centered posts mode
 * @param enabled - Whether to enable centered posts
 * @param sticky - Whether the control bar should be sticky
 */
function applyCenteredPosts(enabled: boolean, sticky: boolean = false): void {
	logger.debug('CenteredPosts: applyCenteredPosts called with enabled =', enabled)

	// Update cache for next page load
	updateCache(enabled)

	// Remove existing styles (both main and early-inject to avoid duplication)
	const existingStyle = document.getElementById(STYLE_ID)
	if (existingStyle) {
		existingStyle.remove()
	}

	const earlyStyle = document.getElementById(EARLY_STYLE_ID)
	if (earlyStyle) {
		earlyStyle.remove()
	}

	if (!enabled) {
		removeControlBar()
		return
	}

	// Create and inject styles
	const styleEl = document.createElement('style')
	styleEl.id = STYLE_ID
	styleEl.textContent = generateStyles(sticky)
	document.head.appendChild(styleEl)
	logger.debug('CenteredPosts: Stylesheet injected with id', STYLE_ID)

	// Inject control bar by MOVING native sidebar elements
	// This preserves all event listeners since we move, not clone
	injectControlBar()
}

/**
 * Initializes the centered posts feature
 */
export async function initCenteredPosts(): Promise<void> {
	try {
		// Get initial settings
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
			const enabled = parsed?.state?.centeredPostsEnabled ?? false
			const sticky = parsed?.state?.centeredControlsSticky ?? false
			applyCenteredPosts(enabled, sticky)
		}

		// Watch for changes
		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const parsed: SettingsState = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
				const enabled = parsed?.state?.centeredPostsEnabled ?? false
				const sticky = parsed?.state?.centeredControlsSticky ?? false
				applyCenteredPosts(enabled, sticky)
			} catch (e) {
				logger.error('CenteredPosts error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('CenteredPosts failed to initialize:', error)
	}
}
