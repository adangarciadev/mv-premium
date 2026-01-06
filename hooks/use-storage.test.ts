/**
 * Tests for useStorage hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStorage } from './use-storage'

// Mock storage item factory
function createMockStorageItem<T>(initialValue: T) {
	let storedValue = initialValue
	const watchers = new Set<(newValue: T | null, oldValue: T | null) => void>()

	return {
		getValue: vi.fn(() => Promise.resolve(storedValue)),
		setValue: vi.fn(async (newValue: T) => {
			const oldValue = storedValue
			storedValue = newValue
			// Notify watchers
			watchers.forEach(callback => callback(newValue, oldValue))
		}),
		watch: vi.fn((callback: (newValue: T | null, oldValue: T | null) => void) => {
			watchers.add(callback)
			return () => watchers.delete(callback)
		}),
		// Test helpers
		_getStoredValue: () => storedValue,
		_setStoredValue: (v: T) => {
			storedValue = v
		},
		_notifyWatchers: (newValue: T, oldValue: T) => {
			watchers.forEach(cb => cb(newValue, oldValue))
		},
	}
}

describe('useStorage', () => {
	describe('initial state', () => {
		it('starts with loading=true and initialValue', () => {
			const mockItem = createMockStorageItem('stored')
			const { result } = renderHook(() => useStorage(mockItem, 'initial'))

			expect(result.current.loading).toBe(true)
			expect(result.current.value).toBe('initial')
		})

		it('loads value from storage and sets loading=false', async () => {
			const mockItem = createMockStorageItem('stored value')
			const { result } = renderHook(() => useStorage(mockItem, 'initial'))

			await waitFor(() => {
				expect(result.current.loading).toBe(false)
			})

			expect(result.current.value).toBe('stored value')
			expect(mockItem.getValue).toHaveBeenCalled()
		})
	})

	describe('setValue()', () => {
		it('updates storage when setValue is called', async () => {
			const mockItem = createMockStorageItem('old')
			const { result } = renderHook(() => useStorage(mockItem, 'initial'))

			await waitFor(() => expect(result.current.loading).toBe(false))

			await act(async () => {
				await result.current.setValue('new value')
			})

			expect(mockItem.setValue).toHaveBeenCalledWith('new value')
		})
	})

	describe('watch subscription', () => {
		it('subscribes to storage changes on mount', async () => {
			const mockItem = createMockStorageItem('initial')
			renderHook(() => useStorage(mockItem, 'default'))

			expect(mockItem.watch).toHaveBeenCalled()
		})

		it('updates value when storage changes externally', async () => {
			const mockItem = createMockStorageItem('initial')
			const { result } = renderHook(() => useStorage(mockItem, 'default'))

			await waitFor(() => expect(result.current.loading).toBe(false))

			// Simulate external storage change
			act(() => {
				mockItem._notifyWatchers('external update', 'initial')
			})

			expect(result.current.value).toBe('external update')
		})

		it('unsubscribes on unmount', async () => {
			const mockItem = createMockStorageItem('initial')
			const unwatchFn = vi.fn()
			mockItem.watch.mockReturnValue(unwatchFn)

			const { unmount } = renderHook(() => useStorage(mockItem, 'default'))

			unmount()

			expect(unwatchFn).toHaveBeenCalled()
		})
	})

	describe('refresh()', () => {
		it('reloads value from storage', async () => {
			const mockItem = createMockStorageItem('initial')
			const { result } = renderHook(() => useStorage(mockItem, 'default'))

			await waitFor(() => expect(result.current.loading).toBe(false))

			// Change stored value directly
			mockItem._setStoredValue('updated')

			await act(async () => {
				await result.current.refresh()
			})

			expect(result.current.value).toBe('updated')
		})
	})

	describe('type handling', () => {
		it('handles object values', async () => {
			const obj = { name: 'test', count: 42 }
			const mockItem = createMockStorageItem(obj)
			const { result } = renderHook(() => useStorage(mockItem, { name: '', count: 0 }))

			await waitFor(() => expect(result.current.loading).toBe(false))

			expect(result.current.value).toEqual(obj)
		})

		it('handles array values', async () => {
			const arr = [1, 2, 3]
			const mockItem = createMockStorageItem(arr)
			const { result } = renderHook(() => useStorage(mockItem, []))

			await waitFor(() => expect(result.current.loading).toBe(false))

			expect(result.current.value).toEqual(arr)
		})

		it('handles null values by keeping previous value', async () => {
			const mockItem = createMockStorageItem<string | null>('initial')
			const { result } = renderHook(() => useStorage(mockItem, 'default'))

			await waitFor(() => expect(result.current.loading).toBe(false))

			// Storage emits null (e.g., on delete)
			act(() => {
				mockItem._notifyWatchers(null, 'initial')
			})

			// Should keep previous value (based on hook implementation)
			expect(result.current.value).toBe('initial')
		})
	})
})
