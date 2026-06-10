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

// Decoupled signal (no direct polling import → keeps this module test-loadable):
// live-thread-polling listens and pauses/resumes while the user is composing.
const LIVE_COMPOSE_EVENT = 'mvp:live-compose'

function setLiveComposing(composing: boolean): void {
	window.dispatchEvent(new CustomEvent(LIVE_COMPOSE_EVENT, { detail: { composing } }))
}

// =============================================================================
// STATE
// =============================================================================

let originalFormParent: HTMLElement | null = null
let originalFormNextSibling: Node | null = null
let replyStateCallback: ((isOpen: boolean) => void) | null = null
let postReplyClickHandler: ((event: Event) => void) | null = null
let mobileLiteEditorReadyPromise: Promise<void> | null = null
const LIVE_EDITOR_PREPARED_ATTR = `data-${DOM_MARKERS.DATA_ATTRS.LIVE_EDITOR_PREPARED}`
const MOBILE_LITE_EDITOR_WAIT_MS = 900

export type LiveThreadVariant = 'desktop' | 'mobile-lite'

interface LiveThreadDomOptions {
	variant?: LiveThreadVariant
}

function getVariant(options?: LiveThreadDomOptions): LiveThreadVariant {
	return options?.variant ?? 'desktop'
}

function getPostEditor(): HTMLElement | null {
	return document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)
}

function getPostEditorTextarea(): HTMLTextAreaElement | null {
	// On mobile the live input is OUR textarea placed OUTSIDE #post-editor (so the
	// Android keyboard works), so check for it first. Otherwise the "is there an
	// editor?" checks fail and fall back to Mediavida's native reply / extended editor.
	const own = document.querySelector('.mvp-live-own-textarea') as HTMLTextAreaElement | null
	if (own) return own
	return getPostEditor()?.querySelector(MV_SELECTORS.EDITOR.TEXTAREA_ALL) as HTMLTextAreaElement | null
}

// Mediavida's bbstyle(n) numbers → BBCode tags, so we can drive the toolbar
// ourselves on our own textarea (MV's bbstyle can't find it outside the form).
const MOBILE_LITE_BBCODE_TAGS: Record<string, [string, string]> = {
	'0': ['[b]', '[/b]'],
	'2': ['[i]', '[/i]'],
	'8': ['[url]', '[/url]'],
	'10': ['[img]', '[/img]'],
	'12': ['[media]', '[/media]'],
	'26': ['[twitter]', '[/twitter]'],
	'24': ['[quote]', '[/quote]'],
	'14': ['[spoiler]', '[/spoiler]'],
	'18': ['[nsfw]', '[/nsfw]'],
	'20': ['[code]', '[/code]'],
}

function wrapMobileLiteSelection(textarea: HTMLTextAreaElement, before: string, after: string): void {
	const start = textarea.selectionStart ?? textarea.value.length
	const end = textarea.selectionEnd ?? textarea.value.length
	const selected = textarea.value.slice(start, end)
	textarea.value = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)
	const cursor = start + before.length + selected.length
	textarea.focus()
	textarea.setSelectionRange(cursor, cursor)
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function wireMobileLiteToolbar(toolbar: HTMLElement, textarea: HTMLTextAreaElement): void {
	toolbar.querySelectorAll<HTMLElement>('button[onclick]').forEach(button => {
		const match = (button.getAttribute('onclick') || '').match(/bbstyle\((\d+)\)/)
		const tags = match ? MOBILE_LITE_BBCODE_TAGS[match[1]] : undefined
		if (!tags) return
		button.removeAttribute('onclick')
		// Keep the field focused when tapping a toolbar button (don't blur on mobile).
		button.addEventListener('pointerdown', event => event.preventDefault())
		button.addEventListener('click', event => {
			event.preventDefault()
			wrapMobileLiteSelection(textarea, tags[0], tags[1])
		})
	})
}

export function setReplyStateCallback(cb: ((isOpen: boolean) => void) | null): void {
	replyStateCallback = cb
}

function appendReplyReferenceToEditor(postNum: string): void {
	const textarea = document.querySelector(MV_SELECTORS.EDITOR.TEXTAREA_ALL) as HTMLTextAreaElement | null
	if (!textarea) return

	const currentValue = textarea.value
	const hasExistingText = currentValue.trim().length > 0
	const separator = hasExistingText && !currentValue.endsWith('\n') ? '\n' : ''
	textarea.value = `${currentValue}${separator}#${postNum} `
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
	textarea.focus()
	const cursorPos = textarea.value.length
	textarea.setSelectionRange(cursorPos, cursorPos)
}

