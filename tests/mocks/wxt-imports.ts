/**
 * Mock for WXT's #imports virtual module
 *
 * Provides stub implementations of `storage` and `defineContentScript`
 * so that modules depending on #imports can be imported in Vitest tests.
 */
import { vi } from 'vitest'
import { mockBrowser } from '../setup'

type StorageArea = 'local' | 'sync'
type StorageOptions<T> = {
	defaultValue?: T
	fallback?: T
}
type StorageWatcher = (value: unknown) => void

const watchers = new Map<string, Set<StorageWatcher>>()

const resetWatchers = (): void => {
	watchers.clear()
}

const setLocalStore = mockBrowser.storage.local._setStore
const setSyncStore = mockBrowser.storage.sync._setStore

mockBrowser.storage.local._setStore = (newStore: Record<string, unknown>) => {
	resetWatchers()
	setLocalStore(newStore)
}

mockBrowser.storage.sync._setStore = (newStore: Record<string, unknown>) => {
	resetWatchers()
	setSyncStore(newStore)
}

function parseWxtKey(key: string): { area: StorageArea; fullKey: string; rawKey: string } {
	const [areaCandidate, ...rest] = key.split(':')
	const area: StorageArea = areaCandidate === 'sync' ? 'sync' : 'local'
	const rawKey = rest.length > 0 ? rest.join(':') : key
	return { area, fullKey: `${area}:${rawKey}`, rawKey }
}

function cloneValue<T>(value: T): T {
	if (value === null || value === undefined) {
		return value
	}

	return structuredClone(value)
}

function getAreaStore(area: StorageArea): Record<string, unknown> {
	return mockBrowser.storage[area]._getStore()
}

function readStoredValue(key: string): unknown {
	const { area, fullKey } = parseWxtKey(key)
	return getAreaStore(area)[fullKey]
}

async function writeStoredValue(key: string, value: unknown): Promise<void> {
	const { area, fullKey } = parseWxtKey(key)
	await mockBrowser.storage[area].set({ [fullKey]: value })
	notifyWatchers(fullKey, value)
}

async function removeStoredValue(key: string): Promise<void> {
	const { area, fullKey } = parseWxtKey(key)
	await mockBrowser.storage[area].remove(fullKey)
	notifyWatchers(fullKey, null)
}

function notifyWatchers(fullKey: string, value: unknown): void {
	watchers.get(fullKey)?.forEach(callback => callback(value))
}

function getDefaultValue<T>(options?: StorageOptions<T>): T | undefined {
	return options?.defaultValue ?? options?.fallback
}

const createStorageItem = <T,>(key: string, options?: StorageOptions<T>) => {
	const defaultValue = getDefaultValue(options)

	return {
		getValue: vi.fn(() => {
			const storedValue = readStoredValue(key)
			return Promise.resolve(storedValue === undefined ? cloneValue(defaultValue ?? null) : storedValue)
		}),
		setValue: vi.fn((value: T) => writeStoredValue(key, value)),
		removeValue: vi.fn(() => removeStoredValue(key)),
		watch: vi.fn((callback: StorageWatcher) => storage.watch(key, callback)),
		defaultValue,
	}
}

export const storage = {
	defineItem: vi.fn(<T,>(key: string, options?: StorageOptions<T>) => createStorageItem(key, options)),
	getItem: vi.fn(<T,>(key: string) => {
		const storedValue = readStoredValue(key) as T | null | undefined
		return Promise.resolve(storedValue ?? null)
	}),
	setItem: vi.fn((key: string, value: unknown) => writeStoredValue(key, value)),
	removeItem: vi.fn((key: string) => removeStoredValue(key)),
	watch: vi.fn((key: string, callback: StorageWatcher) => {
		const { fullKey } = parseWxtKey(key)
		const keyWatchers = watchers.get(fullKey) ?? new Set<StorageWatcher>()
		keyWatchers.add(callback)
		watchers.set(fullKey, keyWatchers)

		return () => {
			keyWatchers.delete(callback)
			if (keyWatchers.size === 0) {
				watchers.delete(fullKey)
			}
		}
	}),
	snapshot: vi.fn((area: StorageArea) => {
		const store = getAreaStore(area)
		const snapshot = Object.entries(store).reduce<Record<string, unknown>>((result, [key, value]) => {
			const parsedKey = parseWxtKey(key)
			if (parsedKey.area === area) {
				result[parsedKey.rawKey] = value
			}
			return result
		}, {})

		return Promise.resolve(snapshot)
	}),
	local: mockBrowser.storage.local,
	sync: mockBrowser.storage.sync,
}

export const defineContentScript = vi.fn((config: unknown) => config)
export const defineBackground = vi.fn((config: unknown) => config)
