import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'

const editorToolbarMocks = vi.hoisted(() => ({
	injectEditorToolbar: vi.fn(),
	injectCharacterCounter: vi.fn(),
	injectDraftAutosave: vi.fn(async () => undefined),
	injectPasteHandler: vi.fn(),
}))

const mobileLiteEditorMocks = vi.hoisted(() => ({
	injectMobileLiteUploadControl: vi.fn(),
}))

vi.mock('@/features/editor/logic/editor-toolbar', () => ({
	injectEditorToolbar: editorToolbarMocks.injectEditorToolbar,
	injectCharacterCounter: editorToolbarMocks.injectCharacterCounter,
	injectDraftAutosave: editorToolbarMocks.injectDraftAutosave,
	injectPasteHandler: editorToolbarMocks.injectPasteHandler,
}))

vi.mock('@/features/mobile-lite/logic/editor-lite', () => ({
	injectMobileLiteUploadControl: mobileLiteEditorMocks.injectMobileLiteUploadControl,
}))

import { cleanupPostReplyHandler, moveFormToTop, setupPostReplyHandler, toggleFormVisibility } from './live-thread-dom'

function setupThreadDom(postNum = '52'): HTMLTextAreaElement {
	document.body.innerHTML = `
		<div id="${DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER}"></div>
		<div id="${MV_SELECTORS.EDITOR.POST_EDITOR_ID}">
			<form id="${MV_SELECTORS.EDITOR.POSTFORM_ID}">
				<div class="editor-body">
					<textarea id="${MV_SELECTORS.EDITOR.TEXTAREA_ID}"></textarea>
				</div>
			</form>
		</div>
		<div id="${MV_SELECTORS.THREAD.POSTS_CONTAINER_ID}">
			<div class="post" data-num="${postNum}">
				<ul class="buttons">
					<li>
						<a class="post-btn btn-reply" data-num="${postNum}" title="Responder">
							<i class="fa fa-reply"></i>
						</a>
					</li>
				</ul>
			</div>
		</div>
	`

	return document.querySelector(MV_SELECTORS.EDITOR.TEXTAREA) as HTMLTextAreaElement
}

function setupThreadDomWithoutEditor(postNum = '52'): HTMLElement {
	document.body.innerHTML = `
		<div id="${DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER}"></div>
		<a class="quickreply" href="/foro/test/responder">Responder</a>
		<div id="${MV_SELECTORS.THREAD.POSTS_CONTAINER_ID}">
			<div class="post" data-num="${postNum}">
				<ul class="buttons">
					<li>
						<a class="post-btn btn-reply" data-num="${postNum}" title="Responder">
							<i class="fa fa-reply"></i>
						</a>
					</li>
				</ul>
			</div>
		</div>
	`

	const nativeReply = document.querySelector('.quickreply') as HTMLElement
	nativeReply.addEventListener('click', event => {
		event.preventDefault()
		document.body.insertAdjacentHTML(
			'beforeend',
			`
				<div id="${MV_SELECTORS.EDITOR.POST_EDITOR_ID}">
					<form id="${MV_SELECTORS.EDITOR.POSTFORM_ID}">
						<div class="editor-body">
							<textarea id="${MV_SELECTORS.EDITOR.TEXTAREA_ID}"></textarea>
						</div>
					</form>
				</div>
			`
		)
	})

	return document.querySelector('.btn-reply') as HTMLElement
}

