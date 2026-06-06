import { MV_SELECTORS } from '@/constants'
import { isImageUrl } from '@/features/editor/logic/image-detector'
import { isMediaUrl, normalizeMediaUrl } from '@/features/editor/logic/media-detector'
import { restoreEditorContent, saveEditorContent } from '@/features/editor/logic/editor-content-preserve'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { uploadImage, validateImageFile } from '@/services/api/imgbb'

export type MobileLiteUploadResult =
	| { status: 'success'; url: string }
	| { status: 'error'; error: string }

const TEXTAREA_SELECTOR = MV_SELECTORS.EDITOR.TEXTAREA_ALL
const PASTE_MARKER = 'mvpMobileLitePaste'
const PRESERVE_TEXTAREA_MARKER = 'mvpMobileLitePreserve'
const PRESERVE_LINK_MARKER = 'mvpMobileLitePreserveLink'
const UPLOAD_CONTROL_MARKER = 'mvpMobileLiteUploadControlMounted'
const UPLOAD_CONTROL_SELECTOR = '[data-mvp-mobile-lite-upload-control="true"]'
const EXTENDED_EDITOR_LINK_SELECTOR = 'a#goext[href], a[href*="responder"]'
const PASTE_OBSERVER_DEBOUNCE_MS = 100
const FAVORITE_ROW_TEXT_PATTERN = /favorit/i
const NORMAL_EDITOR_FORM_ID = 'postform'
const EXTENDED_EDITOR_FORM_ID = 'postear'
const NORMAL_EDITOR_META_SELECTOR = '.editor-meta'
const EXTENDED_EDITOR_FAVORITES_SELECTOR = '#tofavstuff'
const UPLOAD_BUTTON_RESET_MS = 1000
const INVISIBLE_CLIPBOARD_CHARS_PATTERN = /[\u200B-\u200D\uFEFF]/g

let initialized = false
let textareaObserver: MutationObserver | null = null
let observerTimeout: ReturnType<typeof setTimeout> | null = null
let documentPasteListenerAttached = false
let documentEditorDiscoveryListenerAttached = false
let uploadControlsByTextarea = new WeakMap<HTMLTextAreaElement, HTMLElement>()

const uploadControlStyles = {
	wrapper: [
		'display: flex',
		'align-items: center',
		'flex-wrap: wrap',
		'gap: 8px',
		'clear: both',
		'position: relative',
		'z-index: 1',
		'margin: 0',
		'padding: 0',
		'font-size: 13px',
	].join(';'),
	button: ['white-space: nowrap', 'min-width: 126px'].join(';'),
	status: [
		'position: absolute',
		'width: 1px',
		'height: 1px',
		'padding: 0',
		'margin: -1px',
		'overflow: hidden',
		'clip: rect(0, 0, 0, 0)',
		'white-space: nowrap',
		'border: 0',
	].join(';'),
	error: [
		'position: absolute',
		'width: 1px',
		'height: 1px',
		'padding: 0',
		'margin: -1px',
		'overflow: hidden',
		'clip: rect(0, 0, 0, 0)',
		'white-space: nowrap',
		'border: 0',
	].join(';'),
}

function isMobileLiteEditorAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function dispatchTextInputEvents(textarea: HTMLTextAreaElement): void {
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
	textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

export function getMobileLiteEditorTextarea(root: ParentNode = document): HTMLTextAreaElement | null {
	const activeElement = document.activeElement
	if (activeElement instanceof HTMLTextAreaElement && activeElement.matches(TEXTAREA_SELECTOR)) {
		return activeElement
	}

	return root.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR)
}

export function insertMobileLiteTextAtCursor(textarea: HTMLTextAreaElement, content: string): void {
	const start = textarea.selectionStart
	const end = textarea.selectionEnd
	const currentText = textarea.value

	textarea.value = currentText.substring(0, start) + content + currentText.substring(end)

	const nextCursorPosition = start + content.length
	textarea.selectionStart = nextCursorPosition
	textarea.selectionEnd = nextCursorPosition

	dispatchTextInputEvents(textarea)
	textarea.focus()
}

export function insertMobileLiteImageTag(textarea: HTMLTextAreaElement, url: string): void {
	insertMobileLiteTextAtCursor(textarea, `[img]${url}[/img]\n`)
}

function normalizeMobileLiteInsertedText(text: string): string {
	return text.replace(INVISIBLE_CLIPBOARD_CHARS_PATTERN, '').trim()
}

