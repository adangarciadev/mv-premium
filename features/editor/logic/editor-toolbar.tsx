/**
 * Editor Toolbar Injection
 *
 * Distributed injection: places buttons in semantically correct positions
 * within the native Mediavida editor toolbar.
 *
 * Groups:
 * 1. Formatting (Underline, Center) → after Italic
 * 2. Media (Upload Image, Movie Card) → after Twitter
 * 3. Code (dropdown) → replaces native Code button
 * 4. Structure (Lists, Table, Poll) → new group before Smileys
 * 5. Tools (Drafts, Preview) → after Smileys
 */
import { createElement } from 'react'
import { DraftManager } from '@/features/drafts/components/draft-manager'
import {
	isAlreadyInjected,
	markAsInjected,
	mountFeature,
	isFeatureMounted,
} from '@/lib/content-modules/utils/react-helpers'
import { DistributedEditorToolbar } from '../components/distributed-editor-toolbar'
import { isImageUrl } from './image-detector'
import { isMediaUrl, normalizeMediaUrl } from './media-detector'
import { Z_INDEXES, FEATURE_IDS, DOM_MARKERS, MV_SELECTORS } from '@/constants'

const TOOLBAR_MARKER = DOM_MARKERS.EDITOR.TOOLBAR
const PASTE_MARKER = DOM_MARKERS.EDITOR.PASTE
const INJECTED_MARKER = DOM_MARKERS.EDITOR.GENERIC_INJECTED
const COUNTER_MARKER = DOM_MARKERS.EDITOR.COUNTER
const DRAFT_MARKER = DOM_MARKERS.EDITOR.DRAFT

// Counter for unique feature IDs
let toolbarCounter = 0
let draftCounter = 0

/**
 * Injects a live character counter into the bottom-right of textareas
 */
export function injectCharacterCounter(): void {
	const textareas = document.querySelectorAll(
		`${MV_SELECTORS.EDITOR.TEXTAREA_ALL}, ${MV_SELECTORS.MESSAGES.TEXTAREA}`
	)

	textareas.forEach(textarea => {
		if (isAlreadyInjected(textarea, COUNTER_MARKER)) return
		markAsInjected(textarea, COUNTER_MARKER)

		const ta = textarea as HTMLTextAreaElement
		ta.style.resize = 'vertical'

		const counter = document.createElement('div')
		counter.className = 'mvp-char-counter'
		counter.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 24px;
            font-size: 11px;
            color: hsl(217.9 10.6% 50%);
            pointer-events: none;
            z-index: ${Z_INDEXES.CHAR_COUNTER};
            font-family: system-ui, -apple-system, sans-serif;
        `

		/**
		 * Internal helper that calculates and updates the character count label.
		 */
		const updateCounter = () => {
			const len = ta.value.length
			if (len === 0) {
				counter.textContent = ''
			} else if (len === 1) {
				counter.textContent = '1 carácter'
			} else {
				counter.textContent = `${len.toLocaleString()} caracteres`
			}
		}

		const parent = ta.parentElement
		if (parent) {
			const style = window.getComputedStyle(parent)
			if (style.position === 'static') {
				parent.style.position = 'relative'
			}
			parent.appendChild(counter)
		}

		ta.addEventListener('input', updateCounter)
		updateCounter()
	})
}

/**
 * Helper to insert wrapped content at cursor position
 */
function insertTagAtCursor(textarea: HTMLTextAreaElement, tag: string, content: string): void {
	const start = textarea.selectionStart
	const end = textarea.selectionEnd
	const text = textarea.value

	const wrapped = `[${tag}]${content}[/${tag}]`
	textarea.value = text.substring(0, start) + wrapped + text.substring(end)

	// Set cursor position after the inserted tag
	const newCursorPos = start + wrapped.length
	textarea.selectionStart = newCursorPos
	textarea.selectionEnd = newCursorPos

	// Dispatch events to notify any listeners
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
	textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Automatically wraps pasted URLs with appropriate BBCode tags:
 * - Images (.jpg, .jpeg, .png, .gif) → [img][/img]
 * - Media (YouTube, Instagram, Twitter, Amazon, Steam, etc.) → [media][/media]
 */
export function injectPasteHandler(): void {
	const textareas = document.querySelectorAll<HTMLTextAreaElement>(
		`${MV_SELECTORS.EDITOR.TEXTAREA_ALL}, ${MV_SELECTORS.MESSAGES.TEXTAREA}`
	)

	textareas.forEach(textarea => {
		if (isAlreadyInjected(textarea, PASTE_MARKER)) return
		markAsInjected(textarea, PASTE_MARKER)

		textarea.addEventListener('paste', (e: ClipboardEvent) => {
			const pastedText = e.clipboardData?.getData('text/plain')?.trim()

			// Only process if it looks like a single URL (no spaces, no newlines)
			if (!pastedText || pastedText.includes(' ') || pastedText.includes('\n')) {
				return // Let default paste happen
			}

			// Check if it's an image URL (jpg, jpeg, png, gif only)
			if (isImageUrl(pastedText)) {
				e.preventDefault()
				insertTagAtCursor(textarea, 'img', pastedText)
				return
			}

		// Check if it's a media URL (YouTube, Instagram, Twitter, Amazon, Steam, etc.)
			if (isMediaUrl(pastedText)) {
				e.preventDefault()
				// Normalize URLs (e.g., convert YouTube Shorts to standard format)
				const normalizedUrl = normalizeMediaUrl(pastedText)
				insertTagAtCursor(textarea, 'media', normalizedUrl)
				return
			}

			// If not recognized, let the default paste happen
		})
	})
}

/**
 * Mounts a DraftManager UI component to handle background autosaving for post content.
 */
export async function injectDraftAutosave(): Promise<void> {
	const textareas = document.querySelectorAll(MV_SELECTORS.EDITOR.TEXTAREA_ALL)

	textareas.forEach(textarea => {
		// Strict check: Ensure we only attach to actual textareas
		if (textarea.tagName !== 'TEXTAREA') return
		
		if (isAlreadyInjected(textarea, DRAFT_MARKER)) return

		markAsInjected(textarea, DRAFT_MARKER)

		const parent = textarea.parentElement as HTMLElement
		if (parent) {
			const computedStyle = window.getComputedStyle(parent)
			if (computedStyle.position === 'static') {
				parent.style.position = 'relative'
			}

			const host = document.createElement('div')
			host.className = 'mvp-draft-host'
			host.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: ${Z_INDEXES.DRAFT_HOST};
                pointer-events: none;
            `

			parent.appendChild(host)

			const featureId = `${FEATURE_IDS.DRAFT_MANAGER_PREFIX}${++draftCounter}`
			mountFeature(featureId, host, createElement(DraftManager, { textarea: textarea as HTMLTextAreaElement }))
		}
	})
}

