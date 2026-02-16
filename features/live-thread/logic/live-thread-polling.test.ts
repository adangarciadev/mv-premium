import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MV_SELECTORS } from '@/constants'

vi.mock('#imports', () => ({
	storage: {
		defineItem: vi.fn(() => ({
			getValue: vi.fn(async () => ({})),
			setValue: vi.fn(async () => undefined),
		})),
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		error: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}))

vi.mock('@/lib/sanitize', () => ({
	sanitizeHTML: (html: string) => html,
}))

vi.mock('@/lib/content-modules/utils/reinitialize-embeds', () => ({
	reinitializeEmbeds: vi.fn(),
	setupGlobalEmbedListener: vi.fn(),
}))

vi.mock('./live-thread-state', () => ({
	POLL_INTERVALS: {
		HIGH_ACTIVITY: 3000,
		NORMAL: 10000,
		LOW_ACTIVITY: 20000,
		INACTIVE: 45000,
	},
	MAX_VISIBLE_POSTS: 30,
	saveLiveState: vi.fn(async () => undefined),
}))

vi.mock('./live-thread-delay', () => ({
	LIVE_THREAD_DELAY_OPTIONS: [],
	clearLiveThreadDelayQueue: vi.fn(),
	enqueueLiveThreadPost: vi.fn(() => false),
	getLiveThreadDelay: vi.fn(() => 0),
	getLiveThreadDelayQueueSize: vi.fn(() => 0),
	loadLiveThreadDelayPreference: vi.fn(async () => 0),
	onLiveThreadDelayQueueSizeChange: vi.fn(),
	resetLiveThreadDelayRuntime: vi.fn(),
	setLiveThreadDelay: vi.fn(async () => undefined),
	setLiveThreadDelayEnabled: vi.fn(),
	setLiveThreadDelayRevealCallback: vi.fn(),
}))

import { insertPostAtTop, startPolling, stopPolling } from './live-thread-polling'

describe('live-thread likes handling', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		document.body.innerHTML = `<div id="${MV_SELECTORS.THREAD.POSTS_CONTAINER_ID}"></div>`
		window.history.pushState({}, '', '/foro/feda/hilo-live-724987')
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				text: async () => '<div>Likes</div>',
			}))
		)
	})

	afterEach(() => {
		stopPolling()
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it('intercepts likes count clicks and loads modal via fetch instead of navigating', async () => {
		startPolling()

		insertPostAtTop(
			`
			<div class="post" data-num="49730">
				<a class="btnmola" href="/foro/thumbs.php?tid=1&num=49730">12</a>
			</div>
		`,
			false,
			10,
			false
		)

		const likeButton = document.querySelector('a.btnmola') as HTMLAnchorElement
		expect(likeButton).toBeTruthy()
		expect(likeButton.getAttribute('href')).toBeNull()
		expect(likeButton.getAttribute('data-mvp-likes-href')).toBe('/foro/thumbs.php?tid=724987&num=49730')

		likeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
		await Promise.resolve()
		await Promise.resolve()

		const fetchSpy = vi.mocked(fetch)
		expect(fetchSpy).toHaveBeenCalledWith(`${window.location.origin}/foro/thumbs.php?tid=724987&num=49730`, {
			credentials: 'include',
			headers: {
				Accept: 'text/html',
				'X-Requested-With': 'XMLHttpRequest',
			},
		})
		expect(document.getElementById('mvp-live-likes-modal')).toBeTruthy()
	})
})
