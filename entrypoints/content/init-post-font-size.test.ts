import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyPostFontSize, watchPostFontSize } from './init-post-font-size'

// Mock STORAGE_KEYS and RUNTIME_CACHE_KEYS
vi.mock('@/constants', () => ({
	STORAGE_KEYS: {
		POST_FONT_SIZE: 'mvp-post-font-size',
	},
	RUNTIME_CACHE_KEYS: {
		POST_FONT_SIZE: 'mvp-post-font-size-cache',
	},
}))

// Mock postFontSizeStorage
const mockGetValue = vi.fn()
vi.mock('@/lib/theme/storage', () => ({
	postFontSizeStorage: {
		getValue: () => mockGetValue(),
	},
}))

// Mock browser.storage
const storageListeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = []
vi.mock('wxt/browser', () => ({
	browser: {
		storage: {
			onChanged: {
				addListener: (fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
					storageListeners.push(fn)
				},
			},
		},
	},
}))

const DATA_ATTR = 'data-mvp-font-scaled'
const CSS_VAR = '--mvp-post-font-size'
const CACHE_KEY = 'mvp-post-font-size-cache'

describe('init-post-font-size', () => {
	beforeEach(() => {
		document.documentElement.removeAttribute(DATA_ATTR)
		document.documentElement.style.removeProperty(CSS_VAR)
		localStorage.removeItem(CACHE_KEY)
		storageListeners.length = 0
		vi.clearAllMocks()
	})

	afterEach(() => {
		document.documentElement.removeAttribute(DATA_ATTR)
		document.documentElement.style.removeProperty(CSS_VAR)
		localStorage.removeItem(CACHE_KEY)
	})

	describe('applyPostFontSize', () => {
		it('should not set data attribute or CSS variable when size is default (100)', async () => {
			mockGetValue.mockResolvedValue(100)

			await applyPostFontSize()

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('')
		})

		it('should set data attribute and CSS variable when size differs from default', async () => {
			mockGetValue.mockResolvedValue(120)

			await applyPostFontSize()

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(true)
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('120%')
		})

		it('should handle null storage value as default', async () => {
			mockGetValue.mockResolvedValue(null)

			await applyPostFontSize()

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
		})

		it('should remove data attribute and CSS variable when reverting to default', async () => {
			mockGetValue.mockResolvedValue(120)
			await applyPostFontSize()
			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(true)

			mockGetValue.mockResolvedValue(100)
			await applyPostFontSize()
			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('')
		})

		it('should update CSS variable value when changing sizes', async () => {
			mockGetValue.mockResolvedValue(110)
			await applyPostFontSize()
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('110%')

			mockGetValue.mockResolvedValue(140)
			await applyPostFontSize()
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('140%')
		})

		it('should handle storage errors gracefully', async () => {
			mockGetValue.mockRejectedValue(new Error('Storage unavailable'))

			await expect(applyPostFontSize()).resolves.not.toThrow()
		})

		it('should update localStorage cache when applying non-default size', async () => {
			mockGetValue.mockResolvedValue(130)

			await applyPostFontSize()

			expect(localStorage.getItem(CACHE_KEY)).toBe('130')
		})

		it('should remove localStorage cache when applying default size', async () => {
			localStorage.setItem(CACHE_KEY, '120')
			mockGetValue.mockResolvedValue(100)

			await applyPostFontSize()

			expect(localStorage.getItem(CACHE_KEY)).toBeNull()
		})
	})

	describe('watchPostFontSize', () => {
		it('should register a storage listener', () => {
			watchPostFontSize()

			expect(storageListeners.length).toBe(1)
		})

		it('should set CSS variable when storage changes', () => {
			watchPostFontSize()

			const listener = storageListeners[0]
			listener({ 'mvp-post-font-size': { newValue: 130 } }, 'local')

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(true)
			expect(document.documentElement.style.getPropertyValue(CSS_VAR)).toBe('130%')
		})

		it('should update localStorage cache on storage change', () => {
			watchPostFontSize()
			const listener = storageListeners[0]

			listener({ 'mvp-post-font-size': { newValue: 130 } }, 'local')

			expect(localStorage.getItem(CACHE_KEY)).toBe('130')
		})

		it('should remove cache when size is reset to default', () => {
			watchPostFontSize()
			const listener = storageListeners[0]

			listener({ 'mvp-post-font-size': { newValue: 120 } }, 'local')
			expect(localStorage.getItem(CACHE_KEY)).toBe('120')

			listener({ 'mvp-post-font-size': { newValue: 100 } }, 'local')
			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
			expect(localStorage.getItem(CACHE_KEY)).toBeNull()
		})

		it('should ignore changes from non-local storage areas', () => {
			watchPostFontSize()
			const listener = storageListeners[0]

			listener({ 'mvp-post-font-size': { newValue: 130 } }, 'sync')

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
		})

		it('should ignore changes to unrelated storage keys', () => {
			watchPostFontSize()
			const listener = storageListeners[0]

			listener({ 'mvp-some-other-key': { newValue: 'whatever' } }, 'local')

			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
		})

		it('should fallback to default when newValue is undefined', () => {
			watchPostFontSize()
			const listener = storageListeners[0]

			listener({ 'mvp-post-font-size': { newValue: 120 } }, 'local')
			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(true)

			listener({ 'mvp-post-font-size': { newValue: undefined } }, 'local')
			expect(document.documentElement.hasAttribute(DATA_ATTR)).toBe(false)
		})
	})
})