/**
 * Locates a native toolbar button by its numeric BBCode style index or title.
 * @param container - The toolbar container element
 * @param bbstyleNum - Native Mediavida style index
 * @param fallbackTitle - Optional title used for lookup
 * @returns The button element or null
 */
function findNativeButton(container: Element, bbstyleNum: number, fallbackTitle?: string): HTMLElement | null {
	let btn = container.querySelector(`button[onclick*="bbstyle(${bbstyleNum})"]`) as HTMLElement
	if (btn) return btn

	if (fallbackTitle) {
		btn = container.querySelector(`button[title="${fallbackTitle}"]`) as HTMLElement
	}
	return btn
}

/**
 * Main injection entry point for the Premium Editor Toolbar.
 * Applies a distributed injection strategy, placing buttons into the native toolbar via React Portals.
 */
export function injectEditorToolbar(): void {
	const controlContainers = document.querySelectorAll(
		`${MV_SELECTORS.EDITOR.EDITOR_CONTROLS}, ${MV_SELECTORS.EDITOR.EDITOR_TOOLBAR}, ${MV_SELECTORS.EDITOR.TOOLBAR}`
	)

	controlContainers.forEach(container => {
		if (isAlreadyInjected(container, INJECTED_MARKER)) return

		// Find associated textarea
		let textarea: HTMLTextAreaElement | null = null
		const editorBody = container.closest('.editor-body')
		if (editorBody) {
			textarea = editorBody.querySelector('textarea')
		}
		if (!textarea) {
			const form = container.closest('form')
			if (form) {
				textarea = form.querySelector('textarea')
			}
		}

		if (!textarea) return

		markAsInjected(container, INJECTED_MARKER)
		markAsInjected(textarea, TOOLBAR_MARKER)

		// Hide native Code button
		const nativeCodeBtn = findNativeButton(container, 20, 'Code')
		if (nativeCodeBtn) {
			nativeCodeBtn.style.display = 'none'
			nativeCodeBtn.setAttribute(DOM_MARKERS.DATA_ATTRS.HIDDEN, 'true')
		}

		// Create container for the main toolbar component (handles state + dialogs)
		// This will be invisible but manages all the React state
		const stateHost = document.createElement('div')
		stateHost.id = `${FEATURE_IDS.TOOLBAR_STATE_PREFIX}${++toolbarCounter}`
		stateHost.style.display = 'contents' // Invisible container
		container.appendChild(stateHost)

		const featureId = `${FEATURE_IDS.TOOLBAR_PREFIX}${toolbarCounter}`
		if (!isFeatureMounted(featureId)) {
			mountFeature(
				featureId,
				stateHost,
				createElement(DistributedEditorToolbar, {
					textarea,
					toolbarContainer: container as HTMLElement,
				})
			)
		}
	})

	// Fallback for standalone textareas (PMs, inline-edit quick edit)
	const textareas = document.querySelectorAll(
		`${MV_SELECTORS.EDITOR.TEXTAREA}, ${MV_SELECTORS.EDITOR.TEXTAREA_NAME}, ${MV_SELECTORS.MESSAGES.TEXTAREA}, ${MV_SELECTORS.EDITOR.INLINE_EDIT}`
	)
	textareas.forEach(textarea => {
		if (isAlreadyInjected(textarea, TOOLBAR_MARKER)) return
		markAsInjected(textarea, TOOLBAR_MARKER)

		// Inject styles
		const styleId = 'mvp-pm-toolbar-styles'

		let style = document.getElementById(styleId)
		if (!style) {
			style = document.createElement('style')
			style.id = styleId
			document.head.appendChild(style)
		}
		style.textContent = `
				/* PM Editor Toolbar Styles */
				.mvp-pm-toolbar {
					display: flex !important;
					flex-wrap: nowrap !important;
					align-items: center !important;
					gap: 0 !important;
					background: var(--card, var(--bg-color-2, #292d36)) !important;
					border: 1px solid var(--border, var(--border-color, #3a3f4b)) !important;
					border-bottom: none !important;
					border-radius: 4px 4px 0 0;
					padding-top: 4px !important;
					padding-bottom: 0px !important;
					padding-left: 2px !important;
					padding-right: 4px !important;
					overflow: hidden;
					margin: 0;
					margin-bottom: 0 !important;
					box-sizing: border-box;
					width: 100%;
					animation: mvp-toolbar-appear 0.5s ease-out;
				}

				@keyframes mvp-toolbar-appear {
					from { opacity: 0; transform: translateY(-5px); }
					to { opacity: 1; transform: translateY(0); }
				}

				/* Groups */
				.mvp-pm-toolbar .mvp-toolbar-group {
					display: inline-flex !important;
					align-items: center !important;
					gap: 1px !important;
					margin: 0 !important;
					padding: 0 4px !important;
					height: 28px;
					position: relative;
				}
				
				.mvp-pm-toolbar .mvp-toolbar-group:not(:last-child)::after {
					content: "" !important;
					display: block !important;
					width: 1px !important;
					height: 14px !important;
					background-color: var(--border, #71717a) !important;
					margin-left: 4px !important;
					opacity: 0.6;
				}

				/* Specific Group adjustments */
				.mvp-pm-toolbar #mvp-group-tools {
					margin-right: 12px !important;
				}

				/* Hide history group and trailing tools separator */
				.mvp-pm-toolbar #mvp-group-history,
				.mvp-pm-toolbar #mvp-group-tools::after {
					display: none !important;
				}

				/* Buttons */
				.mvp-pm-toolbar .mvp-toolbar-btn {
					display: inline-flex !important;
					align-items: center !important;
					justify-content: center !important;
					width: 28px !important;
					height: 28px !important;
					padding: 0 !important;
					margin: 0 !important;
					background: transparent !important;
					border: 1px solid transparent !important;
					border-radius: 3px !important;
					color: var(--foreground, var(--text-color, #a8adb5)) !important;
					cursor: pointer !important;
					font-size: 13px !important;
					transition: all 0.1s ease;
					float: none !important;
					box-shadow: none !important;
				}

				.mvp-pm-toolbar .mvp-toolbar-btn:hover,
				.mvp-pm-toolbar .mvp-toolbar-btn.active {
					background-color: var(--accent, var(--bg-highlight, #373d49)) !important;
					border-color: var(--primary, var(--border-color-highlight, #4a5160)) !important;
					color: var(--accent-foreground, var(--text-highlight, #fff)) !important;
				}

				.mvp-pm-toolbar .mvp-toolbar-btn i,
				.mvp-pm-toolbar .mvp-toolbar-btn svg {
					font-size: 14px !important;
					width: 14px !important;
					height: 14px !important;
					line-height: 1 !important;
					color: inherit !important;
				}

				/* Hide history group (undo-redo) and trailing separator in PM editor */
				.mvp-pm-toolbar #mvp-group-history,
				.mvp-pm-toolbar #mvp-group-tools::after {
					display: none !important;
				}

				/* Hide spacers */
				.mvp-pm-toolbar .spacer {
					display: none !important;
				}

				/* Adjust textarea attachment */
				.mvp-pm-toolbar + textarea {
					border-top-left-radius: 0 !important;
					border-top-right-radius: 0 !important;
					margin-top: 0 !important;
					border-color: var(--border-color, #3a3f4b) !important;
					resize: vertical !important;
				}


			`

		const container = document.createElement('div')
		container.className = 'mvp-toolbar-container mvp-pm-toolbar'
		textarea.parentNode?.insertBefore(container, textarea)

		// Match the toolbar width/position to the textarea exactly
		const ta = textarea as HTMLElement
		const computed = window.getComputedStyle(ta)
		container.style.marginLeft = computed.marginLeft
		container.style.marginRight = computed.marginRight
		container.style.width = `${ta.offsetWidth}px`
		container.style.boxSizing = 'border-box'

		const host = document.createElement('div')
		host.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none;'
		container.appendChild(host)

		const featureId = `${FEATURE_IDS.TOOLBAR_FALLBACK_PREFIX}${++toolbarCounter}`
		if (!isFeatureMounted(featureId)) {
			mountFeature(
				featureId,
				host,
				createElement(DistributedEditorToolbar, {
					textarea: textarea as HTMLTextAreaElement,
					toolbarContainer: container,
				})
			)
		}
	})
}
