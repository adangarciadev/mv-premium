/**
 * Centered Posts Mode Feature
 *
 * Hides the sidebar (.c-side) and expands posts to full width.
 * On thread pages, it also relocates critical controls to a horizontal bar.
 *
 * Active on:
 * - Thread pages (full mode with control bar)
 * - Spy and subforum listing pages (layout-only mode)
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, MV_SELECTORS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { getCenteredPostsPageKind, type CenteredPostsPageKind } from '@/lib/content-modules/utils/page-detection'

const STYLE_ID = DOM_MARKERS.IDS.CENTERED_POSTS_STYLES
const EARLY_STYLE_ID = EARLY_STYLE_IDS.CENTERED_POSTS
const CONTROL_BAR_ID = DOM_MARKERS.IDS.CENTERED_CONTROL_BAR
const CACHE_KEY = RUNTIME_CACHE_KEYS.CENTERED_POSTS
const ACTIVE_BODY_CLASS = 'mvp-centered-posts-active'
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`
const SIDE_LAYOUT_MIN_WIDTH = 1500
const RESIZE_DEBOUNCE_MS = 120
const SIDE_BAR_GAP_PX = 12
const SIDE_TOP_OFFSET_PX = 92
const SIDE_MIN_INSET_PX = 12
const SIDE_TOP_MIN_PX = 66
const SIDE_BAR_FALLBACK_WIDTH_PX = 332
const SIDE_BAR_MIN_WIDTH_PX = 220
const SIDE_BAR_MAX_WIDTH_PX = 420
const FLOATING_VIDEO_CLASS = 'mvp-centered-floating-video'
const FLOATING_VIDEO_INTERACTIVE_ATTR = 'data-mvp-floating-video-interactive'
const FLOATING_VIDEO_DRAG_HANDLE_CLASS = 'mvp-centered-floating-video-drag-handle'
const FLOATING_VIDEO_DRAG_LABEL_CLASS = 'mvp-centered-floating-video-drag-label'
const FLOATING_VIDEO_RESIZE_HANDLE_CLASS = 'mvp-centered-floating-video-resize-handle'
const FLOATING_VIDEO_CLOSE_BUTTON_CLASS = 'mvp-centered-floating-video-dismiss-btn'
const FLOATING_VIDEO_INTERACTING_CLASS = 'mvp-centered-floating-video-interacting'
const FLOATING_VIDEO_IFRAME_SELECTOR =
	"iframe[src*='youtube.com'], iframe[src*='youtube-nocookie.com'], iframe[src*='youtu.be']"
const FLOATING_VIDEO_VAR_RIGHT = '--mvp-centered-video-right'
const FLOATING_VIDEO_VAR_WIDTH = '--mvp-centered-video-width'
const FLOATING_VIDEO_VAR_HEIGHT = '--mvp-centered-video-height'
const FLOATING_VIDEO_BOTTOM_PX = 12
const FLOATING_VIDEO_TOP_BUFFER_PX = 84
const FLOATING_VIDEO_MIN_WIDTH_PX = 280
const FLOATING_VIDEO_BASE_WIDTH_PX = 420
const FLOATING_VIDEO_MAX_WIDTH_PX = 620
const FLOATING_VIDEO_SCROLL_SHRINK_MAX_PX = 56
const FLOATING_VIDEO_SCROLL_SHRINK_DISTANCE_PX = 1200
const FLOATING_VIDEO_Z_INDEX = 95
const FLOATING_VIDEO_CLOSE_SELECTORS = [
	'.close',
	'.cerrar',
	'[class*="close"]',
	'[class*="cerrar"]',
	'[aria-label*="close" i]',
	'[aria-label*="cerrar" i]',
	'[title*="close" i]',
	'[title*="cerrar" i]',
].join(', ')

type ControlBarPosition = 'top' | 'side'

interface FloatingVideoManualState {
	widthPx: number
	heightPx: number
	leftPx: number
	topPx: number
}

let requestedEnabled = false
let requestedSticky = false
let requestedPosition: ControlBarPosition = 'top'
let appliedPosition: ControlBarPosition | null = null
let resizeDebounceId: number | undefined
let resizeListenerInitialized = false
let resizeRafId: number | undefined
let cachedSidebarWidthPx = SIDE_BAR_FALLBACK_WIDTH_PX
let sideStableTopPx: number | null = null
let floatingVideoObserver: MutationObserver | null = null
let floatingVideoRafId: number | undefined
let floatingVideoListenersAttached = false
let floatingVideoManualState: FloatingVideoManualState | null = null

interface SettingsState {
	state: {
		centeredPostsEnabled: boolean
		centeredControlsSticky: boolean
		centeredControlsPosition?: ControlBarPosition
	}
}

/**
 * CSS styles to hide sidebar and expand posts
 * Uses 100% width - no dynamic calculations to prevent layout shift
 * @param sticky - Whether the control bar should be sticky (top mode only)
 * @param position - Position mode for the control bar
 */
