import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { PostInfo } from './live-thread-state'

const storageMap = new Map<string, unknown>()

vi.mock('#imports', () => ({
	storage: {
		defineItem: vi.fn((key: string, options?: { defaultValue?: unknown }) => ({
			getValue: vi.fn(async () => (storageMap.has(key) ? storageMap.get(key) : options?.defaultValue ?? null)),
			setValue: vi.fn(async (value: unknown) => {
				storageMap.set(key, value)
			}),
			removeValue: vi.fn(async () => {
				storageMap.delete(key)
			}),
		})),
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

import {
	clearLiveThreadDelayQueue,
	enqueueLiveThreadPost,
	getLiveThreadDelayQueueSize,
	loadLiveThreadDelayPreference,
	resetLiveThreadDelayRuntime,
	setLiveThreadDelay,
	setLiveThreadDelayEnabled,
	setLiveThreadDelayRevealCallback,
} from './live-thread-delay'

function createPost(num: number): PostInfo {
	return {
		num,
		html: `<div class="post" data-num="${num}">Post ${num}</div>`,
	}
}

describe('live-thread-delay', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		storageMap.clear()
		resetLiveThreadDelayRuntime()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('queues posts when enabled and delay is greater than 0', async () => {
		const revealed: number[] = []
		setLiveThreadDelayRevealCallback((post) => {
			revealed.push(post.num)
		})
		setLiveThreadDelayEnabled(true)
		await setLiveThreadDelay(2000)

		expect(enqueueLiveThreadPost(createPost(62), 4)).toBe(true)
		expect(enqueueLiveThreadPost(createPost(61), 4)).toBe(true)
		expect(getLiveThreadDelayQueueSize()).toBe(2)

		await vi.advanceTimersByTimeAsync(2000)

		expect(revealed).toEqual([61, 62])
		expect(getLiveThreadDelayQueueSize()).toBe(0)
	})

	it('does not queue posts when delay is 0', async () => {
		setLiveThreadDelayEnabled(true)
		await setLiveThreadDelay(0)

		expect(enqueueLiveThreadPost(createPost(100), 2)).toBe(false)
		expect(getLiveThreadDelayQueueSize()).toBe(0)
	})

	it('reveals oldest queued post when max queue size is reached', async () => {
		const revealed: number[] = []
		setLiveThreadDelayRevealCallback((post) => {
			revealed.push(post.num)
		})
		setLiveThreadDelayEnabled(true)
		await setLiveThreadDelay(60000)

		for (let i = 1; i <= 101; i++) {
			enqueueLiveThreadPost(createPost(i), 1)
		}

		expect(revealed).toEqual([1])
		expect(getLiveThreadDelayQueueSize()).toBe(100)
	})

	it('can flush queued posts immediately while preserving order', async () => {
		const revealed: number[] = []
		setLiveThreadDelayRevealCallback((post) => {
			revealed.push(post.num)
		})
		setLiveThreadDelayEnabled(true)
		await setLiveThreadDelay(45000)

		enqueueLiveThreadPost(createPost(12), 3)
		enqueueLiveThreadPost(createPost(10), 3)
		enqueueLiveThreadPost(createPost(11), 3)

		clearLiveThreadDelayQueue({ reveal: true })

		expect(revealed).toEqual([10, 11, 12])
		expect(getLiveThreadDelayQueueSize()).toBe(0)
	})

	it('loads delay preference from storage', async () => {
		storageMap.set('local:mvp-live-thread-delay', 30000)
		const loadedDelay = await loadLiveThreadDelayPreference()
		expect(loadedDelay).toBe(30000)
	})
})
