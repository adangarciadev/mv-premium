import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { editorPreserveStorage } from '@/features/editor/storage'
import {
	attachMobileLitePasteHandlers,
	getMobileLiteEditorTextarea,
	getMobileLitePasteReplacement,
	handleMobileLiteTextareaBeforeInput,
	handleMobileLiteTextareaPaste,
	initMobileLiteEditorEnhancements,
	injectMobileLiteUploadControl,
	injectMobileLiteUploadControls,
	insertMobileLiteImageTag,
	teardownMobileLiteEditorEnhancements,
	uploadMobileLiteImage,
} from './editor-lite'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	uploadImage: vi.fn(),
}))

vi.mock('@/lib/platform', () => ({
	getPlatformKind: mocks.getPlatformKind,
}))

vi.mock('@/lib/feature-flags', () => ({
	FeatureFlag: {
		MobileLite: 'mobile-lite',
	},
	isFeatureEnabled: mocks.isFeatureEnabled,
}))

vi.mock('@/services/api/imgbb', () => {
	return {
		validateImageFile: (file: File) => {
			if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
				return { valid: false, error: 'Tipo de archivo no soportado. Usa JPG, PNG, GIF o WebP.' }
			}

			return { valid: true }
		},
		uploadImage: mocks.uploadImage,
	}
})