function getReplyPostNum(replyButton: Element): string | null {
	const dataNum = replyButton.getAttribute('data-num')?.trim()
	if (dataNum) return dataNum

	const postEl = replyButton.closest<HTMLElement>(MV_SELECTORS.THREAD.POST_ALL)
	return postEl?.getAttribute('data-num')?.trim() || null
}

export function setupPostReplyHandler(options: LiveThreadDomOptions = {}): void {
	cleanupPostReplyHandler()

	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap) return

	const variant = getVariant(options)
	postReplyClickHandler = (event: Event) => {
		const target = event.target
		if (!(target instanceof Element)) return

		const replyButton = target.closest('.btn-reply')
		if (!replyButton || !postsWrap.contains(replyButton)) return

		event.preventDefault()
		event.stopImmediatePropagation()
		event.stopPropagation()

		const postNum = getReplyPostNum(replyButton)
		if (!postNum) return

		if (variant === 'mobile-lite' && !getPostEditorTextarea()) {
			void ensureMobileLiteNativeEditorReady().then(() => {
				if (!getPostEditorTextarea()) return
				moveFormToTop({ variant })
				toggleFormVisibility(true, { variant })
				appendReplyReferenceToEditor(postNum)
			})
			return
		}

		toggleFormVisibility(true, { variant })
		appendReplyReferenceToEditor(postNum)
	}

	postsWrap.addEventListener('click', postReplyClickHandler, true)
}

export function cleanupPostReplyHandler(): void {
	const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID)
	if (!postsWrap || !postReplyClickHandler) {
		postReplyClickHandler = null
		return
	}

	postsWrap.removeEventListener('click', postReplyClickHandler, true)
	postReplyClickHandler = null
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

function waitForMobileLiteEditor(timeoutMs = MOBILE_LITE_EDITOR_WAIT_MS): Promise<HTMLTextAreaElement | null> {
	const existingTextarea = getPostEditorTextarea()
	if (existingTextarea) return Promise.resolve(existingTextarea)

	return new Promise(resolve => {
		let resolved = false
		let observer: MutationObserver
		let timeout: ReturnType<typeof setTimeout>
		const finish = (textarea: HTMLTextAreaElement | null) => {
			if (resolved) return
			resolved = true
			observer.disconnect()
			clearTimeout(timeout)
			resolve(textarea)
		}

		observer = new MutationObserver(() => {
			const textarea = getPostEditorTextarea()
			if (textarea) finish(textarea)
		})
		timeout = setTimeout(() => finish(getPostEditorTextarea()), timeoutMs)

		observer.observe(document.body, { childList: true, subtree: true })
	})
}

export async function ensureMobileLiteNativeEditorReady(): Promise<void> {
	if (getPostEditorTextarea()) return
	if (mobileLiteEditorReadyPromise) return mobileLiteEditorReadyPromise

	mobileLiteEditorReadyPromise = (async () => {
		const nativeReplyButton = document.querySelector<HTMLElement>(
			`${MV_SELECTORS.THREAD.QUICK_REPLY_ALL}, a[href$="/responder"], a[href*="/responder"]`
		)
		if (!nativeReplyButton) return

		nativeReplyButton.click()
		await waitForMobileLiteEditor()
	})().finally(() => {
		mobileLiteEditorReadyPromise = null
	})

	return mobileLiteEditorReadyPromise
}

function isLiveGeneratedFooterElement(node: ChildNode): boolean {
	return (
		node instanceof HTMLElement &&
		(node.classList.contains(DOM_MARKERS.LIVE_THREAD.BTN_SUBMIT) ||
			node.classList.contains(DOM_MARKERS.LIVE_THREAD.LINK_EXTENDED))
	)
}

function restoreNativeEditorMetaElement(element: HTMLElement): void {
	element.style.removeProperty('display')
	element.style.removeProperty('visibility')
	element.style.removeProperty('opacity')
	element.style.removeProperty('width')
	element.style.removeProperty('height')
	element.style.removeProperty('padding')
	element.style.removeProperty('margin')
	element.style.removeProperty('pointer-events')
}

