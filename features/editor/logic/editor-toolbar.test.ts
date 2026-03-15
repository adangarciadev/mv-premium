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

vi.mock('./image-detector', () => ({
	isImageUrl: () => false,
}))

vi.mock('./media-detector', () => ({
	isMediaUrl: () => false,
	normalizeMediaUrl: (url: string) => url,
}))

import { injectCharacterCounter, injectEditorToolbar } from './editor-toolbar'

describe('editor-toolbar character counter', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		injectedNodes = new WeakSet<Element>()
		mountFeatureWithBoundaryMock.mockClear()
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
