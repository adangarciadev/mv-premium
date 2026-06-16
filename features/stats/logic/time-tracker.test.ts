import { describe, it, expect } from 'vitest'
import { isRhythmTrackingEnabled } from './time-tracker'

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
