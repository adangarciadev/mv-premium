import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'

vi.mock('@/features/editor/logic/editor-toolbar', () => ({
	injectEditorToolbar: vi.fn(),
	injectCharacterCounter: vi.fn(),
	injectDraftAutosave: vi.fn(async () => undefined),
	injectPasteHandler: vi.fn(),
}))

import { cleanupPostReplyHandler, setupPostReplyHandler } from './live-thread-dom'

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

describe('live-thread-dom post reply handler', () => {
	beforeEach(() => {
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
})
