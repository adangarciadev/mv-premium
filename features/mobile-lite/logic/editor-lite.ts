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
const IMAGE_CROP_DIALOG_ATTR = 'data-mvp-mobile-lite-image-crop-dialog'
const IMAGE_CROP_SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const COLLAPSED_EDITOR_STYLE_ID = 'mvp-mobile-lite-collapsed-editor-styles'

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
		'box-sizing: border-box',
		'max-width: 100%',
		'margin: 0',
		'padding: 0',
		'font-size: 13px',
	].join(';'),
	button: [
		'display: inline-flex',
		'align-items: center',
		'justify-content: center',
		'gap: 6px',
		'box-sizing: border-box',
		'white-space: nowrap',
		'min-width: 132px',
		'max-width: 100%',
		'touch-action: manipulation',
		'transition: opacity 120ms ease, filter 120ms ease',
	].join(';'),
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
		'position: static',
		'width: 100%',
		'min-width: 0',
		'height: auto',
		'padding: 2px 0 0',
		'margin: 0',
		'overflow: visible',
		'clip: auto',
		'white-space: normal',
		'border: 0',
		'color: #ffb4b4',
		'font-size: 12px',
		'line-height: 1.3',
	].join(';'),
}

type CropDialogResult = File | 'original' | null

interface CropTransform {
	x: number
	y: number
	zoom: number
}

interface CropFrame {
	width: number
	height: number
}

interface ActiveCropDialog {
	finish: (result: CropDialogResult) => void
}

let activeCropDialog: ActiveCropDialog | null = null

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
	icon.style.marginRight = '0'

	const text = document.createElement('span')
	text.textContent = label

	button.replaceChildren(icon, text)
}

function setUploadButtonIdle(button: HTMLButtonElement): void {
	button.disabled = false
	button.removeAttribute('aria-busy')
	button.style.opacity = ''
	button.style.cursor = ''
	button.style.filter = ''
	setUploadButtonContent(button, 'Subir imagen', 'fa fa-picture-o')
}

function setUploadButtonBusy(button: HTMLButtonElement, label: string): void {
	button.disabled = true
	button.setAttribute('aria-busy', 'true')
	button.style.opacity = '0.82'
	button.style.cursor = 'progress'
	button.style.filter = 'saturate(0.9)'
	setUploadButtonContent(button, label, 'fa fa-spinner fa-spin')
}

function setTemporaryUploadButtonText(button: HTMLButtonElement, text: string, iconClass: string): void {
	button.disabled = false
	button.removeAttribute('aria-busy')
	button.style.opacity = ''
	button.style.cursor = ''
	button.style.filter = ''
	setUploadButtonContent(button, text, iconClass)
	window.setTimeout(() => {
		setUploadButtonIdle(button)
	}, UPLOAD_BUTTON_RESET_MS)
}

function isMobileLiteCropSupported(file: File): boolean {
	return (
		IMAGE_CROP_SUPPORTED_TYPES.has(file.type) &&
		typeof URL.createObjectURL === 'function' &&
		typeof URL.revokeObjectURL === 'function' &&
		typeof HTMLCanvasElement !== 'undefined'
	)
}

function getCroppedFileName(fileName: string): string {
	const extensionIndex = fileName.lastIndexOf('.')
	if (extensionIndex <= 0) return `${fileName}-recortada`
	return `${fileName.slice(0, extensionIndex)}-recortada${fileName.slice(extensionIndex)}`
}

function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
	return new Promise((resolve, reject) => {
		const objectUrl = URL.createObjectURL(file)
		const image = new Image()

		image.onload = () => resolve({ image, objectUrl })
		image.onerror = () => {
			URL.revokeObjectURL(objectUrl)
			reject(new Error('No se pudo cargar la imagen'))
		}
		image.src = objectUrl
	})
}

