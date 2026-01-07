/**
 * Live Thread DOM Manipulation
 *
 * Handles DOM operations: hiding native elements, moving form, etc.
 */
import { MV_SELECTORS, Z_INDEXES } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import {
	injectEditorToolbar,
	injectCharacterCounter,
	injectDraftAutosave,
	injectPasteHandler,
} from '@/features/editor/logic/editor-toolbar'

// =============================================================================
// STATE
// =============================================================================

let originalFormParent: HTMLElement | null = null
let originalFormNextSibling: Node | null = null
let replyStateCallback: ((isOpen: boolean) => void) | null = null

export function setReplyStateCallback(cb: ((isOpen: boolean) => void) | null): void {
	replyStateCallback = cb
}

// =============================================================================
// NATIVE ELEMENTS VISIBILITY
// =============================================================================

export function hideNativeElements(): void {
	// Hide pagination
	document.querySelectorAll(MV_SELECTORS.THREAD.PAGINATION_ALL).forEach(el => {
		;(el as HTMLElement).style.display = 'none'
	})

	// Hide native Responder buttons
	document.querySelectorAll(MV_SELECTORS.THREAD.QUICK_REPLY_ALL).forEach(el => {
		;(el as HTMLElement).style.display = 'none'
	})

	// Hide news hero section (for "noticia" threads)
	const newsHero = document.getElementById('news-hero')
	if (newsHero) {
		newsHero.style.display = 'none'
	}
}

export function showNativeElements(): void {
	document.querySelectorAll(MV_SELECTORS.THREAD.PAGINATION_ALL).forEach(el => {
		;(el as HTMLElement).style.display = ''
	})
	document.querySelectorAll(MV_SELECTORS.THREAD.QUICK_REPLY_ALL).forEach(el => {
		;(el as HTMLElement).style.display = ''
	})

	// Restore news hero section
	const newsHero = document.getElementById('news-hero')
	if (newsHero) {
		newsHero.style.display = ''
	}
}

// =============================================================================
// FORM POSITIONING
// =============================================================================

export function moveFormToTop(): void {
	const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)
	// Note: LIVE_EDITOR_WRAPPER is a selector with #, need to strip it or use querySelector
	// But it's easier to just use querySelector for consistency if it has ID
	const editorWrapper = document.querySelector(MV_SELECTORS.EXTENSION.LIVE_EDITOR_WRAPPER)

	if (!postEditor || !editorWrapper) {
		return
	}

	// Save original position if not already saved
	if (!originalFormParent) {
		originalFormParent = postEditor.parentElement
		originalFormNextSibling = postEditor.nextSibling
	}

	// Move to inner wrapper for smooth grid transition
	const innerWrapper = editorWrapper.querySelector('div') || editorWrapper
	innerWrapper.appendChild(postEditor)

	// Reset styles to flow naturally within wrapper
	postEditor.style.position = 'static'
	postEditor.style.display = 'none' // Controlled by toggle
	postEditor.style.width = '100%'
	postEditor.style.margin = '0'
	postEditor.style.background = 'var(--bg-color, #1a1a1a)'
	postEditor.style.borderRadius = '8px'
	postEditor.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)'

	postEditor.classList.add('live')

	// Inject Custom Footer logic
	injectCustomFooter(postEditor)
}

export function restoreForm(): void {
	const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)

	if (postEditor && originalFormParent) {
		// Move back to original position
		if (originalFormNextSibling) {
			originalFormParent.insertBefore(postEditor, originalFormNextSibling)
		} else {
			originalFormParent.appendChild(postEditor)
		}

		// Reset styles
		postEditor.style.cssText = ''
		postEditor.classList.remove('live')

		originalFormParent = null
		originalFormNextSibling = null
	}
}

// =============================================================================
// CUSTOM FOOTER
// =============================================================================

