/**
 * Mobile Lite Quote Selection
 *
 * Mediavida shows a native "citar" button when text inside a post is selected
 * (`<button class="btn btn-primary quote">`, appended as a direct child of
 * `<body>` and absolutely positioned just ABOVE the selection). On Firefox
 * Android that is exactly where the OS draws its own text-selection menu
 * (Copiar / Compartir / Seleccionar todo), which covers the button completely.
 *
 * This module repositions that native button BELOW the selection instead,
 * keeping Mediavida's own click handler — and its `[quote=user:num]` insertion
 * into the reply textarea — untouched. Positioning is driven by observers, not
 * polling: a childList observer on `<body>` catches the button being (re)added
 * and a style-attribute observer catches Mediavida rewriting its coordinates.
 */
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { getSettings } from '@/store/settings-store'

const STYLE_ID = 'mvp-mobile-lite-quote-selection-styles'
const QUOTE_BUTTON_SELECTOR = 'body > button.btn.btn-primary.quote'
/** Clears the draggable selection handles Android renders below the selection */
const BELOW_SELECTION_OFFSET_PX = 24
const VIEWPORT_EDGE_MARGIN_PX = 8
/** Used before the button has been laid out (and in jsdom, where layout is absent) */
const FALLBACK_BUTTON_WIDTH_PX = 64
const SELECTION_DEBOUNCE_MS = 80

let initialized = false
let enabled = true
let bodyObserver: MutationObserver | null = null
let buttonObserver: MutationObserver | null = null
let observedButton: HTMLElement | null = null
let selectionTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteQuoteSelectionAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function getQuoteButton(): HTMLElement | null {
	return document.querySelector<HTMLElement>(QUOTE_BUTTON_SELECTOR)
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	// 44px touch target (DESIGN.md §3) without altering the button's native look.
	style.textContent = `
		${QUOTE_BUTTON_SELECTOR} {
			min-height: 44px;
			padding: 10px 18px;
		}
	`
	document.head.appendChild(style)
}

function removeStyles(): void {
	document.getElementById(STYLE_ID)?.remove()
}

function getSelectionRect(): DOMRect | null {
	const selection = window.getSelection()
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

	const rect = selection.getRangeAt(0).getBoundingClientRect()
	if (rect.width === 0 && rect.height === 0) return null
	return rect
}

function repositionQuoteButton(button: HTMLElement): void {
	if (!enabled) return
	if (button.style.display === 'none') return

	const rect = getSelectionRect()
	if (!rect) return

	const buttonWidth = button.offsetWidth || FALLBACK_BUTTON_WIDTH_PX
	const top = Math.round(rect.bottom + window.scrollY + BELOW_SELECTION_OFFSET_PX)
	const centeredLeft = rect.left + rect.width / 2 - buttonWidth / 2
	const maxLeft = Math.max(window.innerWidth - buttonWidth - VIEWPORT_EDGE_MARGIN_PX, VIEWPORT_EDGE_MARGIN_PX)
	const left = Math.round(Math.min(Math.max(centeredLeft, VIEWPORT_EDGE_MARGIN_PX), maxLeft) + window.scrollX)

	const nextTop = `${top}px`
	const nextLeft = `${left}px`
	// Writing style re-triggers the attribute observer; only write when the values
	// actually change so the observer → reposition cycle terminates immediately.
	if (button.style.top === nextTop && button.style.left === nextLeft) return
	button.style.top = nextTop
	button.style.left = nextLeft
}

function observeButton(button: HTMLElement): void {
	if (observedButton === button) return

	buttonObserver?.disconnect()
	observedButton = button
	buttonObserver = new MutationObserver(() => repositionQuoteButton(button))
	buttonObserver.observe(button, { attributes: true, attributeFilter: ['style'] })
	repositionQuoteButton(button)
}

function handleBodyMutations(): void {
	const button = getQuoteButton()
	if (!button) {
		buttonObserver?.disconnect()
		buttonObserver = null
		observedButton = null
		return
	}

	observeButton(button)
}

/**
 * Android lets the user drag the selection handles without Mediavida rewriting
 * the button position; a debounced selectionchange keeps the button glued to
 * the (new) selection in that case.
 */
function handleSelectionChange(): void {
	if (selectionTimeout) clearTimeout(selectionTimeout)
	selectionTimeout = setTimeout(() => {
		selectionTimeout = null
		const button = getQuoteButton()
		if (!button) return
		observeButton(button)
		repositionQuoteButton(button)
	}, SELECTION_DEBOUNCE_MS)
}

function applyEnabledState(nextEnabled: boolean): void {
	enabled = nextEnabled
	if (!initialized) return

	if (!enabled) {
		removeStyles()
		return
	}

	ensureStyles()
	const button = getQuoteButton()
	if (button) {
		observeButton(button)
		repositionQuoteButton(button)
	}
}

export async function syncMobileLiteQuoteSelection(enabledOverride?: boolean): Promise<void> {
	if (enabledOverride !== undefined) {
		applyEnabledState(enabledOverride)
		return
	}

	const settings = await getSettings()
	applyEnabledState(settings.quoteSelectionEnabled !== false)
}

export function initMobileLiteQuoteSelection(): void {
	if (!isMobileLiteQuoteSelectionAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true

	void getSettings()
		.then(settings => applyEnabledState(settings.quoteSelectionEnabled !== false))
		.catch(error => {
			logger.error('Error loading Mobile Lite quote selection setting:', error)
			applyEnabledState(true)
		})

	bodyObserver = new MutationObserver(handleBodyMutations)
	bodyObserver.observe(document.body, { childList: true })
	document.addEventListener('selectionchange', handleSelectionChange, { passive: true })
	handleBodyMutations()
}

export function teardownMobileLiteQuoteSelection(): void {
	if (selectionTimeout) {
		clearTimeout(selectionTimeout)
		selectionTimeout = null
	}

	document.removeEventListener('selectionchange', handleSelectionChange)
	bodyObserver?.disconnect()
	bodyObserver = null
	buttonObserver?.disconnect()
	buttonObserver = null
	observedButton = null
	removeStyles()
	initialized = false
}