function clampCropTransform(transform: CropTransform, image: HTMLImageElement, frame: CropFrame, baseScale: number): CropTransform {
	const scale = baseScale * transform.zoom
	const width = image.naturalWidth * scale
	const height = image.naturalHeight * scale
	const minX = Math.min(0, frame.width - width)
	const minY = Math.min(0, frame.height - height)

	return {
		x: Math.min(0, Math.max(minX, transform.x)),
		y: Math.min(0, Math.max(minY, transform.y)),
		zoom: transform.zoom,
	}
}

function renderCropImageTransform(
	previewImage: HTMLImageElement,
	image: HTMLImageElement,
	baseScale: number,
	transform: CropTransform
): void {
	const scale = baseScale * transform.zoom
	previewImage.style.width = `${image.naturalWidth * scale}px`
	previewImage.style.height = `${image.naturalHeight * scale}px`
	previewImage.style.transform = `translate(${transform.x}px, ${transform.y}px)`
}

function createCroppedImageFile(file: File, image: HTMLImageElement, frame: CropFrame, baseScale: number, transform: CropTransform): Promise<File> {
	return new Promise((resolve, reject) => {
		const scale = baseScale * transform.zoom
		const sourceWidth = Math.min(image.naturalWidth, frame.width / scale)
		const sourceHeight = Math.min(image.naturalHeight, frame.height / scale)
		const sourceX = Math.min(image.naturalWidth - sourceWidth, Math.max(0, -transform.x / scale))
		const sourceY = Math.min(image.naturalHeight - sourceHeight, Math.max(0, -transform.y / scale))
		const outputWidth = Math.max(1, Math.round(sourceWidth))
		const outputHeight = Math.max(1, Math.round(sourceHeight))
		const canvas = document.createElement('canvas')
		canvas.width = outputWidth
		canvas.height = outputHeight

		const context = canvas.getContext('2d')
		if (!context) {
			reject(new Error('No se pudo recortar la imagen'))
			return
		}

		context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)
		canvas.toBlob(blob => {
			if (!blob) {
				reject(new Error('No se pudo recortar la imagen'))
				return
			}

			resolve(new File([blob], getCroppedFileName(file.name), { type: blob.type || file.type }))
		}, file.type)
	})
}

function closeActiveCropDialog(result: CropDialogResult = null): void {
	activeCropDialog?.finish(result)
}