function cleanupLiveEditorAdditions(postEditor: HTMLElement): void {
	const liveFooter = postEditor.querySelector(`.${DOM_MARKERS.LIVE_THREAD.FOOTER}`) as HTMLElement | null
	if (!liveFooter) return

	const nativeFooter = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_META) as HTMLElement | null
	if (nativeFooter) {
		Array.from(liveFooter.childNodes).forEach(node => {
			if (isLiveGeneratedFooterElement(node)) {
				node.remove()
				return
			}

			if (node instanceof HTMLElement) {
				restoreNativeEditorMetaElement(node)
			}
			nativeFooter.appendChild(node)
		})
	}

	liveFooter.remove()
}

function setMobileLiteEditorDisplay(postEditor: HTMLElement, display: 'block' | 'none'): void {
	postEditor.style.setProperty('display', display, 'important')
}

function prepareMobileLiteEditor(postEditor: HTMLElement): void {
	// Idempotency guard: if the editor is already prepared, do NOT re-apply the
	// full inline-style pass. Re-styling on every tap was blurring the textarea
	// (focus jumped to <body>), making it impossible to type. Just make sure it
	// stays visible and bail out.
	if (postEditor.getAttribute(LIVE_EDITOR_PREPARED_ATTR) === 'mobile-lite' && getPostEditorTextarea()) {
		setMobileLiteEditorDisplay(postEditor, 'block')
		return
	}

	cleanupLiveEditorAdditions(postEditor)
	postEditor.classList.add('mvp-live-mobile-editor')
	postEditor.classList.remove('live')
	postEditor.classList.remove('hidden')
	postEditor.removeAttribute(LIVE_EDITOR_PREPARED_ATTR)
	postEditor.style.removeProperty('background')
	postEditor.style.removeProperty('border-radius')
	postEditor.style.removeProperty('box-shadow')
	postEditor.style.setProperty('position', 'static', 'important')
	postEditor.style.setProperty('float', 'none', 'important')
	postEditor.style.setProperty('clear', 'both', 'important')
	postEditor.style.setProperty('width', '100%', 'important')
	postEditor.style.setProperty('height', 'auto', 'important')
	postEditor.style.setProperty('margin', '0', 'important')
	postEditor.style.setProperty('visibility', 'visible', 'important')
	postEditor.style.setProperty('opacity', '1', 'important')
	setMobileLiteEditorDisplay(postEditor, 'block')
	postEditor.setAttribute(LIVE_EDITOR_PREPARED_ATTR, 'mobile-lite')

	postEditor
		.querySelectorAll<HTMLElement>(
			[
				MV_SELECTORS.EDITOR.CONTROL,
				MV_SELECTORS.EDITOR.EDITOR_CONTROLS,
				MV_SELECTORS.EDITOR.EDITOR_META,
				MV_SELECTORS.EDITOR.TEXT_WRAP,
				MV_SELECTORS.EDITOR.EDITOR_BODY,
				MV_SELECTORS.EDITOR.POSTFORM,
			].join(', ')
		)
		.forEach(element => {
			element.classList.remove('hidden')
			element.style.removeProperty('display')
			element.style.removeProperty('background')
			element.style.removeProperty('color')
			element.style.removeProperty('height')
			element.style.removeProperty('max-height')
			element.style.removeProperty('min-height')
			element.style.removeProperty('overflow')
			element.style.removeProperty('position')
			element.style.removeProperty('top')
			element.style.removeProperty('z-index')
			element.style.setProperty('visibility', 'visible', 'important')
			element.style.setProperty('opacity', '1', 'important')
			element.style.setProperty('pointer-events', 'auto', 'important')
		})

	const mvTextarea = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXTAREA_ALL) as HTMLTextAreaElement | null
	const liveEditorHost = postEditor.parentElement
	if (mvTextarea && liveEditorHost && !liveEditorHost.querySelector('.mvp-live-own-textarea')) {
		// ROOT CAUSE FIX: anything INSIDE Mediavida's #post-editor (its `ios` class /
		// delegated handlers) refuses the Android soft keyboard once relocated — even a
		// brand-new textarea. A vanilla textarea placed OUTSIDE #post-editor works
		// perfectly (verified live). So we use OUR OWN textarea, placed just before the
		// editor block, as the real #cuerpo. The toolbar (bbstyle → #cuerpo) and the
		// submit (live-thread-editor copies #cuerpo into the POST body) operate on it.
		const own = document.createElement('textarea')
		own.placeholder = mvTextarea.getAttribute('placeholder') || 'Escribe aquí tu mensaje…'
		own.value = mvTextarea.value
		own.rows = 4
		own.className = 'mvp-live-own-textarea'
		own.id = 'cuerpo'
		own.name = 'cuerpo'

		// Hide MV's native text area (now empty) and drop its broken textarea.
		const textWrap = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXT_WRAP)
		if (textWrap instanceof HTMLElement) textWrap.style.setProperty('display', 'none', 'important')
		mvTextarea.remove()

		// Insert OUTSIDE #post-editor (inside the live editor wrapper).
		postEditor.insertAdjacentElement('beforebegin', own)

		// Layout: toolbar ABOVE the textarea (move it out of #post-editor too), then the
		// textarea, then the native footer (Enviar / Subir imagen) which stays inside
		// #post-editor so it keeps submitting the form.
		const toolbar = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_CONTROLS)
		if (toolbar instanceof HTMLElement) {
			own.insertAdjacentElement('beforebegin', toolbar)
			wireMobileLiteToolbar(toolbar, own)
		}

		// "Editor extendido": preserve what's typed so it's restored on /responder.
		const extendedLink = postEditor.querySelector('a#goext, a[href$="/responder"], a[href*="/responder"]')
		extendedLink?.addEventListener('click', () => {
			if (!own.value.trim()) return
			void import('@/features/editor/logic/editor-content-preserve')
				.then(({ saveEditorContent }) => saveEditorContent(own.value))
				.catch(() => undefined)
		})

		// Single, correctly-placed upload control inside the footer.
		liveEditorHost.querySelectorAll('[data-mvp-mobile-lite-upload-control="true"]').forEach(el => el.remove())
		void import('@/features/mobile-lite/logic/editor-lite')
			.then(({ injectMobileLiteUploadControl }) => {
				const control = injectMobileLiteUploadControl(own)
				const footer = postEditor.querySelector(MV_SELECTORS.EDITOR.EDITOR_META)
				if (control && footer instanceof HTMLElement && !footer.contains(control)) {
					footer.appendChild(control)
				}
			})
			.catch(() => undefined)
	}
}