function generateStyles(sticky: boolean, position: ControlBarPosition): string {
	const scopedNativeCloseSelectors = FLOATING_VIDEO_CLOSE_SELECTORS.split(',')
		.map(selector => `body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} ${selector.trim()}`)
		.join(',\n\t\t')

	return `
		/* MVP Centered Posts Mode */

		/* 1. Keep sidebar measurable for native MV scripts (e.g. floating video sizing),
		   but fully invisible/non-interactive for centered mode */
		${MV_SELECTORS.GLOBAL.C_SIDE},
		.wrw > .c-side,
		#main .c-side {
			display: block !important;
			position: absolute !important;
			top: 0 !important;
			right: 0 !important;
			visibility: hidden !important;
			opacity: 0 !important;
			pointer-events: none !important;
			height: 0 !important;
			overflow: hidden !important;
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
			background: var(--card, #1e1e1e);
			color: var(--card-foreground, #e7e9ea);
			border: 1px solid var(--border, rgba(128, 128, 128, 0.25));
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
			background: color-mix(in srgb, var(--border, rgba(128, 128, 128, 0.3)) 80%, transparent);
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
			flex-wrap: nowrap !important;
			gap: 10px;
			margin: 0 !important;
			width: auto !important;
			max-width: fit-content !important;
			border: none !important;
		}

		/* Keep nav controls compact in top mode to avoid wrapping to next line */
		#${CONTROL_BAR_ID} .mvp-nav-group {
			min-width: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav .pull-right,
		#${CONTROL_BAR_ID} #topic-nav a.btn-fid {
			display: none !important;
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
			width: auto !important;
		}

		/* Main actions row (Gallery, Save, Summarize) */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 6px;
			width: auto !important;
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
			width: auto !important;
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

		${
			position === 'side'
				? `
		/* =====================================================
		   Side Mode - Floating rail (does not consume thread width)
		   ===================================================== */
		#${CONTROL_BAR_ID} {
			position: fixed !important;
			top: ${SIDE_TOP_OFFSET_PX}px !important;
			left: calc(100vw - ${SIDE_BAR_FALLBACK_WIDTH_PX + SIDE_MIN_INSET_PX}px) !important;
			right: auto !important;
			transform: none !important;
			z-index: 120 !important;
			width: ${SIDE_BAR_FALLBACK_WIDTH_PX}px !important;
			max-width: min(${SIDE_BAR_MAX_WIDTH_PX}px, calc(100vw - ${SIDE_MIN_INSET_PX * 2}px)) !important;
			margin: 0 !important;
			margin-top: 0 !important;
			margin-bottom: 0 !important;
			padding: 0 !important;
			flex-direction: column !important;
			flex-wrap: nowrap !important;
			align-items: stretch !important;
			gap: 0 !important;
			max-height: calc(100vh - 100px) !important;
			overflow-y: auto !important;
			overflow-x: hidden !important;
			background: transparent !important;
			color: inherit !important;
			border: none !important;
			border-radius: 0 !important;
			box-shadow: none !important;
		}

		#${CONTROL_BAR_ID} .mvp-control-group {
			display: block !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} .mvp-control-separator {
			width: 100%;
			height: 1px;
			margin: 10px 0;
			background: color-mix(in srgb, var(--border, #30353a) 80%, transparent);
		}

		#${CONTROL_BAR_ID} .mvp-reply-group + .mvp-control-separator {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions,
		#${CONTROL_BAR_ID} #topic-nav {
			display: block !important;
			width: 100% !important;
			padding: 0 !important;
			border: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions {
			margin: 0 !important;
			padding: 0 !important;
		}

		#${CONTROL_BAR_ID} #more-actions {
			margin-top: 10px !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a,
		#${CONTROL_BAR_ID} #more-actions > a,
		#${CONTROL_BAR_ID} #more-actions .post-btn {
			margin-right: 3px !important;
			margin-bottom: 3px !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a:last-child,
		#${CONTROL_BAR_ID} #more-actions > a:last-child,
		#${CONTROL_BAR_ID} #more-actions .post-btn:last-child {
			margin-right: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a > i,
		#${CONTROL_BAR_ID} #more-actions > a > i,
		#${CONTROL_BAR_ID} #more-actions .post-btn > i {
			margin-right: 5px !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} #${DOM_MARKERS.IDS.GALLERY_BTN} {
			display: inline-flex !important;
			order: 99 !important;
			flex-basis: auto !important;
			align-self: flex-start !important;
			width: auto !important;
			max-width: none !important;
			margin-top: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a {
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			float: none !important;
			margin: 0 8px 0 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a:last-child {
			margin-right: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a.btn-fid,
		#${CONTROL_BAR_ID} #topic-nav .pull-right {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions,
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			text-align: left !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS} {
			display: flex !important;
			flex-direction: column !important;
			align-items: stretch !important;
			gap: 8px !important;
			margin-top: 12px !important;
			padding-top: 12px !important;
			border-top: 1px solid rgba(128, 128, 128, 0.2) !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} {
			display: flex !important;
			flex-wrap: wrap !important;
			align-items: center !important;
			justify-content: flex-start !important;
			align-content: flex-start !important;
			width: 100% !important;
			gap: 4px !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} > * {
			flex: 0 0 auto !important;
			margin: 0 !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: none !important;
			border-top: 1px solid rgba(128, 128, 128, 0.1) !important;
			margin: 0 !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS}:has(#${DOM_MARKERS.IDS.STATUS_ACTIONS} > *) #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: block !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			display: flex !important;
			flex-wrap: wrap !important;
			align-items: center !important;
			justify-content: flex-start !important;
			align-content: flex-start !important;
			gap: 6px !important;
			width: 100% !important;
			margin: 0 !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER} .mvp-save-thread-label {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER} i {
			margin-right: 0 !important;
		}
		`
				: ''
		}

		/* 8. Side navigation - align with content edge (always, not just when affix) */
		#side-nav {
			transform: translateX(-11px) !important;
		}

		/* 9. Dynamic floating video sizing/positioning (managed via JS). */
		body.${ACTIVE_BODY_CLASS} {
			${FLOATING_VIDEO_VAR_RIGHT}: ${SIDE_MIN_INSET_PX}px;
			${FLOATING_VIDEO_VAR_WIDTH}: ${FLOATING_VIDEO_BASE_WIDTH_PX}px;
			${FLOATING_VIDEO_VAR_HEIGHT}: ${Math.round((FLOATING_VIDEO_BASE_WIDTH_PX * 9) / 16)}px;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS},
		body.${ACTIVE_BODY_CLASS} iframe.${FLOATING_VIDEO_CLASS} {
			position: fixed !important;
			left: auto !important;
			right: var(${FLOATING_VIDEO_VAR_RIGHT}) !important;
			top: auto !important;
			bottom: ${FLOATING_VIDEO_BOTTOM_PX}px !important;
			width: var(${FLOATING_VIDEO_VAR_WIDTH}) !important;
			max-width: min(var(${FLOATING_VIDEO_VAR_WIDTH}), calc(100vw - 24px)) !important;
			height: var(${FLOATING_VIDEO_VAR_HEIGHT}) !important;
			max-height: calc(100vh - ${FLOATING_VIDEO_TOP_BUFFER_PX + FLOATING_VIDEO_BOTTOM_PX}px) !important;
			overflow: hidden !important;
			min-width: ${FLOATING_VIDEO_MIN_WIDTH_PX}px !important;
			min-height: ${Math.round((FLOATING_VIDEO_MIN_WIDTH_PX * 9) / 16)}px !important;
			border: 1px solid rgba(255, 255, 255, 0.2) !important;
			border-radius: 8px !important;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
			z-index: ${FLOATING_VIDEO_Z_INDEX} !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} iframe {
			width: 100% !important;
			height: 100% !important;
			max-width: 100% !important;
			max-height: 100% !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}.${FLOATING_VIDEO_INTERACTING_CLASS} {
			box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5) !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}.${FLOATING_VIDEO_INTERACTING_CLASS} iframe {
			pointer-events: none !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} :is(div, section, article, aside, span):has(iframe[src*='youtube.com']),
		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} :is(div, section, article, aside, span):has(iframe[src*='youtube-nocookie.com']),
		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} :is(div, section, article, aside, span):has(iframe[src*='youtu.be']) {
			width: 100% !important;
			height: 100% !important;
			max-width: 100% !important;
			max-height: 100% !important;
			left: 0 !important;
			right: auto !important;
			top: 0 !important;
			bottom: auto !important;
		}

		/* Hide native floating close controls; we inject our own aligned button. */
		${scopedNativeCloseSelectors} {
			display: none !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_DRAG_HANDLE_CLASS} {
			position: absolute !important;
			left: 8px !important;
			right: auto !important;
			top: 6px !important;
			height: 24px !important;
			padding: 0 7px !important;
			min-width: 24px !important;
			border-radius: 999px !important;
			border: 1px solid rgba(255, 255, 255, 0.2) !important;
			background: linear-gradient(180deg, rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.42)) !important;
			backdrop-filter: blur(2px);
			display: inline-flex !important;
			align-items: center !important;
			gap: 6px !important;
			cursor: move !important;
			opacity: 0 !important;
			transform: translateY(-4px);
			pointer-events: none !important;
			transition: opacity 140ms ease, transform 140ms ease !important;
			z-index: ${FLOATING_VIDEO_Z_INDEX + 1} !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}:hover .${FLOATING_VIDEO_DRAG_HANDLE_CLASS},
		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}.${FLOATING_VIDEO_INTERACTING_CLASS} .${FLOATING_VIDEO_DRAG_HANDLE_CLASS} {
			opacity: 1 !important;
			transform: translateY(0);
			pointer-events: auto !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_DRAG_HANDLE_CLASS}::before {
			content: "::";
			color: rgba(255, 255, 255, 0.9);
			font-size: 11px;
			letter-spacing: 1px;
			font-weight: 700;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_DRAG_LABEL_CLASS} {
			display: none !important;
			font-size: 10px !important;
			letter-spacing: 0.2px !important;
			text-transform: uppercase !important;
			color: rgba(255, 255, 255, 0.85) !important;
			pointer-events: none !important;
			user-select: none !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_DRAG_HANDLE_CLASS}:hover .${FLOATING_VIDEO_DRAG_LABEL_CLASS},
		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}.${FLOATING_VIDEO_INTERACTING_CLASS} .${FLOATING_VIDEO_DRAG_LABEL_CLASS} {
			display: inline !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_RESIZE_HANDLE_CLASS} {
			position: absolute !important;
			right: 5px !important;
			bottom: 5px !important;
			width: 22px !important;
			height: 22px !important;
			border-right: 2px solid rgba(255, 255, 255, 0.85) !important;
			border-bottom: 2px solid rgba(255, 255, 255, 0.85) !important;
			border-bottom-right-radius: 3px !important;
			background: linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.35) 50%) !important;
			cursor: nwse-resize !important;
			opacity: 0 !important;
			transform: scale(0.92);
			pointer-events: none !important;
			transition: opacity 140ms ease, transform 140ms ease !important;
			z-index: ${FLOATING_VIDEO_Z_INDEX + 1} !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}:hover .${FLOATING_VIDEO_RESIZE_HANDLE_CLASS},
		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS}.${FLOATING_VIDEO_INTERACTING_CLASS} .${FLOATING_VIDEO_RESIZE_HANDLE_CLASS} {
			opacity: 1 !important;
			transform: scale(1);
			pointer-events: auto !important;
		}

		body.${ACTIVE_BODY_CLASS} .${FLOATING_VIDEO_CLASS} .${FLOATING_VIDEO_CLOSE_BUTTON_CLASS} {
			position: absolute !important;
			top: 6px !important;
			right: 6px !important;
			width: 22px !important;
			height: 22px !important;
			border: 0 !important;
			border-radius: 999px !important;
			background: rgba(0, 0, 0, 0.65) !important;
			color: #fff !important;
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			font-size: 14px !important;
			line-height: 1 !important;
			cursor: pointer !important;
			z-index: ${FLOATING_VIDEO_Z_INDEX + 2} !important;
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

function resolveControlBarPosition(
	requested: ControlBarPosition,
	pageKind: CenteredPostsPageKind
): ControlBarPosition {
	if (pageKind !== 'thread') return 'top'
	if (requested !== 'side') return 'top'
	return window.innerWidth >= SIDE_LAYOUT_MIN_WIDTH ? 'side' : 'top'
}

function getPrimaryThreadContainer(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>('#topic') ||
		document.querySelector<HTMLElement>('#posts-wrap') ||
		document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.MAIN_CONTENT)
	)
}

function getFirstThreadPost(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>('#posts-wrap > .post') ||
		document.querySelector<HTMLElement>('#posts-wrap .post')
	)
}

function clampSidebarWidth(widthPx: number): number {
	return Math.max(SIDE_BAR_MIN_WIDTH_PX, Math.min(SIDE_BAR_MAX_WIDTH_PX, Math.round(widthPx)))
}

function measureNativeSidebarWidth(): number {
	const sidebar = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return cachedSidebarWidthPx

	const rectWidth = sidebar.getBoundingClientRect().width
	const computedStyle = window.getComputedStyle(sidebar)
	const cssWidth = Number.parseFloat(computedStyle.width)
	const cssBasis = Number.parseFloat(computedStyle.flexBasis)

	const measuredWidth = [rectWidth, cssWidth, cssBasis].find(value => Number.isFinite(value) && value > 0)
	if (measuredWidth) {
		cachedSidebarWidthPx = clampSidebarWidth(measuredWidth)
	}

	return cachedSidebarWidthPx
}

function positionSideControlBar(): void {
	if (appliedPosition !== 'side') return

	const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null
	const container = getPrimaryThreadContainer()
	if (!bar || !container) return

	const containerRect = container.getBoundingClientRect()
	const firstPostRect = getFirstThreadPost()?.getBoundingClientRect()
	const anchorRect = firstPostRect ?? containerRect
	const measuredSidebarWidth = measureNativeSidebarWidth()
	const maxWidthByViewport = Math.max(SIDE_BAR_MIN_WIDTH_PX, window.innerWidth - SIDE_MIN_INSET_PX * 2)
	const targetWidth = Math.min(measuredSidebarWidth, maxWidthByViewport)

	bar.style.setProperty('width', `${targetWidth}px`, 'important')
	bar.style.setProperty('max-width', `${targetWidth}px`, 'important')

	const barRect = bar.getBoundingClientRect()
	const barWidth = Math.max(SIDE_BAR_MIN_WIDTH_PX, Math.round(barRect.width))
	const preferredLeft = Math.round(anchorRect.right + SIDE_BAR_GAP_PX)
	const maxLeft = Math.round(window.innerWidth - barWidth - SIDE_MIN_INSET_PX)
	const clampedLeft = Math.max(SIDE_MIN_INSET_PX, Math.min(preferredLeft, maxLeft))

	const barHeight = Math.max(160, Math.round(barRect.height))
	const maxTop = Math.max(SIDE_MIN_INSET_PX, window.innerHeight - barHeight - SIDE_MIN_INSET_PX)
	const measuredTop = firstPostRect ? Math.round(firstPostRect.top + 2) : SIDE_TOP_OFFSET_PX
	const normalizedMeasuredTop = Math.max(SIDE_TOP_MIN_PX, measuredTop)
	if (sideStableTopPx === null || normalizedMeasuredTop > sideStableTopPx) {
		sideStableTopPx = normalizedMeasuredTop
	}
	const preferredTop = sideStableTopPx ?? normalizedMeasuredTop
	const clampedTop = Math.max(SIDE_TOP_MIN_PX, Math.min(preferredTop, maxTop))

	bar.style.left = `${clampedLeft}px`
	bar.style.right = 'auto'
	bar.style.top = `${clampedTop}px`
	bar.style.transform = 'none'

	// Override side-mode fallback CSS rules that use !important.
	bar.style.setProperty('left', `${clampedLeft}px`, 'important')
	bar.style.setProperty('right', 'auto', 'important')
	bar.style.setProperty('top', `${clampedTop}px`, 'important')
	bar.style.setProperty('transform', 'none', 'important')

	scheduleFloatingVideoLayoutUpdate()
}

function getFloatingVideoHost(): HTMLElement {
	return document.body ?? document.documentElement
}

function clearFloatingVideoCssVars(): void {
	const host = getFloatingVideoHost()
	host.style.removeProperty(FLOATING_VIDEO_VAR_RIGHT)
	host.style.removeProperty(FLOATING_VIDEO_VAR_WIDTH)
	host.style.removeProperty(FLOATING_VIDEO_VAR_HEIGHT)
}

function clearFloatingVideoTargets(): void {
	document.querySelectorAll<HTMLElement>(`.${FLOATING_VIDEO_CLASS}`).forEach(element => {
		element.style.removeProperty('display')
		element.classList.remove(FLOATING_VIDEO_CLASS)
		element.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
		element.removeAttribute(FLOATING_VIDEO_INTERACTIVE_ATTR)
		element.querySelector(`.${FLOATING_VIDEO_DRAG_HANDLE_CLASS}`)?.remove()
		element.querySelector(`.${FLOATING_VIDEO_RESIZE_HANDLE_CLASS}`)?.remove()
		element.querySelector(`.${FLOATING_VIDEO_CLOSE_BUTTON_CLASS}`)?.remove()
	})
}

function clampFloatingVideoManualState(state: FloatingVideoManualState): FloatingVideoManualState {
	const minWidth = Math.min(FLOATING_VIDEO_MIN_WIDTH_PX, Math.max(180, window.innerWidth - SIDE_MIN_INSET_PX * 2))
	const maxWidth = Math.max(minWidth, window.innerWidth - SIDE_MIN_INSET_PX * 2)
	const widthPx = Math.min(maxWidth, Math.max(minWidth, Math.round(state.widthPx)))
	const heightPx = Math.round((widthPx * 9) / 16)
	const maxLeft = Math.max(SIDE_MIN_INSET_PX, window.innerWidth - widthPx - SIDE_MIN_INSET_PX)
	const maxTop = Math.max(FLOATING_VIDEO_TOP_BUFFER_PX, window.innerHeight - heightPx - SIDE_MIN_INSET_PX)
	const leftPx = Math.max(SIDE_MIN_INSET_PX, Math.min(Math.round(state.leftPx), maxLeft))
	const topPx = Math.max(FLOATING_VIDEO_TOP_BUFFER_PX, Math.min(Math.round(state.topPx), maxTop))

	return { widthPx, heightPx, leftPx, topPx }
}

function applyFloatingVideoManualState(target: HTMLElement): void {
	if (!floatingVideoManualState) return

	const clamped = clampFloatingVideoManualState(floatingVideoManualState)
	floatingVideoManualState = clamped

	target.style.setProperty('left', `${clamped.leftPx}px`, 'important')
	target.style.setProperty('top', `${clamped.topPx}px`, 'important')
	target.style.setProperty('right', 'auto', 'important')
	target.style.setProperty('bottom', 'auto', 'important')
	target.style.setProperty('width', `${clamped.widthPx}px`, 'important')
	target.style.setProperty('height', `${clamped.heightPx}px`, 'important')
	target.style.setProperty('max-width', `${clamped.widthPx}px`, 'important')
	target.style.setProperty('max-height', `${clamped.heightPx}px`, 'important')
}

function setFloatingVideoManualState(nextState: FloatingVideoManualState, target: HTMLElement): void {
	floatingVideoManualState = clampFloatingVideoManualState(nextState)
	applyFloatingVideoManualState(target)
}

function clearFloatingVideoManualState(target: HTMLElement): void {
	floatingVideoManualState = null
	target.style.removeProperty('left')
	target.style.removeProperty('top')
	target.style.removeProperty('right')
	target.style.removeProperty('bottom')
	target.style.removeProperty('width')
	target.style.removeProperty('height')
	target.style.removeProperty('max-width')
	target.style.removeProperty('max-height')
}

function findNativeFloatingVideoCloseControl(target: HTMLElement): HTMLElement | null {
	const roots: HTMLElement[] = [target]
	let current = target.parentElement

	// Walk up only positioned ancestors around the floating player.
	// This avoids matching unrelated ".close" controls elsewhere on the page.
	while (current && current !== document.body && current !== document.documentElement) {
		const position = window.getComputedStyle(current).position
		if (position === 'fixed' || position === 'absolute') {
			roots.push(current)
		}
		current = current.parentElement
	}

	for (const root of roots) {
		const candidates = root.querySelectorAll<HTMLElement>(FLOATING_VIDEO_CLOSE_SELECTORS)
		for (const candidate of candidates) {
			if (candidate.classList.contains(FLOATING_VIDEO_CLOSE_BUTTON_CLASS)) continue
			return candidate
		}
	}

	return null
}

function hideFloatingVideoTarget(target: HTMLElement): void {
	const nativeClose = findNativeFloatingVideoCloseControl(target)
	if (nativeClose) {
		nativeClose.click()
	}

	floatingVideoManualState = null
	target.style.removeProperty('display')
	target.classList.remove(FLOATING_VIDEO_CLASS)
	target.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
	target.removeAttribute(FLOATING_VIDEO_INTERACTIVE_ATTR)
	target.querySelector(`.${FLOATING_VIDEO_DRAG_HANDLE_CLASS}`)?.remove()
	target.querySelector(`.${FLOATING_VIDEO_RESIZE_HANDLE_CLASS}`)?.remove()
	target.querySelector(`.${FLOATING_VIDEO_CLOSE_BUTTON_CLASS}`)?.remove()

	// Let native MV lifecycle restore/move the player; then refresh our hooks.
	window.setTimeout(() => {
		scheduleFloatingVideoLayoutUpdate()
	}, 0)
}

function getFloatingVideoRightInsetPx(): number {
	if (appliedPosition !== 'side') return SIDE_MIN_INSET_PX

	const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null
	if (!bar) return SIDE_MIN_INSET_PX

	const style = window.getComputedStyle(bar)
	if (style.position !== 'fixed' || style.visibility === 'hidden') {
		return SIDE_MIN_INSET_PX
	}

	const rect = bar.getBoundingClientRect()
	if (rect.width <= 0) return SIDE_MIN_INSET_PX

	const occupiedFromRightPx = Math.max(0, Math.round(window.innerWidth - rect.left))
	return Math.max(SIDE_MIN_INSET_PX, occupiedFromRightPx + SIDE_BAR_GAP_PX)
}

function updateFloatingVideoCssVars(): void {
	const host = getFloatingVideoHost()
	const rightInsetPx = getFloatingVideoRightInsetPx()
	const availableWidthPx = Math.max(220, window.innerWidth - rightInsetPx - SIDE_MIN_INSET_PX)
	const viewportTargetWidthPx = Math.round(window.innerWidth * 0.28)

	let widthPx = Math.min(
		FLOATING_VIDEO_MAX_WIDTH_PX,
		Math.max(FLOATING_VIDEO_MIN_WIDTH_PX, viewportTargetWidthPx, FLOATING_VIDEO_BASE_WIDTH_PX)
	)

	widthPx = Math.min(widthPx, availableWidthPx)
	if (availableWidthPx < FLOATING_VIDEO_MIN_WIDTH_PX) {
		widthPx = Math.max(220, availableWidthPx)
	}

	const scrollProgress = Math.min(1, Math.max(0, window.scrollY / FLOATING_VIDEO_SCROLL_SHRINK_DISTANCE_PX))
	const scrollShrinkPx = Math.round(FLOATING_VIDEO_SCROLL_SHRINK_MAX_PX * scrollProgress)
	widthPx = Math.max(220, widthPx - scrollShrinkPx)

	let heightPx = Math.round((widthPx * 9) / 16)
	const maxHeightPx = Math.max(120, window.innerHeight - FLOATING_VIDEO_TOP_BUFFER_PX - FLOATING_VIDEO_BOTTOM_PX)
	if (heightPx > maxHeightPx) {
		heightPx = maxHeightPx
		widthPx = Math.min(widthPx, Math.max(220, Math.round((heightPx * 16) / 9)))
	}

	host.style.setProperty(FLOATING_VIDEO_VAR_RIGHT, `${rightInsetPx}px`)
	host.style.setProperty(FLOATING_VIDEO_VAR_WIDTH, `${Math.round(widthPx)}px`)
	host.style.setProperty(FLOATING_VIDEO_VAR_HEIGHT, `${Math.round(heightPx)}px`)
}

function attachFloatingVideoInteractions(target: HTMLElement): void {
	if (target.getAttribute(FLOATING_VIDEO_INTERACTIVE_ATTR) === 'true') return

	target.setAttribute(FLOATING_VIDEO_INTERACTIVE_ATTR, 'true')

	const dragHandle = document.createElement('div')
	dragHandle.className = FLOATING_VIDEO_DRAG_HANDLE_CLASS
	dragHandle.title = 'Arrastra para mover. Doble click para reposicionar automaticamente.'

	const dragLabel = document.createElement('span')
	dragLabel.className = FLOATING_VIDEO_DRAG_LABEL_CLASS
	dragLabel.textContent = 'Mover'
	dragHandle.appendChild(dragLabel)

	const resizeHandle = document.createElement('div')
	resizeHandle.className = FLOATING_VIDEO_RESIZE_HANDLE_CLASS
	resizeHandle.title = 'Arrastra para redimensionar'

	const closeButton = document.createElement('button')
	closeButton.type = 'button'
	closeButton.className = FLOATING_VIDEO_CLOSE_BUTTON_CLASS
	closeButton.setAttribute('aria-label', 'Quitar video flotante')
	closeButton.title = 'Cerrar video flotante'
	closeButton.textContent = '×'
	closeButton.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		hideFloatingVideoTarget(target)
	})

	const startDrag = (event: PointerEvent) => {
		event.preventDefault()
		event.stopPropagation()
		target.classList.add(FLOATING_VIDEO_INTERACTING_CLASS)
		const pointerId = event.pointerId
		try {
			dragHandle.setPointerCapture(pointerId)
		} catch {
			// Ignore browsers that reject pointer capture in this context.
		}

		const startRect = target.getBoundingClientRect()
		const startX = event.clientX
		const startY = event.clientY
		let finished = false

		const onMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX
			const dy = moveEvent.clientY - startY
			setFloatingVideoManualState(
				{
					widthPx: startRect.width,
					heightPx: startRect.height,
					leftPx: startRect.left + dx,
					topPx: startRect.top + dy,
				},
				target
			)
		}

		const finish = () => {
			if (finished) return
			finished = true

			target.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
			if (dragHandle.hasPointerCapture(pointerId)) {
				dragHandle.releasePointerCapture(pointerId)
			}

			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', finish)
			window.removeEventListener('pointercancel', finish)
			window.removeEventListener('blur', finish)
			dragHandle.removeEventListener('lostpointercapture', finish)
		}

		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', finish)
		window.addEventListener('pointercancel', finish)
		window.addEventListener('blur', finish)
		dragHandle.addEventListener('lostpointercapture', finish)
	}

	const startResize = (event: PointerEvent) => {
		event.preventDefault()
		event.stopPropagation()
		target.classList.add(FLOATING_VIDEO_INTERACTING_CLASS)
		const pointerId = event.pointerId
		try {
			resizeHandle.setPointerCapture(pointerId)
		} catch {
			// Ignore browsers that reject pointer capture in this context.
		}

		const startRect = target.getBoundingClientRect()
		const startLeft = startRect.left
		const startTop = startRect.top
		let finished = false

		const onMove = (moveEvent: PointerEvent) => {
			const widthByX = moveEvent.clientX - startLeft
			const widthByY = (moveEvent.clientY - startTop) * (16 / 9)
			const widthPx = Math.max(widthByX, widthByY)
			const heightPx = Math.round((widthPx * 9) / 16)

			setFloatingVideoManualState(
				{
					widthPx,
					heightPx,
					leftPx: startRect.left,
					topPx: startRect.top,
				},
				target
			)
		}

		const finish = () => {
			if (finished) return
			finished = true

			target.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
			if (resizeHandle.hasPointerCapture(pointerId)) {
				resizeHandle.releasePointerCapture(pointerId)
			}

			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', finish)
			window.removeEventListener('pointercancel', finish)
			window.removeEventListener('blur', finish)
			resizeHandle.removeEventListener('lostpointercapture', finish)
		}

		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', finish)
		window.addEventListener('pointercancel', finish)
		window.addEventListener('blur', finish)
		resizeHandle.addEventListener('lostpointercapture', finish)
	}

	dragHandle.addEventListener('pointerdown', startDrag)
	resizeHandle.addEventListener('pointerdown', startResize)
	target.addEventListener('pointerleave', leaveEvent => {
		if (leaveEvent.buttons === 0) {
			target.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
		}
	})
	dragHandle.addEventListener('dblclick', event => {
		event.preventDefault()
		event.stopPropagation()
		clearFloatingVideoManualState(target)
		scheduleFloatingVideoLayoutUpdate()
	})

	target.appendChild(dragHandle)
	target.appendChild(resizeHandle)
	target.appendChild(closeButton)
}

function findFixedVideoTarget(iframe: HTMLIFrameElement): HTMLElement | null {
	const fixedAncestors: HTMLElement[] = []
	let current: HTMLElement | null = iframe

	while (current) {
		const position = window.getComputedStyle(current).position
		if (position === 'fixed') {
			fixedAncestors.push(current)
		}

		if (current === document.body || current === document.documentElement) {
			break
		}

		current = current.parentElement
	}

	if (fixedAncestors.length === 0) return null

	const iframeRect = iframe.getBoundingClientRect()
	const closestSizedAncestor = fixedAncestors.find(candidate => {
		const rect = candidate.getBoundingClientRect()
		return rect.width >= Math.max(iframeRect.width - 8, 120) && rect.height >= Math.max(iframeRect.height - 8, 68)
	})

	// Prefer the closest fixed ancestor around the real player.
	// This avoids selecting giant overlays where native X appears far away.
	return closestSizedAncestor ?? fixedAncestors[0]
}

function refreshFloatingVideoTargets(): void {
	const activeTargets = new Set<HTMLElement>()
	const iframes = document.querySelectorAll<HTMLIFrameElement>(FLOATING_VIDEO_IFRAME_SELECTOR)

	iframes.forEach(iframe => {
		const target = findFixedVideoTarget(iframe)
		if (!target) return

		activeTargets.add(target)
		target.classList.add(FLOATING_VIDEO_CLASS)
		attachFloatingVideoInteractions(target)

		if (floatingVideoManualState) {
			applyFloatingVideoManualState(target)
		}
	})

	document.querySelectorAll<HTMLElement>(`.${FLOATING_VIDEO_CLASS}`).forEach(element => {
		if (!activeTargets.has(element)) {
			element.style.removeProperty('display')
			element.classList.remove(FLOATING_VIDEO_CLASS)
			element.classList.remove(FLOATING_VIDEO_INTERACTING_CLASS)
			element.removeAttribute(FLOATING_VIDEO_INTERACTIVE_ATTR)
			element.querySelector(`.${FLOATING_VIDEO_DRAG_HANDLE_CLASS}`)?.remove()
			element.querySelector(`.${FLOATING_VIDEO_RESIZE_HANDLE_CLASS}`)?.remove()
			element.querySelector(`.${FLOATING_VIDEO_CLOSE_BUTTON_CLASS}`)?.remove()
		}
	})
}

function updateFloatingVideoLayout(): void {
	const pageKind = getCenteredPostsPageKind()
	if (!requestedEnabled || pageKind !== 'thread') {
		clearFloatingVideoTargets()
		clearFloatingVideoCssVars()
		return
	}

	updateFloatingVideoCssVars()
	refreshFloatingVideoTargets()
}

function scheduleFloatingVideoLayoutUpdate(): void {
	if (floatingVideoRafId) return

	floatingVideoRafId = window.requestAnimationFrame(() => {
		floatingVideoRafId = undefined
		updateFloatingVideoLayout()
	})
}

function handleFloatingVideoViewportChange(): void {
	scheduleFloatingVideoLayoutUpdate()
}

function startFloatingVideoGuard(): void {
	if (!floatingVideoListenersAttached) {
		window.addEventListener('scroll', handleFloatingVideoViewportChange, { passive: true })
		window.addEventListener('resize', handleFloatingVideoViewportChange)
		floatingVideoListenersAttached = true
	}

	if (!floatingVideoObserver) {
		const root = document.body ?? document.documentElement
		floatingVideoObserver = new MutationObserver(() => {
			scheduleFloatingVideoLayoutUpdate()
		})
		floatingVideoObserver.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class'],
		})
	}

	scheduleFloatingVideoLayoutUpdate()
}

function stopFloatingVideoGuard(): void {
	if (floatingVideoObserver) {
		floatingVideoObserver.disconnect()
		floatingVideoObserver = null
	}

	if (floatingVideoListenersAttached) {
		window.removeEventListener('scroll', handleFloatingVideoViewportChange)
		window.removeEventListener('resize', handleFloatingVideoViewportChange)
		floatingVideoListenersAttached = false
	}

	if (floatingVideoRafId) {
		window.cancelAnimationFrame(floatingVideoRafId)
		floatingVideoRafId = undefined
	}

	clearFloatingVideoTargets()
	clearFloatingVideoCssVars()
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
function injectControlBar(position: ControlBarPosition): void {
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
		if (position === 'side') {
			// Preserve native sidebar-like spacing in side mode.
			extraActions.style.borderTop = '1px solid rgba(128, 128, 128, 0.2)'
			extraActions.style.marginTop = '12px'
			extraActions.style.paddingTop = '12px'
			extraActions.style.flexDirection = 'column'
		} else {
			extraActions.style.borderTop = 'none'
			extraActions.style.marginTop = '0'
			extraActions.style.paddingTop = '0'
			extraActions.style.flexDirection = 'row'
		}
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
 * Reacts to viewport changes when side mode is enabled.
 * If there is not enough lateral space, the bar falls back to top mode.
 */
function initResponsivePositionListener(): void {
	if (resizeListenerInitialized) return
	resizeListenerInitialized = true

	window.addEventListener('resize', () => {
		if (!requestedEnabled || requestedPosition !== 'side') return

		const pageKind = getCenteredPostsPageKind()
		if (pageKind !== 'thread') return

		// Reposition immediately while resizing to avoid temporary overlap over posts.
		if (resizeRafId) {
			window.cancelAnimationFrame(resizeRafId)
		}
		resizeRafId = window.requestAnimationFrame(() => {
			resizeRafId = undefined
			const nextPosition = resolveControlBarPosition(requestedPosition, pageKind)
			const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null

			if (nextPosition === 'side') {
				if (bar) {
					bar.style.removeProperty('visibility')
					bar.style.removeProperty('pointer-events')
				}
				if (appliedPosition === 'side') {
					positionSideControlBar()
				}
				return
			}

			// While waiting for debounced mode switch (side -> top), hide the rail.
			if (bar && appliedPosition === 'side') {
				bar.style.setProperty('visibility', 'hidden', 'important')
				bar.style.setProperty('pointer-events', 'none', 'important')
			}
		})

		if (resizeDebounceId) {
			window.clearTimeout(resizeDebounceId)
		}

		resizeDebounceId = window.setTimeout(() => {
			const nextPosition = resolveControlBarPosition(requestedPosition, pageKind)
			const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null
			if (bar) {
				bar.style.removeProperty('visibility')
				bar.style.removeProperty('pointer-events')
			}

			if (nextPosition === appliedPosition) {
				if (nextPosition === 'side') {
					positionSideControlBar()
				}
				return
			}

			applyCenteredPosts(requestedEnabled, requestedSticky, requestedPosition)
		}, RESIZE_DEBOUNCE_MS)
	})
}

/**
 * Applies or removes the centered posts mode
 * @param enabled - Whether to enable centered posts
 * @param sticky - Whether the control bar should be sticky
 * @param requestedControlPosition - Desired control bar placement
 */
function applyCenteredPosts(
	enabled: boolean,
	sticky: boolean = false,
	requestedControlPosition: ControlBarPosition = 'top'
): void {
	logger.debug('CenteredPosts: applyCenteredPosts called with enabled =', enabled)
	requestedEnabled = enabled
	requestedSticky = sticky
	requestedPosition = requestedControlPosition

	// Update cache for next page load
	updateCache(enabled)

	const pageKind = getCenteredPostsPageKind()
	const isSupportedPage = pageKind !== 'unsupported'
	const classTarget = document.body ?? document.documentElement

	// Remove existing styles (both main and early-inject to avoid duplication)
	const existingStyle = document.getElementById(STYLE_ID)
	if (existingStyle) {
		existingStyle.remove()
	}

	const earlyStyle = document.getElementById(EARLY_STYLE_ID)
	if (earlyStyle) {
		earlyStyle.remove()
	}

	if (!enabled || !isSupportedPage) {
		classTarget?.classList.remove(ACTIVE_BODY_CLASS)
		if (resizeDebounceId) {
			window.clearTimeout(resizeDebounceId)
			resizeDebounceId = undefined
		}
		if (resizeRafId) {
			window.cancelAnimationFrame(resizeRafId)
			resizeRafId = undefined
		}
		appliedPosition = null
		sideStableTopPx = null
		removeControlBar()
		stopFloatingVideoGuard()
		return
	}

	classTarget?.classList.add(ACTIVE_BODY_CLASS)

	const resolvedPosition = resolveControlBarPosition(requestedControlPosition, pageKind)
	if (resolvedPosition === 'side') {
		sideStableTopPx = null
		measureNativeSidebarWidth()
	} else {
		sideStableTopPx = null
	}

	// Create and inject styles
	const styleEl = document.createElement('style')
	styleEl.id = STYLE_ID
	styleEl.textContent = generateStyles(sticky, resolvedPosition)
	document.head.appendChild(styleEl)
	logger.debug('CenteredPosts: Stylesheet injected with id', STYLE_ID)

	if (pageKind === 'thread') {
		// Inject control bar by MOVING native sidebar elements
		// This preserves all event listeners since we move, not clone
		injectControlBar(resolvedPosition)
		appliedPosition = resolvedPosition

		if (resolvedPosition === 'side') {
			positionSideControlBar()
			requestAnimationFrame(() => positionSideControlBar())
			window.setTimeout(() => positionSideControlBar(), 220)
			window.setTimeout(() => positionSideControlBar(), 900)
		}

		startFloatingVideoGuard()
		return
	}

	// Listing mode: apply layout styles only (no control bar relocation)
	appliedPosition = null
	removeControlBar()
	stopFloatingVideoGuard()
}

/**
 * Initializes the centered posts feature
 */
export async function initCenteredPosts(): Promise<void> {
	try {
		initResponsivePositionListener()

		// Get initial settings
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
			const enabled = parsed?.state?.centeredPostsEnabled ?? false
			const sticky = parsed?.state?.centeredControlsSticky ?? false
			const position: ControlBarPosition = parsed?.state?.centeredControlsPosition === 'side' ? 'side' : 'top'
			applyCenteredPosts(enabled, sticky, position)
		}

		// Watch for changes
		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const parsed: SettingsState = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
				const enabled = parsed?.state?.centeredPostsEnabled ?? false
				const sticky = parsed?.state?.centeredControlsSticky ?? false
				const position: ControlBarPosition = parsed?.state?.centeredControlsPosition === 'side' ? 'side' : 'top'
				applyCenteredPosts(enabled, sticky, position)
			} catch (e) {
				logger.error('CenteredPosts error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('CenteredPosts failed to initialize:', error)
	}
}