export function getMobileLitePasteReplacement(pastedText: string): string | null {
	const trimmedText = normalizeMobileLiteInsertedText(pastedText)

	if (!trimmedText || trimmedText.includes(' ') || trimmedText.includes('\n')) {
		return null
	}

	if (isImageUrl(trimmedText)) {
		return `[img]${trimmedText}[/img]`
	}

	if (isMediaUrl(trimmedText)) {
		return `[media]${normalizeMediaUrl(trimmedText)}[/media]`
	}

	return null
}

export function handleMobileLiteTextareaPaste(textarea: HTMLTextAreaElement, event: ClipboardEvent): boolean {
	if (event.defaultPrevented) return false

	const pastedText = event.clipboardData?.getData('text/plain')
	if (!pastedText) return false

	const replacement = getMobileLitePasteReplacement(pastedText)
	if (!replacement) return false

	event.preventDefault()
	insertMobileLiteTextAtCursor(textarea, replacement)
	return true
}

function getTextFromBeforeInputEvent(event: InputEvent): string | null {
	const dataTransferText = event.dataTransfer?.getData('text/plain')
	if (dataTransferText) return dataTransferText

	return event.data || null
}

export function handleMobileLiteTextareaBeforeInput(textarea: HTMLTextAreaElement, event: InputEvent): boolean {
	if (event.defaultPrevented) return false
	if (!event.inputType.startsWith('insert')) return false

	const insertedText = getTextFromBeforeInputEvent(event)
	if (!insertedText) return false

	const replacement = getMobileLitePasteReplacement(insertedText)
	if (!replacement) return false

	event.preventDefault()
	insertMobileLiteTextAtCursor(textarea, replacement)
	return true
}

function getTextareaFromPasteEvent(event: ClipboardEvent): HTMLTextAreaElement | null {
	const target = event.target
	return target instanceof HTMLTextAreaElement && target.matches(TEXTAREA_SELECTOR) ? target : null
}

function getTextareaFromInputEvent(event: InputEvent): HTMLTextAreaElement | null {
	const target = event.target
	return target instanceof HTMLTextAreaElement && target.matches(TEXTAREA_SELECTOR) ? target : null
}

function handleDocumentPaste(event: ClipboardEvent): void {
	if (!isMobileLiteEditorAllowed()) return

	const textarea = getTextareaFromPasteEvent(event)
	if (!textarea) return

	injectMobileLiteUploadControl(textarea)
	handleMobileLiteTextareaPaste(textarea, event)
}

function handleDocumentBeforeInput(event: InputEvent): void {
	if (!isMobileLiteEditorAllowed()) return

	const textarea = getTextareaFromInputEvent(event)
	if (!textarea) return

	injectMobileLiteUploadControl(textarea)
	handleMobileLiteTextareaBeforeInput(textarea, event)
}

function handleDocumentEditorDiscovery(event: Event): void {
	if (!isMobileLiteEditorAllowed()) return

	const target = event.target
	if (!(target instanceof HTMLTextAreaElement) || !target.matches(TEXTAREA_SELECTOR)) {
		if (event.type === 'click') schedulePasteHandlerScan()
		return
	}

	attachPasteHandler(target)
	injectMobileLiteUploadControl(target)
}

function attachPasteHandler(textarea: HTMLTextAreaElement): void {
	if (textarea.dataset[PASTE_MARKER] === 'true') return
	textarea.dataset[PASTE_MARKER] = 'true'

	textarea.addEventListener('paste', event => {
		if (!isMobileLiteEditorAllowed()) return
		handleMobileLiteTextareaPaste(textarea, event)
	})

	textarea.addEventListener('beforeinput', event => {
		if (!isMobileLiteEditorAllowed()) return
		handleMobileLiteTextareaBeforeInput(textarea, event)
	})
}

function getEditorPreserveRoot(textarea: HTMLTextAreaElement): ParentNode {
	return (
		textarea.closest<HTMLElement>(
			`${MV_SELECTORS.EDITOR.POSTFORM}, ${MV_SELECTORS.EDITOR.FORMBOX}, .control, form`
		) ?? document
	)
}

