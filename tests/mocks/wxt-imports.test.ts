import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '#imports'
import { mockBrowser } from '../setup'

describe('#imports storage mock', () => {
	beforeEach(() => {
		mockBrowser.storage.local._setStore({})
		mockBrowser.storage.sync._setStore({})
	})

	it('returns a cloned default value before anything is written', async () => {
		const item = storage.defineItem('local:test-key', { defaultValue: { count: 0 } })

		const firstValue = await item.getValue()
		expect(firstValue).toEqual({ count: 0 })

		firstValue.count = 1
		await expect(item.getValue()).resolves.toEqual({ count: 0 })
	})

	it('persists setValue writes and reads them through getValue', async () => {
		const item = storage.defineItem('local:test-key', { defaultValue: { count: 0 } })

		await item.setValue({ count: 2 })

		await expect(item.getValue()).resolves.toEqual({ count: 2 })
	})

	it('shares values between defineItem and raw storage methods', async () => {
		const item = storage.defineItem('local:test-key', { defaultValue: { count: 0 } })

		await storage.setItem('local:test-key', { count: 3 })
		await expect(item.getValue()).resolves.toEqual({ count: 3 })

		await item.setValue({ count: 4 })
		await expect(storage.getItem('local:test-key')).resolves.toEqual({ count: 4 })
	})

	it('clears values through removeValue and raw removeItem', async () => {
		const item = storage.defineItem('local:test-key', { defaultValue: { count: 0 } })

		await item.setValue({ count: 5 })
		await item.removeValue()
		await expect(storage.getItem('local:test-key')).resolves.toBeNull()

		await item.setValue({ count: 6 })
		await storage.removeItem('local:test-key')
		await expect(item.getValue()).resolves.toEqual({ count: 0 })
	})

	it('fires watchers on writes and stops after unsubscribe', async () => {
		const item = storage.defineItem('local:test-key', { defaultValue: { count: 0 } })
		const callback = vi.fn()

		const unsubscribe = item.watch(callback)

		await item.setValue({ count: 7 })
		await storage.setItem('local:test-key', { count: 8 })
		expect(callback).toHaveBeenCalledTimes(2)
		expect(callback).toHaveBeenNthCalledWith(1, { count: 7 })
		expect(callback).toHaveBeenNthCalledWith(2, { count: 8 })

		unsubscribe()
		await item.setValue({ count: 9 })
		expect(callback).toHaveBeenCalledTimes(2)
	})

	it('returns local snapshots with raw keys and excludes sync values', async () => {
		await storage.setItem('local:test-key', { count: 10 })
		await storage.setItem('sync:test-key', { count: 11 })

		await expect(storage.snapshot('local')).resolves.toEqual({
			'test-key': { count: 10 },
		})
	})
})