describe('live-thread-dom post reply handler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		cleanupPostReplyHandler()
	})

	it('opens the live editor and inserts a # reference when clicking reply', () => {
		const textarea = setupThreadDom('52')
		setupPostReplyHandler()

		const icon = document.querySelector('.btn-reply i') as HTMLElement
		icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		expect(textarea.value).toBe('#52 ')
		expect(document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)?.classList.contains('visible')).toBe(true)
	})

	it('works for posts added after handler initialization', () => {
		const textarea = setupThreadDom('52')
		setupPostReplyHandler()

		const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID) as HTMLElement
		postsWrap.insertAdjacentHTML(
			'afterbegin',
			`
				<div class="post" data-num="99">
					<ul class="buttons">
						<li><a class="post-btn btn-reply" data-num="99" title="Responder"><i class="fa fa-reply"></i></a></li>
					</ul>
				</div>
			`
		)

		const newReplyButton = postsWrap.querySelector('.post[data-num="99"] .btn-reply') as HTMLElement
		newReplyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		expect(textarea.value).toBe('#99 ')
	})

	it('does not react after cleanup', () => {
		const textarea = setupThreadDom('77')
		setupPostReplyHandler()
		cleanupPostReplyHandler()

		const replyButton = document.querySelector('.btn-reply') as HTMLElement
		replyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		expect(textarea.value).toBe('')
	})

	it('stops same-event native listeners to prevent editor flicker', () => {
		setupThreadDom('52')
		setupPostReplyHandler()

		const postsWrap = document.getElementById(MV_SELECTORS.THREAD.POSTS_CONTAINER_ID) as HTMLElement
		const nativeClickSpy = vi.fn()
		postsWrap.addEventListener('click', nativeClickSpy, true)

		const replyButton = document.querySelector('.btn-reply') as HTMLElement
		replyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		expect(nativeClickSpy).not.toHaveBeenCalled()
	})

	it('uses the mobile editor path without injecting the desktop toolbar', () => {
		setupThreadDom('52')
		moveFormToTop({ variant: 'mobile-lite' })
		setupPostReplyHandler({ variant: 'mobile-lite' })

		const replyButton = document.querySelector('.btn-reply') as HTMLElement
		replyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		// The mobile editor clones the textarea (to strip Mediavida's native focus
		// listeners), so re-query the current one instead of the original handle.
		const currentTextarea = document.querySelector('textarea') as HTMLTextAreaElement
		expect(currentTextarea.value).toBe('#52 ')
		expect(document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)?.classList.contains('visible')).toBe(true)
		expect(editorToolbarMocks.injectEditorToolbar).not.toHaveBeenCalled()
		expect(editorToolbarMocks.injectCharacterCounter).not.toHaveBeenCalled()
	})

	it('waits for the native mobile editor before inserting a post reference', async () => {
		const replyButton = setupThreadDomWithoutEditor('52')
		setupPostReplyHandler({ variant: 'mobile-lite' })

		replyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
		await new Promise(resolve => setTimeout(resolve, 0))

		const textarea = document.querySelector(MV_SELECTORS.EDITOR.TEXTAREA) as HTMLTextAreaElement
		const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID)

		expect(textarea.value).toBe('#52 ')
		expect(postEditor?.classList.contains('live')).toBe(false)
		expect(document.getElementById(DOM_MARKERS.IDS.LIVE_EDITOR_WRAPPER)?.classList.contains('visible')).toBe(true)
		expect(editorToolbarMocks.injectEditorToolbar).not.toHaveBeenCalled()
	})

	it('restores native footer elements when opening the mobile editor', () => {
		setupThreadDom('52')
		const postEditor = document.getElementById(MV_SELECTORS.EDITOR.POST_EDITOR_ID) as HTMLElement
		const postform = document.getElementById(MV_SELECTORS.EDITOR.POSTFORM_ID) as HTMLElement
		const editorMeta = document.createElement('div')
		const nativeSubmit = document.createElement('input')
		const customSubmit = document.createElement('button')
		const customExtended = document.createElement('a')
		const customFooter = document.createElement('div')

		editorMeta.className = 'editor-meta'
		nativeSubmit.type = 'submit'
		nativeSubmit.value = 'Enviar'
		nativeSubmit.style.display = 'none'
		customSubmit.className = DOM_MARKERS.LIVE_THREAD.BTN_SUBMIT
		customExtended.className = DOM_MARKERS.LIVE_THREAD.LINK_EXTENDED
		customFooter.className = DOM_MARKERS.LIVE_THREAD.FOOTER
		customFooter.append(nativeSubmit, customSubmit, customExtended)
		postform.append(editorMeta, customFooter)

		moveFormToTop({ variant: 'mobile-lite' })
		toggleFormVisibility(true, { variant: 'mobile-lite' })

		expect(editorMeta.contains(nativeSubmit)).toBe(true)
		expect(nativeSubmit.style.display).toBe('')
		expect(postEditor.querySelector(`.${DOM_MARKERS.LIVE_THREAD.FOOTER}`)).toBeNull()
		expect(editorMeta.contains(customSubmit)).toBe(false)
		expect(editorMeta.contains(customExtended)).toBe(false)
	})

	it('keeps the desktop editor path injecting the desktop toolbar', () => {
		setupThreadDom('52')
		moveFormToTop()
		toggleFormVisibility(true)

		expect(editorToolbarMocks.injectEditorToolbar).toHaveBeenCalledOnce()
		expect(editorToolbarMocks.injectCharacterCounter).toHaveBeenCalledOnce()
	})
})
