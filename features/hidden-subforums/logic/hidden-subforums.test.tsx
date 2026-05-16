import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOM_MARKERS } from '@/constants'
import { __hiddenSubforumsTestUtils } from './hidden-subforums'

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	mountFeatureWithBoundary: vi.fn(),
	unmountFeature: vi.fn(),
}))

vi.mock('./storage', () => ({
	getHiddenSubforums: vi.fn(),
	unhideSubforum: vi.fn(),
	watchHiddenSubforums: vi.fn(),
}))

vi.mock('./early-guard', () => ({
	removeEarlyHiddenSubforumBlocker: vi.fn(),
}))

vi.mock('@/lib/lazy-toast', () => ({
	toast: { info: vi.fn() },
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('hidden subforums filtering', () => {
	beforeEach(() => {
		vi.useRealTimers()
		document.head.innerHTML = ''
		document.body.innerHTML = ''
		__hiddenSubforumsTestUtils?.setHiddenSubforumIds([])
	})

	it('hides threads from hidden subforums in Spy active view', () => {
		setPath('/foro/spy')
		__hiddenSubforumsTestUtils?.setHiddenSubforumIds(['juegos'])
		document.body.innerHTML = `
			<ul class="threads">
				<li class="thread"><a href="/foro/juegos/hilo-oculto-123">Hilo oculto</a></li>
				<li class="thread"><a href="/foro/cine/hilo-visible-456">Hilo visible</a></li>
			</ul>
		`

		__hiddenSubforumsTestUtils?.applyHiddenSubforumsFilter()

		const rows = Array.from(document.querySelectorAll('li.thread'))
		expect(rows[0]).toHaveClass(DOM_MARKERS.CLASSES.HIDDEN_SUBFORUM)
		expect(rows[1]).not.toHaveClass(DOM_MARKERS.CLASSES.HIDDEN_SUBFORUM)
	})

	it('hides newly added Spy items from hidden subforums', async () => {
		setPath('/foro/spy')
		__hiddenSubforumsTestUtils?.setHiddenSubforumIds(['juegos'])
		document.body.innerHTML = '<ul class="threads"></ul>'

		__hiddenSubforumsTestUtils?.setupLiveFilteringObserver()
		document.querySelector('.threads')?.insertAdjacentHTML(
			'beforeend',
			'<li class="thread"><a href="/foro/juegos/hilo-live-789">Hilo live</a></li>'
		)

		await new Promise(resolve => setTimeout(resolve, 10))

		expect(document.querySelector('li.thread')).toHaveClass(DOM_MARKERS.CLASSES.HIDDEN_SUBFORUM)
	})
})