function renderEditor(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `<form id="postform"><textarea id="cuerpo" name="cuerpo">${value}</textarea></form>`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function renderWrappedEditor(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `
		<form id="postform">
			<div class="editor-body">
				<div class="text-wrap"><textarea id="cuerpo" name="cuerpo">${value}</textarea></div>
				<div class="editor-controls"><button type="submit">Responder</button></div>
			</div>
		</form>
	`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function renderEditorWithFavoriteRow(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `
		<form id="postform">
			<div class="editor-body">
				<div class="text-wrap"><textarea id="cuerpo" name="cuerpo">${value}</textarea></div>
				<div class="editor-options">
					<label><input type="checkbox" name="favorito" /> Añadir favoritos</label>
				</div>
				<div class="editor-controls"><button type="submit">Enviar</button></div>
			</div>
		</form>
	`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function renderNormalMediavidaEditor(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `
		<form id="postform" class="single msg">
			<div class="control fullw">
				<div class="editor-body fullw">
					<div class="text-wrap"><textarea id="cuerpo" name="cuerpo">${value}</textarea></div>
				</div>
				<div class="editor-meta fullw">
					<button id="btsubmit" type="submit">Enviar</button>
					<label for="tofav"><input type="checkbox" name="tofav" id="tofav" value="1">Añadir a favoritos</label>
					<a href="/responder" class="pull-right" id="goext">Editor extendido</a>
				</div>
			</div>
		</form>
	`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function renderCollapsedNormalMediavidaEditor(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `
		<form id="postform" class="single msg">
			<div class="control fullw">
				<div class="editor-body fullw" style="display: none">
					<div class="text-wrap"><textarea id="cuerpo" name="cuerpo">${value}</textarea></div>
				</div>
				<div class="editor-meta fullw" style="display: none">
					<button id="btsubmit" type="submit">Enviar</button>
					<label for="tofav"><input type="checkbox" name="tofav" id="tofav" value="1">Añadir a favoritos</label>
					<a href="/responder" class="pull-right" id="goext">Editor extendido</a>
				</div>
			</div>
		</form>
	`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function renderExtendedMediavidaEditor(value = ''): HTMLTextAreaElement {
	document.body.innerHTML = `
		<form id="postear" class="single">
			<div class="editor-content">
				<div id="content-input"><textarea id="cuerpo" name="cuerpo">${value}</textarea></div>
			</div>
			<div id="tofavstuff">
				<a class="btn btn-sm btn-link pull-right" href="/ayuda/formato-texto">Ayuda</a>
				<input type="checkbox" name="tofav" id="tofav" value="1">
				<label class="positive" for="tofav">Añadir tema a favoritos</label>
			</div>
			<div class="cf"><button type="submit" name="Submit">Responder</button></div>
		</form>
	`
	return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
}

function createPasteEvent(text: string): ClipboardEvent {
	const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
	Object.defineProperty(event, 'clipboardData', {
		value: {
			getData: (type: string) => (type === 'text/plain' ? text : ''),
		},
	})
	return event
}

function createBeforeInputEvent(text: string, inputType = 'insertText'): InputEvent {
	const event = new InputEvent('beforeinput', {
		bubbles: true,
		cancelable: true,
		data: text,
		inputType,
	})

	return event
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
	Object.defineProperty(input, 'files', {
		value: files,
		configurable: true,
	})
}

describe('Mobile Lite editor enhancements', () => {
	beforeEach(async () => {
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.uploadImage.mockReset()
		await editorPreserveStorage.removeValue()
	})

	afterEach(() => {
		teardownMobileLiteEditorEnhancements()
	})

	it('detects a compatible mobile editor textarea', () => {
		const textarea = renderEditor()

		expect(getMobileLiteEditorTextarea()).toBe(textarea)
	})

	it('returns null when there is no compatible textarea', () => {
		document.body.innerHTML = '<main>No editor</main>'

		expect(getMobileLiteEditorTextarea()).toBeNull()
	})

	it('inserts image BBCode at the cursor and dispatches input/change events', () => {
		const textarea = renderEditor('Hola mundo')
		textarea.selectionStart = 5
		textarea.selectionEnd = 11
		const inputListener = vi.fn()
		const changeListener = vi.fn()
		textarea.addEventListener('input', inputListener)
		textarea.addEventListener('change', changeListener)

		insertMobileLiteImageTag(textarea, 'https://example.com/image.jpg')

		expect(textarea.value).toBe('Hola [img]https://example.com/image.jpg[/img]\n')
		expect(textarea.selectionStart).toBe(textarea.value.length)
		expect(inputListener).toHaveBeenCalledOnce()
		expect(changeListener).toHaveBeenCalledOnce()
	})

	it('uploads an image and inserts the returned URL', async () => {
		const textarea = renderEditor('Texto\n')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length
		mocks.uploadImage.mockResolvedValue({
			success: true,
			url: 'https://freeimage.host/i/uploaded.png',
		})

		const result = await uploadMobileLiteImage(new File(['image'], 'image.png', { type: 'image/png' }), textarea)

		expect(result).toEqual({ status: 'success', url: 'https://freeimage.host/i/uploaded.png' })
		expect(textarea.value).toBe('Texto\n[img]https://freeimage.host/i/uploaded.png[/img]\n')
	})

	it('returns validation errors without uploading unsupported files', async () => {
		const textarea = renderEditor()

		const result = await uploadMobileLiteImage(new File(['text'], 'notes.txt', { type: 'text/plain' }), textarea)

		expect(result.status).toBe('error')
		expect(mocks.uploadImage).not.toHaveBeenCalled()
		expect(textarea.value).toBe('')
	})

	it('injects the image upload control next to the editor textarea without duplicates', () => {
		const textarea = renderEditor()

		const firstControl = injectMobileLiteUploadControl(textarea)
		const secondControl = injectMobileLiteUploadControl(textarea)

		expect(firstControl).toBeTruthy()
		expect(secondControl).toBe(firstControl)
		expect(document.querySelectorAll('[data-mvp-mobile-lite-upload-control="true"]')).toHaveLength(1)
		expect(firstControl?.nextElementSibling).toBe(textarea)
		expect(firstControl?.querySelector('button')?.textContent).toBe('Subir imagen')
		expect(firstControl?.querySelector('button')?.classList.contains('btn')).toBe(true)
		expect(firstControl?.querySelector('button i')?.className).toBe('fa fa-picture-o')
	})

	it('places the image upload control after the textarea visual wrapper when present', () => {
		const textarea = renderWrappedEditor()
		const textWrap = textarea.closest('.text-wrap')

		const control = injectMobileLiteUploadControl(textarea)

		expect(control).toBeTruthy()
		expect(control?.nextElementSibling).toBe(textWrap)
	})

	it('places the image upload control in the favorites row when present', () => {
		const textarea = renderEditorWithFavoriteRow()
		const favoriteRow = document.querySelector<HTMLElement>('.editor-options')

		const control = injectMobileLiteUploadControl(textarea)

		expect(control).toBeTruthy()
		expect(control?.parentElement).toBe(favoriteRow)
		expect(favoriteRow?.style.display).toBe('')
		expect(control?.style.cssFloat).toBe('right')
	})

	it('places the image upload control in the normal mobile editor metadata row before the extended editor link', () => {
		const textarea = renderNormalMediavidaEditor()
		const editorMeta = document.querySelector<HTMLElement>('.editor-meta')
		const extendedEditorLink = document.querySelector<HTMLElement>('#goext')

		const control = injectMobileLiteUploadControl(textarea)

		expect(control).toBeTruthy()
		expect(control?.parentElement).toBe(editorMeta)
		expect(control?.previousElementSibling).toBe(extendedEditorLink)
		expect(editorMeta?.style.display).toBe('')
		expect(control?.style.cssFloat).toBe('right')
		expect(control?.style.marginRight).toBe('12px')
	})

	it('preserves mobile editor content before opening the extended editor link', async () => {
		renderNormalMediavidaEditor('Texto escrito en movil')
		const extendedEditorLink = document.querySelector<HTMLAnchorElement>('#goext')
		expect(extendedEditorLink).toBeTruthy()

		initMobileLiteEditorEnhancements()
		extendedEditorLink!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

		await vi.waitFor(async () => {
			await expect(editorPreserveStorage.getValue()).resolves.toMatchObject({
				content: 'Texto escrito en movil',
			})
		})
	})

	it('restores preserved mobile editor content on the extended editor page', async () => {
		await editorPreserveStorage.setValue({
			content: 'Texto recuperado',
			timestamp: Date.now(),
		})
		const textarea = renderExtendedMediavidaEditor()

		initMobileLiteEditorEnhancements()

		await vi.waitFor(() => {
			expect(textarea.value).toBe('Texto recuperado')
		})
	})

	it('places the image upload control in the extended editor favorites row and keeps the help link at the end', () => {
		const textarea = renderExtendedMediavidaEditor()
		const favoritesRow = document.querySelector<HTMLElement>('#tofavstuff')
		const helpLink = document.querySelector<HTMLElement>('.pull-right')

		const control = injectMobileLiteUploadControl(textarea)

		expect(control).toBeTruthy()
		expect(control?.parentElement).toBe(favoritesRow)
		expect(control?.previousElementSibling).toBe(helpLink)
		expect(favoritesRow?.style.display).toBe('')
		expect(control?.style.cssFloat).toBe('none')
		expect(control?.style.marginLeft).toBe('12px')
		expect(control?.style.marginRight).toBe('0px')
	})

	it('does not reveal the collapsed normal mobile editor during the initial upload control scan', () => {
		renderCollapsedNormalMediavidaEditor()
		const editorMeta = document.querySelector<HTMLElement>('.editor-meta')

		injectMobileLiteUploadControls()

		expect(document.querySelector('[data-mvp-mobile-lite-upload-control="true"]')).toBeNull()
		expect(editorMeta?.style.display).toBe('none')
	})

	it('injects the upload control when the mobile editor textarea receives focus', () => {
		const textarea = renderWrappedEditor()

		initMobileLiteEditorEnhancements()
		textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

		expect(document.querySelector('[data-mvp-mobile-lite-upload-control="true"]')).toBeTruthy()
	})

	it('does not inject upload controls outside Firefox Android', () => {
		renderEditor()
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		injectMobileLiteUploadControls()

		expect(document.querySelector('[data-mvp-mobile-lite-upload-control="true"]')).toBeNull()
	})

	it('does not inject upload controls when mobileLiteEnabled is false', () => {
		renderEditor()
		mocks.isFeatureEnabled.mockReturnValue(false)

		injectMobileLiteUploadControls()

		expect(document.querySelector('[data-mvp-mobile-lite-upload-control="true"]')).toBeNull()
	})

	it('uploads from the injected editor control and inserts the returned image BBCode', async () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length
		mocks.uploadImage.mockResolvedValue({
			success: true,
			url: 'https://freeimage.host/i/mobile.png',
		})

		const control = injectMobileLiteUploadControl(textarea)
		const input = control?.querySelector<HTMLInputElement>('input[type="file"]')
		expect(input).toBeTruthy()

		setInputFiles(input!, [new File(['image'], 'mobile.png', { type: 'image/png' })])
		input!.dispatchEvent(new Event('change', { bubbles: true }))

		await vi.waitFor(() => {
			expect(textarea.value).toBe('Antes [img]https://freeimage.host/i/mobile.png[/img]\n')
		})
		expect(control?.textContent).toContain('Insertada')
	})

	it('reports upload errors in the injected editor control', async () => {
		const textarea = renderEditor()
		mocks.uploadImage.mockResolvedValue({
			success: false,
			error: 'Network error',
		})

		const control = injectMobileLiteUploadControl(textarea)
		const input = control?.querySelector<HTMLInputElement>('input[type="file"]')
		expect(input).toBeTruthy()

		setInputFiles(input!, [new File(['image'], 'mobile.png', { type: 'image/png' })])
		input!.dispatchEvent(new Event('change', { bubbles: true }))

		await vi.waitFor(() => {
			expect(control?.textContent).toContain('Error')
		})
		expect(textarea.value).toBe('')
	})

	it.each([
		'https://example.com/image.jpg',
		'https://example.com/image.jpeg',
		'https://example.com/image.png',
		'https://example.com/image.gif',
	])('autoformats image URL %s', url => {
		expect(getMobileLitePasteReplacement(url)).toBe(`[img]${url}[/img]`)
	})

	it('does not autoformat webp URLs unsupported by the Mediavida img detector', () => {
		expect(getMobileLitePasteReplacement('https://example.com/image.webp')).toBeNull()
	})

	it.each([
		['https://www.youtube.com/watch?v=abc123', '[media]https://www.youtube.com/watch?v=abc123[/media]'],
		['https://youtube.com/shorts/abc123', '[media]https://youtube.com/v/abc123[/media]'],
		['https://www.instagram.com/reel/ABC123xyz/', '[media]https://www.instagram.com/reel/ABC123xyz/[/media]'],
		['https://x.com/user/status/123456789', '[media]https://x.com/user/status/123456789[/media]'],
		['https://store.steampowered.com/app/570/Dota_2/', '[media]https://store.steampowered.com/app/570/Dota_2/[/media]'],
		['https://redd.it/abc123', '[media]https://redd.it/abc123[/media]'],
	])('autoformats media URL %s', (url, expected) => {
		expect(getMobileLitePasteReplacement(url)).toBe(expected)
	})

	it('normalizes invisible clipboard characters around URLs before autoformatting', () => {
		expect(getMobileLitePasteReplacement('\u200Bhttps://redd.it/abc123\uFEFF')).toBe(
			'[media]https://redd.it/abc123[/media]'
		)
	})

	it('does not autoformat Reddit mobile share redirects unsupported by Mediavida preview', () => {
		expect(getMobileLitePasteReplacement('https://www.reddit.com/r/gaming/s/abc123')).toBeNull()
	})

	it.each([
		'texto normal',
		'https://example.com/a.jpg https://example.com/b.jpg',
		'https://example.com/a.jpg\nhttps://example.com/b.jpg',
		'https://example.com/page',
	])('leaves complex or unsupported pasted text untouched: %s', text => {
		expect(getMobileLitePasteReplacement(text)).toBeNull()
	})

	it('handles paste events by inserting BBCode and preventing native paste', () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length
		const event = createPasteEvent('https://example.com/image.jpg')

		const handled = handleMobileLiteTextareaPaste(textarea, event)

		expect(handled).toBe(true)
		expect(event.defaultPrevented).toBe(true)
		expect(textarea.value).toBe('Antes [img]https://example.com/image.jpg[/img]')
	})

	it('handles beforeinput URL insertions from mobile keyboard clipboard suggestions', () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length
		const event = createBeforeInputEvent('https://example.com/image.jpg')

		const handled = handleMobileLiteTextareaBeforeInput(textarea, event)

		expect(handled).toBe(true)
		expect(event.defaultPrevented).toBe(true)
		expect(textarea.value).toBe('Antes [img]https://example.com/image.jpg[/img]')
	})

	it('leaves regular beforeinput typing untouched', () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length
		const event = createBeforeInputEvent('hola')

		const handled = handleMobileLiteTextareaBeforeInput(textarea, event)

		expect(handled).toBe(false)
		expect(event.defaultPrevented).toBe(false)
		expect(textarea.value).toBe('Antes ')
	})

	it('handles paste events through the document capture listener on real editor textareas', () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length

		initMobileLiteEditorEnhancements()
		textarea.dispatchEvent(createPasteEvent('https://x.com/user/status/123456789'))

		expect(textarea.value).toBe('Antes [media]https://x.com/user/status/123456789[/media]')
	})

	it('handles beforeinput events through the document capture listener on real editor textareas', () => {
		const textarea = renderEditor('Antes ')
		textarea.selectionStart = textarea.value.length
		textarea.selectionEnd = textarea.value.length

		initMobileLiteEditorEnhancements()
		textarea.dispatchEvent(createBeforeInputEvent('https://x.com/user/status/123456789', 'insertFromPaste'))

		expect(textarea.value).toBe('Antes [media]https://x.com/user/status/123456789[/media]')
	})

	it('does not attach paste handlers outside Firefox Android', () => {
		const textarea = renderEditor()
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		attachMobileLitePasteHandlers()

		expect(textarea.dataset.mvpMobileLitePaste).toBeUndefined()
	})

	it('does not attach paste handlers when mobileLiteEnabled is false', () => {
		const textarea = renderEditor()
		mocks.isFeatureEnabled.mockReturnValue(false)

		attachMobileLitePasteHandlers()

		expect(textarea.dataset.mvpMobileLitePaste).toBeUndefined()
	})
})
