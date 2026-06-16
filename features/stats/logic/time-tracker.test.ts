import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks so the factories below can reference them.
const mocks = vi.hoisted(() => ({
	getSettings: vi.fn(),
	sendMessage: vi.fn(),
	getThreadId: vi.fn(),
	getSubforumInfo: vi.fn(),
}))

vi.mock('@/store', () => ({ getSettings: mocks.getSettings }))
vi.mock('@/lib/messaging', () => ({ sendMessage: mocks.sendMessage }))
vi.mock('@/lib/url-helpers', () => ({
	getThreadId: mocks.getThreadId,
	getSubforumInfo: mocks.getSubforumInfo,
}))

import { isRhythmTrackingEnabled, initTimeTracker, resetTimeTrackerForTest } from './time-tracker'

describe('isRhythmTrackingEnabled', () => {
	it('treats a missing preference as enabled (default-on)', () => {
		expect(isRhythmTrackingEnabled({})).toBe(true)
	})

	it('returns true when explicitly enabled', () => {
		expect(isRhythmTrackingEnabled({ enableRhythmTracking: true })).toBe(true)
	})

	it('returns false only when explicitly disabled', () => {
		expect(isRhythmTrackingEnabled({ enableRhythmTracking: false })).toBe(false)
	})
})

describe('initTimeTracker lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		})
		mocks.getThreadId.mockReturnValue('123')
		mocks.getSubforumInfo.mockReturnValue({ slug: 'off-topic' })
		mocks.getSettings.mockResolvedValue({})
		mocks.sendMessage.mockResolvedValue({ success: true })
	})

	afterEach(() => {
		resetTimeTrackerForTest()
		vi.useRealTimers()
	})

	it('calling initTimeTracker twice creates only one active tracker', async () => {
		initTimeTracker()
		initTimeTracker()

		// 30s sync fires once; the second init must not stack a duplicate interval.
		await vi.advanceTimersByTimeAsync(31_000)

		expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
		expect(mocks.sendMessage).toHaveBeenCalledWith(
			'recordRhythmTimeChunk',
			expect.objectContaining({ subforum: 'off-topic', ms: 30_000 })
		)
	})

	it('cleanup stops future counting', async () => {
		const cleanup = initTimeTracker()

		await vi.advanceTimersByTimeAsync(31_000)
		expect(mocks.sendMessage).toHaveBeenCalledTimes(1)

		cleanup()

		// No intervals remain, so no further chunks are sent.
		await vi.advanceTimersByTimeAsync(31_000)
		expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
	})

	it('does not send when rhythm tracking is explicitly disabled', async () => {
		mocks.getSettings.mockResolvedValue({ enableRhythmTracking: false })

		initTimeTracker()
		await vi.advanceTimersByTimeAsync(31_000)

		expect(mocks.sendMessage).not.toHaveBeenCalled()
	})
})