export function injectCustomFooter(postEditor: HTMLElement): void {
	// 1. Create container if needed
	let customFooter = postEditor.querySelector(`.${DOM_MARKERS.LIVE_THREAD.FOOTER}`) as HTMLElement
	if (!customFooter) {
		customFooter = document.createElement('div')
		customFooter.className = DOM_MARKERS.LIVE_THREAD.FOOTER

		// If native footer exists, insert ours after form but before closing
		const form = postEditor.querySelector('form')
		if (form) form.appendChild(customFooter)
		else postEditor.appendChild(customFooter)
	}

	// 2. Move NATIVE elements (Checkboxes, Drafts, etc.)
	const nativeFooter = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_META) as HTMLElement
	if (nativeFooter) {
		while (nativeFooter.firstChild) {
			customFooter.appendChild(nativeFooter.firstChild)
		}
	}

	// 3. Hunt for stray natives (Submit, Preview)
	const straySubmit = postEditor.querySelector(MV_SELECTORS.GLOBAL.SUBMIT_BUTTON)
	if (straySubmit && !customFooter.contains(straySubmit)) customFooter.appendChild(straySubmit)

	const strayPreview = postEditor.querySelector(MV_SELECTORS.GLOBAL.PREVIEW_BUTTON)
	if (strayPreview && !customFooter.contains(strayPreview)) customFooter.appendChild(strayPreview)

	postEditor.querySelectorAll('label').forEach(label => {
		if (label.querySelector('input[type="checkbox"]') && !customFooter.contains(label)) {
			customFooter.appendChild(label)
		}
	})

	// 4. Process Footer Elements

	// A) Handle SUBMIT - hide native, add custom
	const nativeSubmit = customFooter.querySelector(
		`input[type="submit"][value="Enviar"], ${MV_SELECTORS.GLOBAL.SUBMIT_BUTTON}`
	) as HTMLElement
	if (nativeSubmit) {
		nativeSubmit.style.display = 'none'
	}

	// Inject Custom Submit
	if (!customFooter.querySelector(`.${DOM_MARKERS.LIVE_THREAD.BTN_SUBMIT}`)) {
		const submitBtn = document.createElement('button')
		submitBtn.className = DOM_MARKERS.LIVE_THREAD.BTN_SUBMIT
		submitBtn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Enviar'
		submitBtn.onclick = e => {
			e.preventDefault()
			e.stopPropagation()

			if (nativeSubmit) {
				nativeSubmit.click()
			} else {
				const form = postEditor.querySelector('form')
				if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
			}
		}
		customFooter.appendChild(submitBtn)
	}

	// B) Handle PREVIEW - hide it
	const nativePreview = customFooter.querySelector(
		`input[type="submit"][value="Vista previa"], ${MV_SELECTORS.GLOBAL.PREVIEW_BUTTON}`
	) as HTMLElement
	if (nativePreview) {
		nativePreview.style.display = 'none'
	}

	// C) Handle EXTENDED EDITOR
	customFooter.querySelectorAll('a').forEach(el => {
		if (!el.classList.contains(DOM_MARKERS.LIVE_THREAD.LINK_EXTENDED)) {
			el.remove()
		}
	})

	if (!customFooter.querySelector(`.${DOM_MARKERS.LIVE_THREAD.LINK_EXTENDED}`)) {
		const extendedLink = document.createElement('a')
		extendedLink.className = DOM_MARKERS.LIVE_THREAD.LINK_EXTENDED
		extendedLink.href = '#'
		extendedLink.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Editor extendido'
		extendedLink.onclick = e => {
			e.preventDefault()
			const baseUrl = window.location.href.split('#')[0].split('?')[0].replace(/\/+$/, '')
			window.location.href = `${baseUrl}/responder`
		}
		customFooter.appendChild(extendedLink)
	}
}

// =============================================================================
// EDITOR STYLES
// =============================================================================

