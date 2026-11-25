import { afterEach, expect, it, vi } from 'vitest'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { initCenteredPosts } from '.'

vi.mock('@wxt-dev/storage', () => ({
	storage: {
		getItem: vi.fn(async () => ({ state: { centeredPostsEnabled: true, centeredControlsPosition: 'side' } })),
		watch: vi.fn(),
	},
}))

const controlBarId = DOM_MARKERS.IDS.CENTERED_CONTROL_BAR
const getControlBar = () => document.getElementById(controlBarId)!

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.clearAllTimers()
	vi.useRealTimers()
})

it('keeps the controls clear of the posts as the side gutter changes', async () => {
	vi.useFakeTimers()
	vi.stubGlobal('innerWidth', 1767)
	vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1752)
	let notifyLayoutResize!: () => void
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: () => void) { notifyLayoutResize = callback }
		observe() {}
		disconnect() {}
	})
	window.history.replaceState(null, '', '/foro/cine/hilo-123')
	document.body.innerHTML = `
		<aside class="c-side" style="width: 332px">
			<div id="topic-reply"><button>Responder</button></div>
		</aside>
		<div id="topic"><div id="posts-wrap"><article class="post"></article></div></div>
	`
	let threadRight = 1469
	const originalRect = HTMLElement.prototype.getBoundingClientRect
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (this.id === 'topic' || this.classList.contains('post')) return new DOMRect(121, 300, threadRight - 121, 400)
		if (this.id === controlBarId) return new DOMRect(0, 0, Number.parseFloat(this.style.width), 180)
		return originalRect.call(this)
	})
	const reply = document.querySelector('#topic-reply')

	await initCenteredPosts()
	expect(Number.parseFloat(getControlBar().style.left)).toBeGreaterThanOrEqual(threadRight + 12)
	expect(Number.parseFloat(getControlBar().style.left) + Number.parseFloat(getControlBar().style.width)).toBeLessThanOrEqual(1740)
	expect(getControlBar().style.width).toBe('259px')

	threadRight = 1600
	notifyLayoutResize()
	vi.advanceTimersByTime(160)
	expect(getControlBar().style.left).toBe('')
	expect(getControlBar().querySelector('#topic-reply')).toBe(reply)

	threadRight = 1320
	window.dispatchEvent(new Event('resize'))
	vi.advanceTimersByTime(160)
	expect(getControlBar().style.left).toBe('1332px')
	expect(getControlBar().style.width).toBe('332px')
	expect(getControlBar().querySelector('#topic-reply')).toBe(reply)
})