function attachEditorContentPreserveHandler(textarea: HTMLTextAreaElement): void {
	if (textarea.dataset[PRESERVE_TEXTAREA_MARKER] !== 'true') {
		textarea.dataset[PRESERVE_TEXTAREA_MARKER] = 'true'
		void restoreEditorContent(textarea)
	}

	const root = getEditorPreserveRoot(textarea)
	root.querySelectorAll<HTMLAnchorElement>(EXTENDED_EDITOR_LINK_SELECTOR).forEach(link => {
		if (link.dataset[PRESERVE_LINK_MARKER] === 'true') return
		link.dataset[PRESERVE_LINK_MARKER] = 'true'

		link.addEventListener('click', () => {
			if (!isMobileLiteEditorAllowed()) return
			if (!textarea.isConnected || !textarea.value.trim()) return

			void saveEditorContent(textarea.value)
		})
	})
}

function attachDocumentPasteHandler(): void {
	if (documentPasteListenerAttached) return

	document.addEventListener('paste', handleDocumentPaste, true)
	document.addEventListener('beforeinput', handleDocumentBeforeInput, true)
	documentPasteListenerAttached = true
}

function attachDocumentEditorDiscoveryHandler(): void {
	if (documentEditorDiscoveryListenerAttached) return

	document.addEventListener('focusin', handleDocumentEditorDiscovery, true)
	document.addEventListener('click', handleDocumentEditorDiscovery, true)
	documentEditorDiscoveryListenerAttached = true
}

export function attachMobileLitePasteHandlers(root: ParentNode = document): void {
	if (!isMobileLiteEditorAllowed()) return

	root.querySelectorAll<HTMLTextAreaElement>(TEXTAREA_SELECTOR).forEach(textarea => {
		attachPasteHandler(textarea)
		attachEditorContentPreserveHandler(textarea)
	})
}

function setUploadControlStatus(status: HTMLElement, message: string, state: 'idle' | 'error' = 'idle'): void {
	status.textContent = message
	status.style.cssText = state === 'error' ? uploadControlStyles.error : uploadControlStyles.status
}

function setUploadButtonContent(button: HTMLButtonElement, label: string, iconClass: string): void {
	const icon = document.createElement('i')
	icon.className = iconClass
	icon.setAttribute('aria-hidden', 'true')
	icon.style.marginRight = '5px'

	const text = document.createElement('span')
	text.textContent = label

	button.replaceChildren(icon, text)
}

function setUploadButtonIdle(button: HTMLButtonElement): void {
	button.disabled = false
	setUploadButtonContent(button, 'Subir imagen', 'fa fa-picture-o')
}

function setTemporaryUploadButtonText(button: HTMLButtonElement, text: string, iconClass: string): void {
	button.disabled = false
	setUploadButtonContent(button, text, iconClass)
	window.setTimeout(() => {
		setUploadButtonIdle(button)
	}, UPLOAD_BUTTON_RESET_MS)
}

function getEditorRoot(textarea: HTMLTextAreaElement): ParentNode {
	return (
		textarea.closest<HTMLElement>(
			`${MV_SELECTORS.EDITOR.POSTFORM}, ${MV_SELECTORS.EDITOR.FORMBOX}, ${MV_SELECTORS.EDITOR.EDITOR_BODY}, form`
		) ?? document
	)
}

function getLayoutOptionsRow(textarea: HTMLTextAreaElement): HTMLElement | null {
	const form = textarea.closest<HTMLFormElement>('form')
	if (!form) return null

	if (form.id === NORMAL_EDITOR_FORM_ID) {
		return form.querySelector<HTMLElement>(NORMAL_EDITOR_META_SELECTOR)
	}

	if (form.id === EXTENDED_EDITOR_FORM_ID) {
		return form.querySelector<HTMLElement>(EXTENDED_EDITOR_FAVORITES_SELECTOR)
	}

	return (
		form.querySelector<HTMLElement>(NORMAL_EDITOR_META_SELECTOR) ??
		form.querySelector<HTMLElement>(EXTENDED_EDITOR_FAVORITES_SELECTOR)
	)
}

function getFavoriteTextOptionsRow(textarea: HTMLTextAreaElement): HTMLElement | null {
	const root = getEditorRoot(textarea)
	const candidates = Array.from(root.querySelectorAll<HTMLElement>('label, span, p, li, div'))
	const favoriteElement = candidates.find(element => {
		if (element.closest(UPLOAD_CONTROL_SELECTOR)) return false
		return FAVORITE_ROW_TEXT_PATTERN.test(element.textContent ?? '')
	})

	if (!favoriteElement) return null

	return (
		favoriteElement.closest<HTMLElement>('li, p, .control, .controls, .editor-controls, .form-group, .checkbox, div') ??
		favoriteElement
	)
}

