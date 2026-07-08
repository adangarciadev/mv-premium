import { beforeEach, describe, expect, it, vi } from 'vitest'

let injectedNodes = new WeakSet<Element>()
const { mountFeatureWithBoundaryMock } = vi.hoisted(() => ({
	mountFeatureWithBoundaryMock: vi.fn(),
}))

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	isAlreadyInjected: (el: Element) => injectedNodes.has(el),
	markAsInjected: (el: Element) => {
		injectedNodes.add(el)
	},
	mountFeature: vi.fn(),
	mountFeatureWithBoundary: mountFeatureWithBoundaryMock,
	isFeatureMounted: vi.fn(() => false),
}))

vi.mock('@/features/drafts/components/draft-manager', () => ({
	DraftManager: () => null,
}))

vi.mock('../components/distributed-editor-toolbar', () => ({
	DistributedEditorToolbar: () => null,
}))

const { isImageUrlMock, isMediaUrlMock, settingsStateMock } = vi.hoisted(() => ({
	isImageUrlMock: vi.fn(() => false),
	isMediaUrlMock: vi.fn(() => false),
	settingsStateMock: { autoTagsEnabled: true },
}))

vi.mock('./image-detector', () => ({
	isImageUrl: isImageUrlMock,
}))

vi.mock('./media-detector', () => ({
	isMediaUrl: isMediaUrlMock,
	normalizeMediaUrl: (url: string) => url,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: () => settingsStateMock,
	},
}))

import { injectCharacterCounter, injectEditorToolbar, injectPasteHandler } from './editor-toolbar'

function createPasteEvent(text: string): ClipboardEvent {
	const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
	Object.defineProperty(event, 'clipboardData', {
		value: {
			getData: (type: string) => (type === 'text/plain' ? text : ''),
		},
	})
	return event
}

describe('editor-toolbar character counter', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		injectedNodes = new WeakSet<Element>()
		mountFeatureWithBoundaryMock.mockClear()
		isImageUrlMock.mockReset().mockReturnValue(false)
		isMediaUrlMock.mockReset().mockReturnValue(false)
		settingsStateMock.autoTagsEnabled = true
	})

	it('does not inject counter in private message textareas', () => {
		document.body.innerHTML = `
			<div class="pm-compose">
				<div>
					<textarea name="msg" id="msg"></textarea>
					<button type="submit" class="btn btn-primary">Enviar</button>
				</div>
			</div>
		`

		injectCharacterCounter()

		expect(document.querySelector('.mvp-char-counter')).toBeNull()
	})

	it('injects counter in standard editor textarea', () => {
		document.body.innerHTML = `
			<div>
				<textarea id="cuerpo" name="cuerpo"></textarea>
			</div>
		`

		injectCharacterCounter()

		expect(document.querySelector('.mvp-char-counter')).not.toBeNull()
	})

	it('injects fallback toolbar without counter in profile info textarea and locks resize to vertical', () => {
		document.body.innerHTML = `
			<form id="general-form">
				<div class="control-input">
					<textarea name="info"></textarea>
				</div>
			</form>
		`

		injectEditorToolbar()
		injectCharacterCounter()

		const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="info"]')
		const toolbar = document.querySelector('.mvp-pm-toolbar')

		expect(toolbar).not.toBeNull()
		expect(textarea?.previousElementSibling).toBe(toolbar)
		expect(document.querySelector('.mvp-char-counter')).toBeNull()
		expect(textarea?.style.resize).toBe('vertical')
		expect(mountFeatureWithBoundaryMock).toHaveBeenCalledOnce()
	})
})

describe('editor-toolbar paste handler', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		injectedNodes = new WeakSet<Element>()
		isImageUrlMock.mockReset().mockReturnValue(false)
		isMediaUrlMock.mockReset().mockReturnValue(false)
		settingsStateMock.autoTagsEnabled = true
	})

	function renderTextarea(): HTMLTextAreaElement {
		document.body.innerHTML = '<textarea id="cuerpo" name="cuerpo"></textarea>'
		return document.querySelector<HTMLTextAreaElement>('#cuerpo')!
	}

	it('wraps a pasted image URL in [img] tags when auto-tags is enabled', () => {
		const textarea = renderTextarea()
		isImageUrlMock.mockReturnValue(true)

		injectPasteHandler()
		const event = createPasteEvent('https://example.com/image.jpg')
		textarea.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(textarea.value).toBe('[img]https://example.com/image.jpg[/img]')
	})

	it('does not wrap a pasted image URL when auto-tags is disabled', () => {
		const textarea = renderTextarea()
		isImageUrlMock.mockReturnValue(true)
		settingsStateMock.autoTagsEnabled = false

		injectPasteHandler()
		const event = createPasteEvent('https://example.com/image.jpg')
		textarea.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(textarea.value).toBe('')
	})

	it('does not wrap a pasted media URL when auto-tags is disabled', () => {
		const textarea = renderTextarea()
		isMediaUrlMock.mockReturnValue(true)
		settingsStateMock.autoTagsEnabled = false

		injectPasteHandler()
		const event = createPasteEvent('https://youtube.com/watch?v=abc')
		textarea.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(textarea.value).toBe('')
	})
})
