import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getMobileLitePostAuthor: vi.fn((post: HTMLElement) => post.getAttribute('data-autor')),
	setMobileLiteUserIgnore: vi.fn(() => Promise.resolve()),
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

vi.mock('./ignored-users', () => ({
	MOBILE_LITE_IGNORED_ATTR: 'data-mvp-mobile-lite-ignored-user',
	getMobileLitePostAuthor: mocks.getMobileLitePostAuthor,
	setMobileLiteUserIgnore: mocks.setMobileLiteUserIgnore,
}))

import { initMobileLitePostGestures, teardownMobileLitePostGestures } from './post-gestures'

const HINT_ID = 'mvp-mobile-lite-post-gesture-hint'

function renderPost({ author = 'Trolencio', ignored = false } = {}): HTMLElement {
	document.body.innerHTML = `
		<div id="posts">
			<div class="post" data-num="2" data-autor="${author}" ${ignored ? 'data-mvp-mobile-lite-ignored-user="true"' : ''}>
				<div class="post-avatar"><img src="https://example.com/avatar.jpg" /></div>
				<div class="post-contents">Contenido del post</div>
			</div>
		</div>
	`
	return document.querySelector('.post[data-num]') as HTMLElement
}

function dispatchTouch(target: Element, type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', x: number, y: number): void {
	const event = new Event(type, { bubbles: true, cancelable: true })
	const touches = type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }]
	Object.defineProperty(event, 'touches', { value: touches })
	Object.defineProperty(event, 'changedTouches', { value: [{ clientX: x, clientY: y }] })
	target.dispatchEvent(event)
}

/**
 * jsdom posts have zero width, so the module falls back to window.innerWidth
 * (1024px) and clamps the commit threshold to its 130px maximum.
 */
function swipe(target: Element, fromX: number, toX: number, y = 300): void {
	dispatchTouch(target, 'touchstart', fromX, y)
	// Two moves: first engages the gesture, second reaches the final distance
	dispatchTouch(target, 'touchmove', fromX + Math.sign(toX - fromX) * 30, y)
	dispatchTouch(target, 'touchmove', toX, y)
	dispatchTouch(target, 'touchend', toX, y)
}

describe('Mobile Lite post gestures', () => {
	beforeEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getMobileLitePostAuthor.mockImplementation((post: HTMLElement) => post.getAttribute('data-autor'))
		mocks.setMobileLiteUserIgnore.mockResolvedValue(undefined)
		document.body.innerHTML = ''
		document.head.innerHTML = ''
		initMobileLitePostGestures()
	})

	afterEach(() => {
		teardownMobileLitePostGestures()
	})

	it('hides the author when swiping a post left past the threshold', () => {
		vi.useFakeTimers()
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		swipe(content, 400, 200)
		// The post slides out for EXIT_MS before the ignore is applied
		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
		vi.advanceTimersByTime(200)

		expect(mocks.setMobileLiteUserIgnore).toHaveBeenCalledWith('Trolencio', 'hide', 'https://example.com/avatar.jpg')
	})

	it('mutes the author when swiping a post right past the threshold', () => {
		vi.useFakeTimers()
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		swipe(content, 300, 500)
		vi.advanceTimersByTime(200)

		expect(mocks.setMobileLiteUserIgnore).toHaveBeenCalledWith('Trolencio', 'mute', 'https://example.com/avatar.jpg')
	})

	it('shows the action hint while dragging', () => {
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		dispatchTouch(content, 'touchstart', 400, 300)
		dispatchTouch(content, 'touchmove', 370, 300)
		dispatchTouch(content, 'touchmove', 250, 300)

		const hint = document.getElementById(HINT_ID)
		expect(hint?.textContent).toBe('Ocultar')
		expect(hint?.dataset.action).toBe('hide')

		dispatchTouch(content, 'touchend', 250, 300)
	})

	it('snaps back without acting when released before the threshold', () => {
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		swipe(content, 400, 340)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
	})

	it('lets vertical scrolling win over the gesture', () => {
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		dispatchTouch(content, 'touchstart', 400, 300)
		dispatchTouch(content, 'touchmove', 395, 360)
		dispatchTouch(content, 'touchmove', 200, 380)
		dispatchTouch(content, 'touchend', 200, 380)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
	})

	it('ignores swipes starting at the screen edges (browser navigation)', () => {
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement

		swipe(content, 10, 300)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
	})

	it('ignores swipes on posts already collapsed by the ignore filter', () => {
		const post = renderPost({ ignored: true })
		const content = post.querySelector('.post-contents') as HTMLElement

		swipe(content, 400, 200)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
	})

	it('never ignores your own posts', () => {
		renderPost({ author: 'MiNick' })
		document.body.insertAdjacentHTML('beforeend', '<ul id="usermenu"><li class="avw"><a class="av" href="/id/MiNick">MiNick</a></li></ul>')
		const content = document.querySelector('.post-contents') as HTMLElement

		swipe(content, 400, 200)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
	})

	it('does nothing after teardown', () => {
		const post = renderPost()
		const content = post.querySelector('.post-contents') as HTMLElement
		teardownMobileLitePostGestures()

		swipe(content, 400, 200)

		expect(mocks.setMobileLiteUserIgnore).not.toHaveBeenCalled()
		expect(document.getElementById(HINT_ID)).toBeNull()
	})
})
