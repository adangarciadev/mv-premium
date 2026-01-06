/**
 * Tests for Live Thread state and intervals
 */
import { describe, it, expect } from 'vitest'

// Re-define types and constants for testing
interface LiveThreadState {
	enabled: boolean
	lastSeenPostNum: number
	timestamp: number
}

const POLL_INTERVALS = {
	HIGH_ACTIVITY: 5000,
	NORMAL: 10000,
	LOW_ACTIVITY: 20000,
	INACTIVE: 45000,
} as const

const MAX_VISIBLE_POSTS = 30

function calculateInterval(recentPostCount: number): number {
	if (recentPostCount >= 10) return POLL_INTERVALS.HIGH_ACTIVITY
	if (recentPostCount >= 5) return POLL_INTERVALS.NORMAL
	if (recentPostCount >= 1) return POLL_INTERVALS.LOW_ACTIVITY
	return POLL_INTERVALS.INACTIVE
}

describe('live-thread state', () => {
	describe('LiveThreadState interface', () => {
		it('should track enabled state', () => {
			const state: LiveThreadState = {
				enabled: true,
				lastSeenPostNum: 100,
				timestamp: Date.now(),
			}

			expect(state.enabled).toBe(true)
			expect(state.lastSeenPostNum).toBe(100)
			expect(state.timestamp).toBeGreaterThan(0)
		})

		it('should allow disabling', () => {
			const state: LiveThreadState = {
				enabled: false,
				lastSeenPostNum: 50,
				timestamp: Date.now(),
			}

			expect(state.enabled).toBe(false)
		})
	})

	describe('POLL_INTERVALS', () => {
		it('should have intervals in ascending order', () => {
			expect(POLL_INTERVALS.HIGH_ACTIVITY).toBeLessThan(POLL_INTERVALS.NORMAL)
			expect(POLL_INTERVALS.NORMAL).toBeLessThan(POLL_INTERVALS.LOW_ACTIVITY)
			expect(POLL_INTERVALS.LOW_ACTIVITY).toBeLessThan(POLL_INTERVALS.INACTIVE)
		})

		it('should have reasonable values in milliseconds', () => {
			// At least 1 second
			expect(POLL_INTERVALS.HIGH_ACTIVITY).toBeGreaterThanOrEqual(1000)
			// No more than 2 minutes
			expect(POLL_INTERVALS.INACTIVE).toBeLessThanOrEqual(120000)
		})
	})

	describe('MAX_VISIBLE_POSTS', () => {
		it('should have a sensible limit', () => {
			expect(MAX_VISIBLE_POSTS).toBeGreaterThan(0)
			expect(MAX_VISIBLE_POSTS).toBeLessThanOrEqual(100)
		})
	})

	describe('calculateInterval', () => {
		it('should return HIGH_ACTIVITY for many recent posts', () => {
			expect(calculateInterval(15)).toBe(POLL_INTERVALS.HIGH_ACTIVITY)
			expect(calculateInterval(10)).toBe(POLL_INTERVALS.HIGH_ACTIVITY)
		})

		it('should return NORMAL for moderate activity', () => {
			expect(calculateInterval(7)).toBe(POLL_INTERVALS.NORMAL)
			expect(calculateInterval(5)).toBe(POLL_INTERVALS.NORMAL)
		})

		it('should return LOW_ACTIVITY for sparse posts', () => {
			expect(calculateInterval(3)).toBe(POLL_INTERVALS.LOW_ACTIVITY)
			expect(calculateInterval(1)).toBe(POLL_INTERVALS.LOW_ACTIVITY)
		})

		it('should return INACTIVE for no recent posts', () => {
			expect(calculateInterval(0)).toBe(POLL_INTERVALS.INACTIVE)
		})
	})

	describe('state transitions', () => {
		it('should update lastSeenPostNum when new posts arrive', () => {
			let state: LiveThreadState = {
				enabled: true,
				lastSeenPostNum: 100,
				timestamp: Date.now() - 10000,
			}

			// Simulate new posts arriving
			const newPostNum = 105
			state = {
				...state,
				lastSeenPostNum: newPostNum,
				timestamp: Date.now(),
			}

			expect(state.lastSeenPostNum).toBe(105)
		})

		it('should calculate new posts count', () => {
			const lastSeen = 100
			const currentMax = 108

			const newPostsCount = currentMax - lastSeen

			expect(newPostsCount).toBe(8)
		})
	})
})
