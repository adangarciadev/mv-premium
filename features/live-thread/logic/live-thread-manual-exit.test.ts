import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { markManualLiveExit, checkManualLiveExit } from './live-thread-manual-exit'

describe('live-thread-manual-exit', () => {
	beforeEach(() => {
		sessionStorage.clear()
	})

	it('suppresses and notifies on the first check after a marked exit', () => {
		markManualLiveExit('12345')
		expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: true, shouldNotify: true })
	})

	it('keeps suppressing on later checks for the same thread but stops notifying', () => {
		markManualLiveExit('12345')
		checkManualLiveExit('12345')
		expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: true, shouldNotify: false })
		expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: true, shouldNotify: false })
	})

	it('stops suppressing once the thread changes, and clears the stale marker', () => {
		markManualLiveExit('12345')
		expect(checkManualLiveExit('99999')).toEqual({ shouldSuppress: false, shouldNotify: false })
		expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: false, shouldNotify: false })
	})

	it('does not suppress when nothing was marked', () => {
		expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: false, shouldNotify: false })
	})

	describe('when sessionStorage throws', () => {
		afterEach(() => {
			vi.restoreAllMocks()
		})

		it('markManualLiveExit does not throw', () => {
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('blocked')
			})
			expect(() => markManualLiveExit('12345')).not.toThrow()
		})

		it('checkManualLiveExit returns no suppression instead of throwing', () => {
			vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw new Error('blocked')
			})
			expect(() => checkManualLiveExit('12345')).not.toThrow()
			expect(checkManualLiveExit('12345')).toEqual({ shouldSuppress: false, shouldNotify: false })
		})
	})
})