export function forceEditorStyles(postEditor: HTMLElement): void {
	// Remove hidden classes that MV might add
	postEditor.classList.remove('hidden')

	// Force the editor to be visible with inline styles
	postEditor.style.setProperty('display', 'block', 'important')
	postEditor.style.setProperty('visibility', 'visible', 'important')
	postEditor.style.setProperty('opacity', '1', 'important')
	postEditor.style.setProperty('position', 'relative', 'important')
	postEditor.style.setProperty('float', 'none', 'important')
	postEditor.style.setProperty('clear', 'both', 'important')
	postEditor.style.setProperty('width', '100%', 'important')
	postEditor.style.setProperty('height', 'auto', 'important')
	postEditor.style.setProperty('background', '#242526', 'important')

	// Hide ALL placeholder overlay elements
	postEditor
		.querySelectorAll(`${MV_SELECTORS.EDITOR.EDITOR_PLACEHOLDER}, ${MV_SELECTORS.EDITOR.EDITOR_PLACEHOLDER_ALT}`)
		.forEach(el => {
			;(el as HTMLElement).style.setProperty('display', 'none', 'important')
		})

	const editorBody = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_BODY) as HTMLElement
	if (editorBody) {
		editorBody.classList.remove('hidden')
		editorBody.style.setProperty('display', 'block', 'important')
		editorBody.style.setProperty('height', 'auto', 'important')
		editorBody.style.setProperty('visibility', 'visible', 'important')
		editorBody.style.setProperty('background', '#242526', 'important')
		editorBody.style.setProperty('overflow', 'visible', 'important')
	}

	const textWrap = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXT_WRAP) as HTMLElement
	if (textWrap) {
		textWrap.classList.remove('hidden')
		textWrap.style.setProperty('display', 'block', 'important')
		textWrap.style.setProperty('height', 'auto', 'important')
		textWrap.style.setProperty('position', 'static', 'important')
		textWrap.style.setProperty('background', '#1a1a1b', 'important')

		textWrap.querySelectorAll('span').forEach(span => {
			if (span.textContent?.includes('Escribe')) {
				span.style.setProperty('display', 'none', 'important')
			}
		})
	}

	// Force textarea to be visible
	const textarea = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXTAREA) as HTMLTextAreaElement
	if (textarea) {
		textarea.style.setProperty('display', 'block', 'important')
		textarea.style.setProperty('height', '150px', 'important')
		textarea.style.setProperty('min-height', '120px', 'important')
		textarea.style.setProperty('width', '100%', 'important')
		textarea.style.setProperty('visibility', 'visible', 'important')
		textarea.style.setProperty('opacity', '1', 'important')
		textarea.style.setProperty('position', 'relative', 'important')
		textarea.style.setProperty('z-index', String(Z_INDEXES.LIVE_EDITOR), 'important')
	}

	// Force editor controls (toolbar)
	const editorControls = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_CONTROLS) as HTMLElement
	if (editorControls) {
		editorControls.style.setProperty('display', 'flex', 'important')
		editorControls.style.setProperty('flex-wrap', 'wrap', 'important')
		editorControls.style.setProperty('visibility', 'visible', 'important')
		editorControls.style.setProperty('opacity', '1', 'important')
		editorControls.style.setProperty('height', 'auto', 'important')
		editorControls.style.setProperty('min-height', '38px', 'important')
	}

	// Force editor meta (hide native, inject custom)
	const editorMeta = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_META) as HTMLElement
	if (editorMeta) {
		editorMeta.style.setProperty('display', 'none', 'important')
	}

	injectCustomFooter(postEditor)

	// Re-inject extension buttons
	const controls = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_CONTROLS)
	if (controls) {
		controls.removeAttribute(DOM_MARKERS.DATA_ATTRS.INJECTED)
		controls.querySelectorAll('[id^="mvp-toolbar-state-"]').forEach(el => el.remove())
	}
	const ta = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXTAREA)
	if (ta) {
		ta.removeAttribute(DOM_MARKERS.DATA_ATTRS.TOOLBAR)
		ta.removeAttribute(DOM_MARKERS.DATA_ATTRS.DRAFT)
		ta.removeAttribute(DOM_MARKERS.DATA_ATTRS.COUNTER)
		ta.removeAttribute(DOM_MARKERS.DATA_ATTRS.PASTE)
		// Cleanup extension-injected elements before re-injecting
		ta.parentElement
			?.querySelectorAll(`.${DOM_MARKERS.CLASSES.CHAR_COUNTER}, .${DOM_MARKERS.CLASSES.DRAFT_HOST}`)
			.forEach(el => el.remove())
	}

	try {
		injectEditorToolbar()
		injectCharacterCounter()
		void injectDraftAutosave()
		injectPasteHandler()
	} catch {
		// Silent fail
	}

	// Force control section
	const control = postEditor.querySelector(MV_SELECTORS.EDITOR.CONTROL) as HTMLElement
	if (control) {
		control.style.setProperty('display', 'block', 'important')
		control.style.setProperty('padding', '0', 'important')
		control.style.setProperty('margin', '0', 'important')
		control.style.setProperty('height', 'auto', 'important')

		control.childNodes.forEach(node => {
			if (node instanceof HTMLElement) {
				if (!node.classList.contains('editor-body')) {
					if (node.tagName === 'H2' || node.tagName === 'H1' || node.classList.contains('minimize')) {
						node.style.setProperty('display', 'none', 'important')
					}
				}
			}
		})
	}

	// Force postform
	const postform = postEditor.querySelector(MV_SELECTORS.EDITOR.POSTFORM) as HTMLElement
	if (postform) {
		postform.style.setProperty('display', 'block', 'important')
		postform.style.setProperty('visibility', 'visible', 'important')
		postform.style.setProperty('overflow', 'visible', 'important')
		postform.style.setProperty('height', 'auto', 'important')
	}
}

// =============================================================================
// FORM VISIBILITY TOGGLE
// =============================================================================

export function toggleFormVisibility(show: boolean): void {
	const wrapper = document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)
	if (!wrapper) return

	if (show) {
		wrapper.classList.add('visible')
		const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)
		if (postEditor) {
			postEditor.style.display = 'block'
			forceEditorStyles(postEditor)
			const textarea = postEditor.querySelector(`#${MV_SELECTORS.EDITOR.TEXTAREA_ID}`) as HTMLTextAreaElement
			if (textarea) setTimeout(() => textarea.focus(), 150)
		}
	} else {
		wrapper.classList.remove('visible')
		setTimeout(() => {
			if (!wrapper.classList.contains('visible')) {
				const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)
				if (postEditor) postEditor.style.display = 'none'
			}
		}, 300)
	}

	replyStateCallback?.(show)
}
