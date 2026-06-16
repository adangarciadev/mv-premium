import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readMobileLiteStorageUsage } from './use-storage-usage'

const mocks = vi.hoisted(() => ({
	local: {
		get: vi.fn(),
		getBytesInUse: vi.fn(),
		getKeys: vi.fn(),
		QUOTA_BYTES: 1_000,
	},
}))

vi.mock('wxt/browser', () => ({
	browser: {
		storage: {
			local: mocks.local,
		},
	},
}))

describe('readMobileLiteStorageUsage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		if (typeof mocks.local.getKeys !== 'function') {
			mocks.local.getKeys = vi.fn() as typeof mocks.local.getKeys
		}
		mocks.local.QUOTA_BYTES = 1_000
		mocks.local.get.mockResolvedValue({})
		mocks.local.getBytesInUse.mockResolvedValue(250)
		mocks.local.getKeys.mockResolvedValue(['one', 'two', 'three'])
	})

	it('uses metadata APIs without reading all storage values when available', async () => {
		const usage = await readMobileLiteStorageUsage()

		expect(mocks.local.getBytesInUse).toHaveBeenCalledWith(null)
		expect(mocks.local.getKeys).toHaveBeenCalledOnce()
		expect(mocks.local.get).not.toHaveBeenCalled()
		expect(usage).toEqual({
			used: 250,
			quota: 1_000,
			items: 3,
			percentage: 25,
		})
	})

	it('falls back to full-value estimation when getBytesInUse fails', async () => {
		const storedItems = {
			setting: true,
			nested: { value: 'abc' },
		}
		mocks.local.getBytesInUse.mockRejectedValueOnce(new Error('unsupported'))
		mocks.local.get.mockResolvedValueOnce(storedItems)

		const usage = await readMobileLiteStorageUsage()

		expect(mocks.local.getBytesInUse).toHaveBeenCalledWith(null)
		expect(mocks.local.get).toHaveBeenCalledWith(null)
		expect(usage).toEqual({
			used: new TextEncoder().encode(JSON.stringify(storedItems)).length,
			quota: 1_000,
			items: 2,
			percentage: (new TextEncoder().encode(JSON.stringify(storedItems)).length / 1_000) * 100,
		})
	})

	it('falls back to value reads for item count when getKeys is unavailable', async () => {
		mocks.local.getKeys = undefined as unknown as typeof mocks.local.getKeys
		mocks.local.get.mockResolvedValueOnce({ one: 1, two: 2 })

		const usage = await readMobileLiteStorageUsage()

		expect(mocks.local.getBytesInUse).toHaveBeenCalledWith(null)
		expect(mocks.local.get).toHaveBeenCalledWith(null)
		expect(usage.used).toBe(250)
		expect(usage.items).toBe(2)
	})
})