export async function openMobileLiteImageCropDialog(file: File): Promise<CropDialogResult> {
	if (!isMobileLiteCropSupported(file)) return 'original'

	const { image, objectUrl } = await loadImageFromFile(file)
	closeActiveCropDialog(null)

	return new Promise(resolve => {
		const dialog = document.createElement('div')
		dialog.setAttribute(IMAGE_CROP_DIALOG_ATTR, 'true')
		dialog.setAttribute('role', 'dialog')
		dialog.setAttribute('aria-modal', 'true')
		dialog.setAttribute('aria-label', 'Recortar imagen')
		dialog.className = 'mvp-ml-crop-overlay'

		// Scoped styles travel with the dialog and disappear with dialog.remove().
		// Tokens and recipes come from DESIGN.md (§2 colors, §4 buttons, §5 pill).
		const style = document.createElement('style')
		style.textContent = `
			.mvp-ml-crop-overlay {
				position: fixed;
				inset: 0;
				z-index: 100000;
				display: flex;
				align-items: center;
				justify-content: center;
				box-sizing: border-box;
				padding: max(16px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
				background: rgba(0, 0, 0, 0.6);
				color: #eef1f6;
				font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				overscroll-behavior: contain;
			}
			.mvp-ml-crop-overlay *,
			.mvp-ml-crop-overlay *::before,
			.mvp-ml-crop-overlay *::after {
				box-sizing: border-box;
			}
			.mvp-ml-crop-panel {
				width: min(100%, 390px);
				overflow: hidden;
				border-radius: 24px;
				background: #1c1f27;
				box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6);
			}
			.mvp-ml-crop-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 16px 16px 10px;
			}
			.mvp-ml-crop-title {
				font-size: 16px;
				font-weight: 700;
				line-height: 1.2;
			}
			.mvp-ml-crop-subtitle {
				margin-top: 2px;
				color: #9aa5b4;
				font-size: 12px;
			}
			.mvp-ml-crop-close {
				width: 40px;
				height: 40px;
				flex-shrink: 0;
				border: none;
				border-radius: 999px;
				background: #2e3543;
				color: #aab4c0;
				font-size: 24px;
				line-height: 1;
			}
			.mvp-ml-crop-close:active {
				background: #3a4254;
			}
			.mvp-ml-crop-body {
				padding: 4px 16px 16px;
			}
			.mvp-ml-crop-viewport {
				display: flex;
				align-items: center;
				justify-content: center;
				overflow: hidden;
				border-radius: 16px;
				background: #14171d;
			}
			.mvp-ml-crop-box {
				position: relative;
				overflow: hidden;
				touch-action: none;
				border: 2px solid #f0a020;
				border-radius: 12px;
				background: #14171d;
			}
			.mvp-ml-crop-hint {
				margin: 10px 0 0;
				color: #8b95a3;
				font-size: 12px;
				text-align: center;
			}
			.mvp-ml-crop-modes {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 8px;
				margin-top: 14px;
			}
			.mvp-ml-crop-chip {
				height: 36px;
				border: none;
				border-radius: 999px;
				background: transparent;
				box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
				color: #8b95a3;
				font-size: 13px;
				font-weight: 700;
			}
			.mvp-ml-crop-chip:active {
				background: #2e3543;
			}
			.mvp-ml-crop-chip.mvp-ml-crop-chip-active {
				background: linear-gradient(180deg, rgba(240, 160, 32, 0.22) 0%, rgba(240, 160, 32, 0.07) 100%);
				box-shadow: inset 0 0 0 1px rgba(240, 160, 32, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.35);
				color: #f0a020;
			}
			.mvp-ml-crop-slider-label {
				display: block;
				margin-top: 14px;
				color: #9aa5b4;
				font-size: 12px;
				font-weight: 700;
			}
			.mvp-ml-crop-overlay input[type='range'] {
				width: 100%;
				height: 32px;
				margin: 6px 0 0;
				accent-color: #f0a020;
			}
			.mvp-ml-crop-free-controls {
				display: none;
				grid-template-columns: 1fr 1fr;
				gap: 10px;
			}
			.mvp-ml-crop-free-controls.mvp-ml-crop-free-controls-visible {
				display: grid;
			}
			.mvp-ml-crop-footer {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
				padding: 4px 16px 16px;
			}
			.mvp-ml-crop-btn-secondary {
				height: 44px;
				border: none;
				border-radius: 12px;
				background: #2e3543;
				color: #eef1f6;
				padding: 0 12px;
				font-size: 14px;
				font-weight: 600;
			}
			.mvp-ml-crop-btn-secondary:active {
				background: #3a4254;
			}
			.mvp-ml-crop-btn-primary {
				grid-column: 1 / -1;
				height: 44px;
				border: none;
				border-radius: 12px;
				background: #f0a020;
				color: #221604;
				padding: 0 12px;
				font-size: 14px;
				font-weight: 700;
			}
			.mvp-ml-crop-btn-primary:active {
				background: #d98e12;
			}
			.mvp-ml-crop-btn-primary[disabled] {
				background: #2e3543;
				color: #707b8e;
			}
		`

		const panel = document.createElement('section')
		panel.className = 'mvp-ml-crop-panel'

		const header = document.createElement('header')
		header.className = 'mvp-ml-crop-header'
		const title = document.createElement('div')
		title.innerHTML =
			'<div class="mvp-ml-crop-title">Recortar imagen</div><div class="mvp-ml-crop-subtitle">Opcional antes de subir</div>'
		const closeButton = document.createElement('button')
		closeButton.type = 'button'
		closeButton.textContent = '×'
		closeButton.setAttribute('aria-label', 'Cancelar recorte')
		closeButton.className = 'mvp-ml-crop-close'
		header.append(title, closeButton)

		const body = document.createElement('div')
		body.className = 'mvp-ml-crop-body'

		const maxFrameSize = Math.max(180, Math.min(280, window.innerWidth - 76, window.innerHeight - 360))
		const minFrameSize = Math.max(120, Math.round(maxFrameSize * 0.52))
		let frame: CropFrame = { width: maxFrameSize, height: maxFrameSize }
		const cropViewport = document.createElement('div')
		cropViewport.className = 'mvp-ml-crop-viewport'
		cropViewport.style.height = `${maxFrameSize + 16}px`

		const cropBox = document.createElement('div')
		cropBox.className = 'mvp-ml-crop-box'
		cropBox.style.width = `${frame.width}px`
		cropBox.style.height = `${frame.height}px`

		const previewImage = document.createElement('img')
		previewImage.src = objectUrl
		previewImage.alt = ''
		previewImage.draggable = false
		previewImage.style.cssText = 'position: absolute; left: 0; top: 0; max-width: none; max-height: none; user-select: none; will-change: transform; transform-origin: 0 0;'

		const grid = document.createElement('div')
		grid.setAttribute('aria-hidden', 'true')
		grid.style.cssText = [
			'position: absolute',
			'inset: 0',
			'pointer-events: none',
			'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35)',
			'background: linear-gradient(to right, transparent 33.33%, rgba(255,255,255,0.32) 33.33%, rgba(255,255,255,0.32) 34%, transparent 34%, transparent 66.66%, rgba(255,255,255,0.32) 66.66%, rgba(255,255,255,0.32) 67.33%, transparent 67.33%), linear-gradient(to bottom, transparent 33.33%, rgba(255,255,255,0.32) 33.33%, rgba(255,255,255,0.32) 34%, transparent 34%, transparent 66.66%, rgba(255,255,255,0.32) 66.66%, rgba(255,255,255,0.32) 67.33%, transparent 67.33%)',
		].join(';')

		cropBox.append(previewImage, grid)
		cropViewport.append(cropBox)

		const hint = document.createElement('p')
		hint.textContent = 'Arrastra para encuadrar, pellizca para hacer zoom.'
		hint.className = 'mvp-ml-crop-hint'

		const modeGroup = document.createElement('div')
		modeGroup.setAttribute('role', 'group')
		modeGroup.setAttribute('aria-label', 'Formato de recorte')
		modeGroup.className = 'mvp-ml-crop-modes'

		const createModeButton = (label: string): HTMLButtonElement => {
			const button = document.createElement('button')
			button.type = 'button'
			button.textContent = label
			button.className = 'mvp-ml-crop-chip'
			return button
		}

		const squareModeButton = createModeButton('Cuadrado')
		const originalModeButton = createModeButton('Original')
		const freeModeButton = createModeButton('Libre')
		modeGroup.append(squareModeButton, originalModeButton, freeModeButton)

		const freeControls = document.createElement('div')
		freeControls.className = 'mvp-ml-crop-free-controls'

		const createSliderLabel = (text: string): HTMLLabelElement => {
			const label = document.createElement('label')
			label.textContent = text
			label.className = 'mvp-ml-crop-slider-label'
			return label
		}

		const widthLabel = createSliderLabel('Ancho')
		const widthInput = document.createElement('input')
		widthInput.type = 'range'
		widthInput.min = String(minFrameSize)
		widthInput.max = String(maxFrameSize)
		widthInput.step = '1'
		widthInput.value = String(frame.width)
		widthLabel.append(widthInput)

		const heightLabel = createSliderLabel('Alto')
		const heightInput = document.createElement('input')
		heightInput.type = 'range'
		heightInput.min = String(minFrameSize)
		heightInput.max = String(maxFrameSize)
		heightInput.step = '1'
		heightInput.value = String(frame.height)
		heightLabel.append(heightInput)

		freeControls.append(widthLabel, heightLabel)

		const zoomLabel = createSliderLabel('Zoom')
		const zoomInput = document.createElement('input')
		zoomInput.type = 'range'
		zoomInput.min = '1'
		zoomInput.max = '3'
		zoomInput.step = '0.01'
		zoomInput.value = '1'
		zoomLabel.append(zoomInput)

		body.append(cropViewport, hint, modeGroup, freeControls, zoomLabel)

		const footer = document.createElement('footer')
		footer.className = 'mvp-ml-crop-footer'

		const cancelButton = document.createElement('button')
		cancelButton.type = 'button'
		cancelButton.textContent = 'Cancelar'
		cancelButton.className = 'mvp-ml-crop-btn-secondary'

		const originalButton = document.createElement('button')
		originalButton.type = 'button'
		originalButton.textContent = 'Subir original'
		originalButton.className = 'mvp-ml-crop-btn-secondary'

		const cropButton = document.createElement('button')
		cropButton.type = 'button'
		cropButton.textContent = 'Recortar y subir'
		cropButton.className = 'mvp-ml-crop-btn-primary'

		// One primary action per screen (DESIGN.md §4), full width and last so it
		// sits closest to the thumb.
		footer.append(cancelButton, originalButton, cropButton)
		panel.append(header, body, footer)
		dialog.append(style, panel)
		document.body.appendChild(dialog)

		// Lock the page behind the dialog (same pattern as the panel sheet)
		const previousBodyOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		let baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
		let transform = clampCropTransform(
			{
				x: (frame.width - image.naturalWidth * baseScale) / 2,
				y: (frame.height - image.naturalHeight * baseScale) / 2,
				zoom: 1,
			},
			image,
			frame,
			baseScale
		)

		const updatePreview = () => renderCropImageTransform(previewImage, image, baseScale, transform)
		const updateFrame = (nextFrame: CropFrame) => {
			const previousScale = baseScale * transform.zoom
			const previousCenterX = frame.width / 2
			const previousCenterY = frame.height / 2
			const imageCenterX = (previousCenterX - transform.x) / previousScale
			const imageCenterY = (previousCenterY - transform.y) / previousScale

			frame = nextFrame
			cropBox.style.width = `${frame.width}px`
			cropBox.style.height = `${frame.height}px`
			baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
			const nextScale = baseScale * transform.zoom
			transform = clampCropTransform(
				{
					...transform,
					x: frame.width / 2 - imageCenterX * nextScale,
					y: frame.height / 2 - imageCenterY * nextScale,
				},
				image,
				frame,
				baseScale
			)
			updatePreview()
		}
		const resetFrameToFit = (nextFrame: CropFrame) => {
			frame = nextFrame
			cropBox.style.width = `${frame.width}px`
			cropBox.style.height = `${frame.height}px`
			baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
			transform = clampCropTransform(
				{
					x: (frame.width - image.naturalWidth * baseScale * transform.zoom) / 2,
					y: (frame.height - image.naturalHeight * baseScale * transform.zoom) / 2,
					zoom: transform.zoom,
				},
				image,
				frame,
				baseScale
			)
			updatePreview()
		}
		const getOriginalFrame = (): CropFrame => {
			const naturalRatio = image.naturalWidth / image.naturalHeight
			return {
				width: naturalRatio >= 1 ? maxFrameSize : Math.round(maxFrameSize * naturalRatio),
				height: naturalRatio >= 1 ? Math.round(maxFrameSize / naturalRatio) : maxFrameSize,
			}
		}
		const getFreeFrame = (): CropFrame => {
			const originalFrame = getOriginalFrame()
			return {
				width: Math.max(minFrameSize, originalFrame.width),
				height: Math.max(minFrameSize, originalFrame.height),
			}
		}
		const setModeButtonState = (mode: 'square' | 'original' | 'free') => {
			squareModeButton.classList.toggle('mvp-ml-crop-chip-active', mode === 'square')
			originalModeButton.classList.toggle('mvp-ml-crop-chip-active', mode === 'original')
			freeModeButton.classList.toggle('mvp-ml-crop-chip-active', mode === 'free')
			freeControls.classList.toggle('mvp-ml-crop-free-controls-visible', mode === 'free')
		}
		setModeButtonState('square')
		updatePreview()

		let dragging = false
		let dragStartX = 0
		let dragStartY = 0
		let transformStartX = 0
		let transformStartY = 0
		const activePointers = new Map<number, { x: number; y: number }>()
		let pinchStartDistance = 0
		let pinchStartZoom = 1

		let finished = false
		const finish = (result: CropDialogResult) => {
			if (finished) return
			finished = true
			if (activeCropDialog?.finish === finish) {
				activeCropDialog = null
			}
			document.body.style.overflow = previousBodyOverflow
			URL.revokeObjectURL(objectUrl)
			dialog.remove()
			resolve(result)
		}
		activeCropDialog = { finish }

		/** Re-anchor zoom so the given frame point stays visually still */
		const applyZoom = (nextZoom: number, focalX: number, focalY: number) => {
			const previousScale = baseScale * transform.zoom
			const nextScale = baseScale * nextZoom

			transform = clampCropTransform(
				{
					x: focalX - ((focalX - transform.x) / previousScale) * nextScale,
					y: focalY - ((focalY - transform.y) / previousScale) * nextScale,
					zoom: nextZoom,
				},
				image,
				frame,
				baseScale
			)
			updatePreview()
		}

		const startDragFromPointer = (pointer: { x: number; y: number }) => {
			dragging = true
			dragStartX = pointer.x
			dragStartY = pointer.y
			transformStartX = transform.x
			transformStartY = transform.y
		}

		const getPinchDistance = (): number => {
			const [first, second] = [...activePointers.values()]
			return Math.hypot(first.x - second.x, first.y - second.y)
		}

		cropBox.addEventListener('pointerdown', event => {
			cropBox.setPointerCapture(event.pointerId)
			activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

			if (activePointers.size === 2) {
				// Second finger: switch from drag to pinch zoom
				dragging = false
				pinchStartDistance = getPinchDistance()
				pinchStartZoom = transform.zoom
				return
			}

			startDragFromPointer({ x: event.clientX, y: event.clientY })
		})

		cropBox.addEventListener('pointermove', event => {
			if (!activePointers.has(event.pointerId)) return
			activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

			if (activePointers.size >= 2) {
				if (pinchStartDistance <= 0) return

				const [first, second] = [...activePointers.values()]
				const nextZoom = Math.min(3, Math.max(1, (pinchStartZoom * getPinchDistance()) / pinchStartDistance))
				const boxRect = cropBox.getBoundingClientRect()
				const focalX = (first.x + second.x) / 2 - boxRect.left
				const focalY = (first.y + second.y) / 2 - boxRect.top

				applyZoom(nextZoom, focalX, focalY)
				zoomInput.value = String(nextZoom)
				return
			}

			if (!dragging) return

			transform = clampCropTransform(
				{
					...transform,
					x: transformStartX + event.clientX - dragStartX,
					y: transformStartY + event.clientY - dragStartY,
				},
				image,
				frame,
				baseScale
			)
			updatePreview()
		})

		const handlePointerEnd = (event: PointerEvent) => {
			activePointers.delete(event.pointerId)
			if (cropBox.hasPointerCapture(event.pointerId)) {
				cropBox.releasePointerCapture(event.pointerId)
			}

			if (activePointers.size === 1) {
				// Back from pinch to single-finger drag without jumps
				pinchStartDistance = 0
				startDragFromPointer([...activePointers.values()][0])
				return
			}

			if (activePointers.size === 0) {
				dragging = false
				pinchStartDistance = 0
			}
		}

		cropBox.addEventListener('pointerup', handlePointerEnd)
		cropBox.addEventListener('pointercancel', handlePointerEnd)

		zoomInput.addEventListener('input', () => {
			applyZoom(Number(zoomInput.value), frame.width / 2, frame.height / 2)
		})

		squareModeButton.addEventListener('click', () => {
			widthInput.value = String(maxFrameSize)
			heightInput.value = String(maxFrameSize)
			setModeButtonState('square')
			updateFrame({ width: maxFrameSize, height: maxFrameSize })
		})

		originalModeButton.addEventListener('click', () => {
			const originalFrame = getOriginalFrame()
			widthInput.value = String(originalFrame.width)
			heightInput.value = String(originalFrame.height)
			zoomInput.value = '1'
			transform.zoom = 1
			setModeButtonState('original')
			resetFrameToFit(originalFrame)
		})

		freeModeButton.addEventListener('click', () => {
			const freeFrame = getFreeFrame()
			widthInput.value = String(freeFrame.width)
			heightInput.value = String(freeFrame.height)
			zoomInput.value = '1'
			transform.zoom = 1
			setModeButtonState('free')
			resetFrameToFit(freeFrame)
		})

		widthInput.addEventListener('input', () => {
			setModeButtonState('free')
			updateFrame({ width: Number(widthInput.value), height: frame.height })
		})

		heightInput.addEventListener('input', () => {
			setModeButtonState('free')
			updateFrame({ width: frame.width, height: Number(heightInput.value) })
		})

		closeButton.addEventListener('click', () => finish(null))
		cancelButton.addEventListener('click', () => finish(null))
		originalButton.addEventListener('click', () => finish('original'))
		cropButton.addEventListener('click', () => {
			cropButton.textContent = 'Recortando...'
			cropButton.setAttribute('disabled', 'true')
			void createCroppedImageFile(file, image, frame, baseScale, transform)
				.then(croppedFile => finish(croppedFile))
				.catch(error => {
					logger.error('Mobile Lite image crop failed:', error)
					finish('original')
				})
		})
	})
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
	wrapper.style.marginTop = '5px'
	wrapper.style.marginBottom = '5px'

	if (row.id === EXTENDED_EDITOR_FAVORITES_SELECTOR.slice(1)) {
		wrapper.style.cssFloat = 'none'
		wrapper.style.marginLeft = '10px'
		wrapper.style.marginRight = '0'
		return
	}

	wrapper.style.cssFloat = 'none'
	wrapper.style.marginLeft = '8px'
	wrapper.style.marginRight = '8px'
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

	wrapper.style.marginBottom = '10px'
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

		const validation = validateImageFile(file)
		if (!validation.valid) {
			setUploadControlStatus(status, validation.error || 'Archivo no valido', 'error')
			setTemporaryUploadButtonText(button, 'Error', 'fa fa-exclamation-triangle')
			return
		}

		setUploadButtonBusy(button, 'Preparando...')
		setUploadControlStatus(status, 'Preparando imagen...')

		openMobileLiteImageCropDialog(file)
			.then(cropResult => {
				if (!cropResult) {
					setUploadControlStatus(status, 'Subida cancelada')
					setTemporaryUploadButtonText(button, 'Cancelada', 'fa fa-times')
					return null
				}

				setUploadButtonBusy(button, 'Subiendo...')
				setUploadControlStatus(status, 'Subiendo...')
				return uploadMobileLiteImage(cropResult === 'original' ? file : cropResult, textarea)
			})
			.then(result => {
				if (!result) return
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

/**
 * Mediavida collapses the fixed quick-reply panel (#post-editor) by animating
 * its inline height down to 0px, but its overflow stays visible and the
 * .editor-meta row (Enviar, favoritos, our upload button) is absolutely
 * positioned — so when the final hide step doesn't land (it reliably fails
 * after opening the editor via the quote-on-selection button), the row keeps
 * floating over the page at height 0. Clipping the collapsed state is
 * self-healing: the selector stops matching as soon as MV writes a height > 0.
 */
function ensureCollapsedEditorStyles(): void {
	if (document.getElementById(COLLAPSED_EDITOR_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = COLLAPSED_EDITOR_STYLE_ID
	style.textContent = `
		#post-editor[style*="height: 0px"],
		#post-editor[style*="height:0px"] {
			overflow: hidden !important;
			padding: 0 !important;
			border: 0 !important;
		}
	`
	document.head.appendChild(style)
}

export function initMobileLiteEditorEnhancements(): void {
	if (!isMobileLiteEditorAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	ensureCollapsedEditorStyles()
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
	closeActiveCropDialog(null)

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

	document.getElementById(COLLAPSED_EDITOR_STYLE_ID)?.remove()
	initialized = false
}
