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
	button: ['white-space: nowrap', 'min-width: 126px', 'max-width: 100%'].join(';'),
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

export async function openMobileLiteImageCropDialog(file: File): Promise<CropDialogResult> {
	if (!isMobileLiteCropSupported(file)) return 'original'

	const { image, objectUrl } = await loadImageFromFile(file)
	const existingDialog = document.querySelector(`[${IMAGE_CROP_DIALOG_ATTR}="true"]`)
	existingDialog?.remove()

	return new Promise(resolve => {
		const dialog = document.createElement('div')
		dialog.setAttribute(IMAGE_CROP_DIALOG_ATTR, 'true')
		dialog.style.cssText = [
			'position: fixed',
			'inset: 0',
			'z-index: 100000',
			'display: flex',
			'align-items: center',
			'justify-content: center',
			'box-sizing: border-box',
			'padding: max(16px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))',
			'background: rgba(0, 0, 0, 0.68)',
			'color: #e5e8eb',
			'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		].join(';')

		const panel = document.createElement('section')
		panel.style.cssText = [
			'width: min(100%, 390px)',
			'overflow: hidden',
			'border: 1px solid #4b545d',
			'border-radius: 10px',
			'background: #343b41',
			'box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45)',
		].join(';')

		const header = document.createElement('header')
		header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #30363d; border-bottom: 1px solid #46505a;'
		const title = document.createElement('div')
		title.innerHTML = '<div style="font-size: 16px; font-weight: 700; line-height: 1.2;">Recortar imagen</div><div style="margin-top: 2px; color: #b7bec6; font-size: 12px;">Opcional antes de subir</div>'
		const closeButton = document.createElement('button')
		closeButton.type = 'button'
		closeButton.textContent = '×'
		closeButton.setAttribute('aria-label', 'Cancelar recorte')
		closeButton.style.cssText = 'width: 40px; height: 40px; border: 1px solid #56606a; border-radius: 7px; background: #444b54; color: #eef1f3; font-size: 26px; line-height: 1;'
		header.append(title, closeButton)

		const body = document.createElement('div')
		body.style.cssText = 'padding: 16px; background: #384149;'

		const maxFrameSize = Math.max(180, Math.min(280, window.innerWidth - 76, window.innerHeight - 360))
		const minFrameSize = Math.max(120, Math.round(maxFrameSize * 0.52))
		let frame: CropFrame = { width: maxFrameSize, height: maxFrameSize }
		const cropViewport = document.createElement('div')
		cropViewport.style.cssText = [
			`height: ${maxFrameSize}px`,
			'display: flex',
			'align-items: center',
			'justify-content: center',
			'overflow: hidden',
		].join(';')

		const cropBox = document.createElement('div')
		cropBox.style.cssText = [
			`width: ${frame.width}px`,
			`height: ${frame.height}px`,
			'box-sizing: border-box',
			'position: relative',
			'overflow: hidden',
			'touch-action: none',
			'border: 2px solid #d06d00',
			'border-radius: 8px',
			'background: #20262c',
		].join(';')

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
		hint.textContent = 'Arrastra la imagen para encuadrar.'
		hint.style.cssText = 'margin: 10px 0 0; color: #b7bec6; font-size: 12px; text-align: center;'

		const modeGroup = document.createElement('div')
		modeGroup.setAttribute('role', 'group')
		modeGroup.setAttribute('aria-label', 'Formato de recorte')
		modeGroup.style.cssText = 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px;'

		const squareModeButton = document.createElement('button')
		squareModeButton.type = 'button'
		squareModeButton.textContent = 'Cuadrado'
		squareModeButton.style.cssText = 'height: 36px; border: 1px solid #d06d00; border-radius: 7px; background: #7b4b08; color: white; font-weight: 700;'

		const originalModeButton = document.createElement('button')
		originalModeButton.type = 'button'
		originalModeButton.textContent = 'Original'
		originalModeButton.style.cssText = 'height: 36px; border: 1px solid #626b74; border-radius: 7px; background: #545d66; color: #eef1f3; font-weight: 700;'

		const freeModeButton = document.createElement('button')
		freeModeButton.type = 'button'
		freeModeButton.textContent = 'Libre'
		freeModeButton.style.cssText = 'height: 36px; border: 1px solid #626b74; border-radius: 7px; background: #545d66; color: #eef1f3; font-weight: 700;'

		modeGroup.append(squareModeButton, originalModeButton, freeModeButton)

		const freeControls = document.createElement('div')
		freeControls.style.cssText = 'display: none; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;'

		const widthLabel = document.createElement('label')
		widthLabel.textContent = 'Ancho'
		widthLabel.style.cssText = 'display: block; color: #d8dde2; font-size: 12px; font-weight: 600;'
		const widthInput = document.createElement('input')
		widthInput.type = 'range'
		widthInput.min = String(minFrameSize)
		widthInput.max = String(maxFrameSize)
		widthInput.step = '1'
		widthInput.value = String(frame.width)
		widthInput.style.cssText = 'width: 100%; margin-top: 6px; accent-color: #d06d00;'
		widthLabel.append(widthInput)

		const heightLabel = document.createElement('label')
		heightLabel.textContent = 'Alto'
		heightLabel.style.cssText = 'display: block; color: #d8dde2; font-size: 12px; font-weight: 600;'
		const heightInput = document.createElement('input')
		heightInput.type = 'range'
		heightInput.min = String(minFrameSize)
		heightInput.max = String(maxFrameSize)
		heightInput.step = '1'
		heightInput.value = String(frame.height)
		heightInput.style.cssText = 'width: 100%; margin-top: 6px; accent-color: #d06d00;'
		heightLabel.append(heightInput)

		freeControls.append(widthLabel, heightLabel)

		const zoomLabel = document.createElement('label')
		zoomLabel.textContent = 'Zoom'
		zoomLabel.style.cssText = 'display: block; margin-top: 14px; color: #d8dde2; font-size: 13px; font-weight: 600;'

		const zoomInput = document.createElement('input')
		zoomInput.type = 'range'
		zoomInput.min = '1'
		zoomInput.max = '3'
		zoomInput.step = '0.01'
		zoomInput.value = '1'
		zoomInput.style.cssText = 'width: 100%; margin-top: 8px; accent-color: #d06d00;'

		body.append(cropViewport, hint, modeGroup, freeControls, zoomLabel, zoomInput)

		const footer = document.createElement('footer')
		footer.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 12px 16px; background: #30363d; border-top: 1px solid #46505a;'

		const originalButton = document.createElement('button')
		originalButton.type = 'button'
		originalButton.textContent = 'Subir original'
		originalButton.style.cssText = 'height: 40px; border: 1px solid #626b74; border-radius: 7px; background: #545d66; color: #eef1f3; padding: 0 12px; font-weight: 700;'

		const cropButton = document.createElement('button')
		cropButton.type = 'button'
		cropButton.textContent = 'Recortar y subir'
		cropButton.style.cssText = 'height: 40px; border: 1px solid #d06d00; border-radius: 7px; background: #7b4b08; color: white; padding: 0 12px; font-weight: 700;'

		const cancelButton = document.createElement('button')
		cancelButton.type = 'button'
		cancelButton.textContent = 'Cancelar'
		cancelButton.style.cssText = 'height: 40px; border: 1px solid #626b74; border-radius: 7px; background: transparent; color: #eef1f3; padding: 0 12px; font-weight: 700;'

		footer.append(cancelButton, originalButton, cropButton)
		panel.append(header, body, footer)
		dialog.append(panel)
		document.body.appendChild(dialog)

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
			const activeStyle = 'height: 36px; border: 1px solid #d06d00; border-radius: 7px; background: #7b4b08; color: white; font-weight: 700;'
			const idleStyle = 'height: 36px; border: 1px solid #626b74; border-radius: 7px; background: #545d66; color: #eef1f3; font-weight: 700;'
			squareModeButton.style.cssText = mode === 'square' ? activeStyle : idleStyle
			originalModeButton.style.cssText = mode === 'original' ? activeStyle : idleStyle
			freeModeButton.style.cssText = mode === 'free' ? activeStyle : idleStyle
			freeControls.style.display = mode === 'free' ? 'grid' : 'none'
		}
		updatePreview()

		let dragging = false
		let dragStartX = 0
		let dragStartY = 0
		let transformStartX = 0
		let transformStartY = 0

		const finish = (result: CropDialogResult) => {
			URL.revokeObjectURL(objectUrl)
			dialog.remove()
			resolve(result)
		}

		cropBox.addEventListener('pointerdown', event => {
			dragging = true
			dragStartX = event.clientX
			dragStartY = event.clientY
			transformStartX = transform.x
			transformStartY = transform.y
			cropBox.setPointerCapture(event.pointerId)
		})

		cropBox.addEventListener('pointermove', event => {
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

		cropBox.addEventListener('pointerup', event => {
			dragging = false
			cropBox.releasePointerCapture(event.pointerId)
		})
		cropBox.addEventListener('pointercancel', event => {
			dragging = false
			cropBox.releasePointerCapture(event.pointerId)
		})

		zoomInput.addEventListener('input', () => {
			const previousScale = baseScale * transform.zoom
			const nextZoom = Number(zoomInput.value)
			const nextScale = baseScale * nextZoom
			const centerX = frame.width / 2
			const centerY = frame.height / 2

			transform = clampCropTransform(
				{
					x: centerX - ((centerX - transform.x) / previousScale) * nextScale,
					y: centerY - ((centerY - transform.y) / previousScale) * nextScale,
					zoom: nextZoom,
				},
				image,
				frame,
				baseScale
			)
			updatePreview()
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
	wrapper.style.marginTop = '4px'
	wrapper.style.marginBottom = '4px'

	if (row.id === EXTENDED_EDITOR_FAVORITES_SELECTOR.slice(1)) {
		wrapper.style.cssFloat = 'none'
		wrapper.style.marginLeft = '12px'
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

		const validation = validateImageFile(file)
		if (!validation.valid) {
			setUploadControlStatus(status, validation.error || 'Archivo no valido', 'error')
			setTemporaryUploadButtonText(button, 'Error', 'fa fa-exclamation-triangle')
			return
		}

		button.disabled = true
		setUploadButtonContent(button, 'Preparando...', 'fa fa-spinner fa-spin')
		setUploadControlStatus(status, 'Preparando imagen...')

		openMobileLiteImageCropDialog(file)
			.then(cropResult => {
				if (!cropResult) {
					setUploadControlStatus(status, 'Subida cancelada')
					setTemporaryUploadButtonText(button, 'Cancelada', 'fa fa-times')
					return null
				}

				setUploadButtonContent(button, 'Subiendo...', 'fa fa-spinner fa-spin')
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
