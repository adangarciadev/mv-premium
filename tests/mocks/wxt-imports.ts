/**
 * Mock for WXT's #imports virtual module
 *
 * Provides stub implementations of `storage` and `defineContentScript`
 * so that modules depending on #imports can be imported in Vitest tests.
 */
import { vi } from 'vitest'
import { mockBrowser } from '../setup'

const createStorageItem = (defaultValue?: unknown) => ({
	getValue: vi.fn(() => Promise.resolve(defaultValue ?? null)),
	setValue: vi.fn(() => Promise.resolve()),
	removeValue: vi.fn(() => Promise.resolve()),
	watch: vi.fn(() => vi.fn()),
	defaultValue,
})

export const storage = {
	defineItem: vi.fn((_key: string, options?: { defaultValue?: unknown }) =>
		createStorageItem(options?.defaultValue)
	),
	getItem: vi.fn((_key: string) => Promise.resolve(null)),
	setItem: vi.fn((_key: string, _value: unknown) => Promise.resolve()),
	removeItem: vi.fn((_key: string) => Promise.resolve()),
	watch: vi.fn((_key: string, _callback: (value: unknown) => void) => vi.fn()),
	local: mockBrowser.storage.local,
}

export const defineContentScript = vi.fn((config: unknown) => config)
export const defineBackground = vi.fn((config: unknown) => config)
