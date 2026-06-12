import { storage } from '#imports'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'
import {
	getCurrentMobileLiteSeenId,
	getMobileLiteChangelog,
	getMobileLiteChangesSince,
	hasUnseenMobileLiteChanges,
	markCurrentMobileLiteVersionAsSeen,
	resetMobileLiteWhatsNew,
	watchMobileLiteVersionChanges,
} from './whats-new'

const STORAGE_KEY = `local:${STORAGE_KEYS.MOBILE_LITE_LAST_SEEN_VERSION}`

describe('Mobile Lite whats new', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(storage.getItem).mockResolvedValue(null)
		vi.mocked(storage.setItem).mockResolvedValue(undefined)
		vi.mocked(storage.watch).mockReturnValue(vi.fn())
	})

	it('returns only Mobile Lite or shared changelog changes', () => {
		const entries = getMobileLiteChangelog()

		expect(entries.length).toBeGreaterThan(0)
		for (const entry of entries) {
			expect(entry.changes.length).toBeGreaterThan(0)
			for (const change of entry.changes) {
				const surfaces = Array.isArray(change.surface) ? change.surface : [change.surface]
				expect(surfaces.some(surface => surface === 'mobile-lite' || surface === 'shared')).toBe(true)
			}
		}
	})

	it('detects unseen Mobile Lite changes from the stored last seen version', async () => {
		const latestSeenId = getCurrentMobileLiteSeenId()

		vi.mocked(storage.getItem).mockResolvedValueOnce(null)
		await expect(hasUnseenMobileLiteChanges()).resolves.toBe(true)

		vi.mocked(storage.getItem).mockResolvedValueOnce(latestSeenId)
		await expect(hasUnseenMobileLiteChanges()).resolves.toBe(false)
	})

	it('returns entries released after the stored Mobile Lite version', () => {
		const entries = getMobileLiteChangelog()

		expect(getMobileLiteChangesSince(entries[1]?.version ?? entries[0].version)).toEqual([entries[0]])
		expect(getMobileLiteChangesSince(entries[0].version)).toEqual([])
	})

	it('marks the latest Mobile Lite changelog version as seen', async () => {
		await markCurrentMobileLiteVersionAsSeen()

		expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, getCurrentMobileLiteSeenId())
	})

	it('resets the stored Mobile Lite seen version', async () => {
		await resetMobileLiteWhatsNew()

		expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
	})

	it('watches the Mobile Lite last seen version key', () => {
		const callback = vi.fn()
		const unsubscribe = vi.fn()
		vi.mocked(storage.watch).mockReturnValueOnce(unsubscribe)

		expect(watchMobileLiteVersionChanges(callback)).toBe(unsubscribe)
		expect(storage.watch).toHaveBeenCalledWith(STORAGE_KEY, expect.any(Function))

		const watchedCallback = vi.mocked(storage.watch).mock.calls[0][1]
		watchedCallback('3.1.0', null)

		expect(callback).toHaveBeenCalledWith('3.1.0')
	})
})