export function moveFormToTop(options: LiveThreadDomOptions = {}): void {
	const postEditor = getPostEditor()
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

	const variant = getVariant(options)
	postEditor.classList.toggle('live', variant !== 'mobile-lite')
	postEditor.classList.toggle('mvp-live-mobile-editor', variant === 'mobile-lite')

	// Reset styles to flow naturally within wrapper.
	postEditor.style.position = 'static'
	postEditor.style.display = 'none' // Controlled by toggle
	postEditor.style.width = '100%'
	postEditor.style.margin = '0'

	if (variant === 'mobile-lite') {
		postEditor.style.removeProperty('background')
		postEditor.style.removeProperty('border-radius')
		postEditor.style.removeProperty('box-shadow')
		cleanupLiveEditorAdditions(postEditor)
	} else {
		postEditor.style.background = 'var(--bg-color, #1a1a1a)'
		postEditor.style.borderRadius = '8px'
		postEditor.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)'
		injectCustomFooter(postEditor)
	}
}

export function restoreForm(): void {
	const postEditor = getPostEditor()

	if (postEditor && originalFormParent) {
		// Move back to original position
		if (originalFormNextSibling) {
			originalFormParent.insertBefore(postEditor, originalFormNextSibling)
		} else {
			originalFormParent.appendChild(postEditor)
		}

		// Reset styles
		postEditor.style.cssText = ''
		postEditor.removeAttribute(LIVE_EDITOR_PREPARED_ATTR)
		postEditor.classList.remove('live')
		postEditor.classList.remove('mvp-live-mobile-editor')

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
		editorControls.style.setProperty('flex-wrap', 'nowrap', 'important')
		editorControls.style.setProperty('align-items', 'center', 'important')
		editorControls.style.setProperty('visibility', 'visible', 'important')
		editorControls.style.setProperty('opacity', '1', 'important')
		editorControls.style.setProperty('height', '30px', 'important')
		editorControls.style.setProperty('min-height', '30px', 'important')
		editorControls.style.setProperty('overflow-x', 'auto', 'important')
		editorControls.style.setProperty('overflow-y', 'hidden', 'important')
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

// Once the mobile editor finishes its slide-open animation we lift the grid
// clipping (overflow) so dropdowns (emoji, delay menu) and the Android keyboard
// interplay behave exactly like the pre-animation stable state.
const MOBILE_EDITOR_SETTLE_MS = 320
const MOBILE_EDITOR_SETTLED_CLASS = 'mvp-settled'

function scheduleMobileLiteEditorSettle(wrapper: HTMLElement): void {
	window.setTimeout(() => {
		if (wrapper.classList.contains('visible')) {
			wrapper.classList.add(MOBILE_EDITOR_SETTLED_CLASS)
		}
	}, MOBILE_EDITOR_SETTLE_MS)
}

export function toggleFormVisibility(show: boolean, options: LiveThreadDomOptions = {}): void {
	const wrapper = document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)
	if (!wrapper) return
	const variant = getVariant(options)
	// Treat the mobile editor as already open when it's prepared and displayed,
	// even if the wrapper's `visible` class got out of sync. Otherwise a stray
	// toggle(true) on every tap re-ran the full open flow (re-style + scroll),
	// stealing focus from the textarea.
	const postEditorForState = getPostEditor()
	const isMobileLiteOpen =
		variant === 'mobile-lite' &&
		postEditorForState?.getAttribute(LIVE_EDITOR_PREPARED_ATTR) === 'mobile-lite' &&
		postEditorForState.style.display !== 'none'
	const isVisible = wrapper.classList.contains('visible') || isMobileLiteOpen

	if (show) {
		// Stop posts streaming in under the editor while composing on mobile; the
		// layout churn was stealing focus from the textarea ("can't type" bug).
		if (variant === 'mobile-lite') setLiveComposing(true)

		// If already open, avoid forcing full style reapplication (prevents flicker in Firefox).
		if (isVisible) {
			// On mobile, NEVER focus programmatically: a focus() without a user gesture
			// does not open the Android soft keyboard, and worse, it leaves the field
			// "focused" so the user's own tap no longer reopens the keyboard. Let the
			// tap do the focusing.
			if (variant !== 'mobile-lite') {
				const postEditor = getPostEditor()
				const textarea = postEditor?.querySelector(MV_SELECTORS.EDITOR.TEXTAREA_ALL) as HTMLTextAreaElement | null
				if (textarea) {
					setTimeout(() => textarea.focus(), 0)
				}
			} else if (!wrapper.classList.contains('visible')) {
				// Re-sync after an interrupted close (editor still prepared but the
				// wrapper lost its class). No-op on normal taps to avoid layout churn.
				wrapper.classList.add('visible')
				scheduleMobileLiteEditorSettle(wrapper)
			}
			replyStateCallback?.(true)
			return
		}

		if (variant === 'mobile-lite' && !getPostEditorTextarea()) {
			void ensureMobileLiteNativeEditorReady().then(() => {
				if (!getPostEditorTextarea()) return
				moveFormToTop({ variant })
				toggleFormVisibility(true, { variant })
			})
			return
		}

		wrapper.classList.add('visible')
		if (variant === 'mobile-lite') {
			scheduleMobileLiteEditorSettle(wrapper)
		}
		const postEditor = getPostEditor()
		if (postEditor) {
			if (variant === 'mobile-lite') {
				prepareMobileLiteEditor(postEditor)
			} else if (!postEditor.hasAttribute(LIVE_EDITOR_PREPARED_ATTR)) {
				postEditor.style.display = 'block'
				forceEditorStyles(postEditor)
				postEditor.setAttribute(LIVE_EDITOR_PREPARED_ATTR, 'true')
			} else {
				postEditor.style.display = 'block'
			}
			// Desktop only: focus after opening. On mobile the user's tap focuses it
			// (a programmatic focus there blocks the soft keyboard — see above).
			if (variant !== 'mobile-lite') {
				const textarea = postEditor.querySelector(MV_SELECTORS.EDITOR.TEXTAREA_ALL) as HTMLTextAreaElement | null
				if (textarea) {
					setTimeout(() => textarea.focus(), 150)
				}
			}
		}
	} else {
		if (variant === 'mobile-lite') setLiveComposing(false)

		if (!isVisible) {
			replyStateCallback?.(false)
			return
		}

		// Restore clipping BEFORE collapsing so the slide-up animates cleanly.
		wrapper.classList.remove(MOBILE_EDITOR_SETTLED_CLASS)
		wrapper.classList.remove('visible')
		setTimeout(() => {
			if (!wrapper.classList.contains('visible')) {
				const postEditor = getPostEditor()
				if (postEditor) {
					if (variant === 'mobile-lite') {
						setMobileLiteEditorDisplay(postEditor, 'none')
					} else {
						postEditor.style.display = 'none'
					}
				}
			}
		}, 300)
	}

	replyStateCallback?.(show)
}