function getOptionsRowTrailingLink(row: HTMLElement): HTMLElement | null {
	for (const child of Array.from(row.children)) {
		if (!(child instanceof HTMLElement)) continue
		if (child.id === 'goext' || child.classList.contains('pull-right')) return child
	}

	return null
}

function isElementTreeDisplayed(element: HTMLElement): boolean {
	for (let current: HTMLElement | null = element; current; current = current.parentElement) {
		const style = window.getComputedStyle(current)
		if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
		if (current === document.body) break
	}

	return true
}

function hasRenderedBox(element: HTMLElement): boolean {
	const rect = element.getBoundingClientRect()
	return rect.width > 0 && rect.height > 0
}

function canInjectUploadControlFromScan(textarea: HTMLTextAreaElement): boolean {
	if (!isElementTreeDisplayed(textarea) || !hasRenderedBox(textarea)) return false

	const optionsRow = getLayoutOptionsRow(textarea) ?? getFavoriteTextOptionsRow(textarea)
	return !optionsRow || (isElementTreeDisplayed(optionsRow) && hasRenderedBox(optionsRow))
}

function prepareOptionsRowUploadControl(wrapper: HTMLElement, row: HTMLElement): void {
	wrapper.style.display = 'inline-flex'
	wrapper.style.verticalAlign = 'middle'
	wrapper.style.clear = 'none'
	wrapper.style.marginBottom = '4px'

	if (row.id === EXTENDED_EDITOR_FAVORITES_SELECTOR.slice(1)) {
		wrapper.style.cssFloat = 'none'
		wrapper.style.marginLeft = '12px'
		wrapper.style.marginRight = '0'
		return
	}

	wrapper.style.cssFloat = 'right'
	wrapper.style.marginLeft = '8px'
	wrapper.style.marginRight = '12px'
}

function placeUploadControlInOptionsRow(wrapper: HTMLElement, row: HTMLElement): void {
	prepareOptionsRowUploadControl(wrapper, row)

	const trailingLink = getOptionsRowTrailingLink(row)
	if (!trailingLink) {
		row.appendChild(wrapper)
		return
	}

	trailingLink.insertAdjacentElement('afterend', wrapper)
}

function placeUploadControl(wrapper: HTMLElement, textarea: HTMLTextAreaElement): void {
	const optionsRow = getLayoutOptionsRow(textarea) ?? getFavoriteTextOptionsRow(textarea)
	if (optionsRow) {
		placeUploadControlInOptionsRow(wrapper, optionsRow)
		return
	}

	wrapper.style.marginBottom = '8px'
	const fallbackTarget =
		textarea.closest<HTMLElement>(`${MV_SELECTORS.EDITOR.TEXT_WRAP}, ${MV_SELECTORS.EDITOR.EDITOR_BODY}`) ??
		textarea
	fallbackTarget.insertAdjacentElement('beforebegin', wrapper)
}

export function injectMobileLiteUploadControl(textarea: HTMLTextAreaElement): HTMLElement | null {
	if (!isMobileLiteEditorAllowed()) return null
	const existingControl = uploadControlsByTextarea.get(textarea)
	if (existingControl?.isConnected) return existingControl

	textarea.dataset[UPLOAD_CONTROL_MARKER] = 'true'

	const wrapper = document.createElement('div')
	wrapper.setAttribute('data-mvp-mobile-lite-upload-control', 'true')
	wrapper.style.cssText = uploadControlStyles.wrapper

	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'btn btn-large mvp-mobile-lite-upload-button'
	button.style.cssText = uploadControlStyles.button
	setUploadButtonIdle(button)

	const input = document.createElement('input')
	input.type = 'file'
	input.accept = 'image/*'
	input.style.display = 'none'

	const status = document.createElement('span')
	status.style.cssText = uploadControlStyles.status
	status.setAttribute('aria-live', 'polite')

	button.addEventListener('click', () => {
		if (!isMobileLiteEditorAllowed()) return
		input.click()
	})

	input.addEventListener('change', () => {
		const file = input.files?.[0]
		input.value = ''
		if (!file) return

		button.disabled = true
		setUploadButtonContent(button, 'Subiendo...', 'fa fa-spinner fa-spin')
		setUploadControlStatus(status, 'Subiendo...')

		uploadMobileLiteImage(file, textarea)
			.then(result => {
				if (result.status === 'success') {
					setUploadControlStatus(status, 'Imagen insertada')
					setTemporaryUploadButtonText(button, 'Insertada', 'fa fa-check')
					return
				}

				setUploadControlStatus(status, result.error, 'error')
				setTemporaryUploadButtonText(button, 'Error', 'fa fa-exclamation-triangle')
			})
			.catch(error => {
				logger.error('Mobile Lite editor upload control failed:', error)
				setUploadControlStatus(status, 'No se pudo subir la imagen', 'error')
				setTemporaryUploadButtonText(button, 'Error', 'fa fa-exclamation-triangle')
			})
	})

	wrapper.append(button, input, status)
	placeUploadControl(wrapper, textarea)
	uploadControlsByTextarea.set(textarea, wrapper)

	return wrapper
}

