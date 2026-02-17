import { beforeEach, describe, expect, it, vi } from 'vitest'

let injectedNodes = new WeakSet<Element>()

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	isAlreadyInjected: (el: Element) => injectedNodes.has(el),
	markAsInjected: (el: Element) => {
		injectedNodes.add(el)
	},
	mountFeature: vi.fn(),
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

import { injectCharacterCounter } from './editor-toolbar'

describe('editor-toolbar character counter', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		injectedNodes = new WeakSet<Element>()
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
})