export function injectMobileLiteUploadControls(root: ParentNode = document): void {
	if (!isMobileLiteEditorAllowed()) return

	root.querySelectorAll<HTMLTextAreaElement>(TEXTAREA_SELECTOR).forEach(textarea => {
		if (canInjectUploadControlFromScan(textarea)) injectMobileLiteUploadControl(textarea)
	})
}

function schedulePasteHandlerScan(): void {
	if (observerTimeout) clearTimeout(observerTimeout)

	observerTimeout = setTimeout(() => {
		observerTimeout = null
		attachMobileLitePasteHandlers()
		injectMobileLiteUploadControls()
	}, PASTE_OBSERVER_DEBOUNCE_MS)
}

export function initMobileLiteEditorEnhancements(): void {
	if (!isMobileLiteEditorAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	attachDocumentPasteHandler()
	attachDocumentEditorDiscoveryHandler()
	attachMobileLitePasteHandlers()
	injectMobileLiteUploadControls()

	textareaObserver = new MutationObserver(mutations => {
		const hasTextareaChanges = mutations.some(mutation =>
			Array.from(mutation.addedNodes).some(node => {
				if (!(node instanceof HTMLElement)) return false
				return node.matches(TEXTAREA_SELECTOR) || Boolean(node.querySelector(TEXTAREA_SELECTOR))
			})
		)

		if (hasTextareaChanges) {
			schedulePasteHandlerScan()
		}
	})

	textareaObserver.observe(document.body, { childList: true, subtree: true })
}

export async function uploadMobileLiteImage(file: File, textarea: HTMLTextAreaElement): Promise<MobileLiteUploadResult> {
	const validation = validateImageFile(file)
	if (!validation.valid) {
		return { status: 'error', error: validation.error || 'Archivo no valido' }
	}

	try {
		const result = await uploadImage(file)

		if (result.success && result.url) {
			insertMobileLiteImageTag(textarea, result.url)
			return { status: 'success', url: result.url }
		}

		return { status: 'error', error: result.error || 'No se pudo subir la imagen' }
	} catch (error) {
		logger.error('Mobile Lite image upload failed:', error)
		return {
			status: 'error',
			error: error instanceof Error ? error.message : 'No se pudo subir la imagen',
		}
	}
}

export function teardownMobileLiteEditorEnhancements(): void {
	if (observerTimeout) {
		clearTimeout(observerTimeout)
		observerTimeout = null
	}

	textareaObserver?.disconnect()
	textareaObserver = null

	if (documentPasteListenerAttached) {
		document.removeEventListener('paste', handleDocumentPaste, true)
		document.removeEventListener('beforeinput', handleDocumentBeforeInput, true)
		documentPasteListenerAttached = false
	}

	if (documentEditorDiscoveryListenerAttached) {
		document.removeEventListener('focusin', handleDocumentEditorDiscovery, true)
		document.removeEventListener('click', handleDocumentEditorDiscovery, true)
		documentEditorDiscoveryListenerAttached = false
	}

	document.querySelectorAll(UPLOAD_CONTROL_SELECTOR).forEach(control => control.remove())
	uploadControlsByTextarea = new WeakMap<HTMLTextAreaElement, HTMLElement>()

	document.querySelectorAll<HTMLTextAreaElement>(TEXTAREA_SELECTOR).forEach(textarea => {
		delete textarea.dataset[PASTE_MARKER]
		delete textarea.dataset[PRESERVE_TEXTAREA_MARKER]
		delete textarea.dataset[UPLOAD_CONTROL_MARKER]
	})

	document.querySelectorAll<HTMLAnchorElement>(EXTENDED_EDITOR_LINK_SELECTOR).forEach(link => {
		delete link.dataset[PRESERVE_LINK_MARKER]
	})

	initialized = false
}
