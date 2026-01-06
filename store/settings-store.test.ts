/**
 * Tests for Settings Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

// Mock WXT storage before importing the store
vi.mock('@wxt-dev/storage', () => {
	const mockStorage = new Map<string, unknown>()
	return {
		storage: {
			defineItem: (key: string, options?: { fallback?: unknown }) => ({
				getValue: async () => mockStorage.get(key) ?? options?.fallback ?? null,
				setValue: async (value: unknown) => {
					mockStorage.set(key, value)
				},
				removeValue: async () => {
					mockStorage.delete(key)
				},
			}),
			getItem: async <T>(key: string): Promise<T | null> => (mockStorage.get(key) as T) ?? null,
			setItem: async (key: string, value: unknown) => {
				mockStorage.set(key, value)
			},
			removeItem: async (key: string) => {
				mockStorage.delete(key)
			},
		},
	}
})

// Mock logger
vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

// Import store after mocks are set up
import { useSettingsStore, DEFAULT_SETTINGS } from '@/store/settings-store'

describe('settings-store', () => {
	beforeEach(() => {
		// Reset store to defaults before each test
		act(() => {
			useSettingsStore.getState().resetSettings()
		})
	})

	describe('default values', () => {
		it('has correct default theme', () => {
			expect(useSettingsStore.getState().theme).toBe('dark')
		})

		it('has correct default bold color', () => {
			expect(useSettingsStore.getState().boldColor).toBe('#c9a227')
		})

		it('has infinite scroll disabled by default', () => {
			expect(useSettingsStore.getState().infiniteScrollEnabled).toBe(false)
		})

		it('has live thread disabled by default', () => {
			expect(useSettingsStore.getState().liveThreadEnabled).toBe(false)
		})

		it('has debug mode disabled by default', () => {
			expect(useSettingsStore.getState().debugMode).toBe(false)
		})

		it('has empty API keys by default', () => {
			const state = useSettingsStore.getState()
			expect(state.imgbbApiKey).toBe('')
			expect(state.tmdbApiKey).toBe('')
			expect(state.giphyApiKey).toBe('')
			expect(state.geminiApiKey).toBe('')
		})
	})

	describe('individual setters', () => {
		it('setTheme updates theme', () => {
			act(() => {
				useSettingsStore.getState().setTheme('light')
			})
			expect(useSettingsStore.getState().theme).toBe('light')
		})

		it('setBoldColor updates bold color', () => {
			act(() => {
				useSettingsStore.getState().setBoldColor('#ff0000')
			})
			expect(useSettingsStore.getState().boldColor).toBe('#ff0000')
		})

		it('setInfiniteScrollEnabled toggles infinite scroll', () => {
			act(() => {
				useSettingsStore.getState().setInfiniteScrollEnabled(true)
			})
			expect(useSettingsStore.getState().infiniteScrollEnabled).toBe(true)
		})

		it('setDebugMode toggles debug mode', () => {
			act(() => {
				useSettingsStore.getState().setDebugMode(true)
			})
			expect(useSettingsStore.getState().debugMode).toBe(true)
		})

		it('setImgbbApiKey updates API key', () => {
			act(() => {
				useSettingsStore.getState().setImgbbApiKey('test-key-123')
			})
			expect(useSettingsStore.getState().imgbbApiKey).toBe('test-key-123')
		})

		it('setMutedWords updates muted words array', () => {
			const words = ['spam', 'ad', 'promo']
			act(() => {
				useSettingsStore.getState().setMutedWords(words)
			})
			expect(useSettingsStore.getState().mutedWords).toEqual(words)
		})

		it('setShortcut updates specific shortcut', () => {
			act(() => {
				useSettingsStore.getState().setShortcut('openCommandMenu', 'Ctrl+K')
			})
			expect(useSettingsStore.getState().shortcuts.openCommandMenu).toBe('Ctrl+K')
		})

		it('setShortcut can set shortcut to null', () => {
			act(() => {
				useSettingsStore.getState().setShortcut('openCommandMenu', 'Ctrl+K')
				useSettingsStore.getState().setShortcut('openCommandMenu', null)
			})
			expect(useSettingsStore.getState().shortcuts.openCommandMenu).toBeNull()
		})
	})

	describe('generic setter', () => {
		it('setSetting updates any setting by key', () => {
			act(() => {
				useSettingsStore.getState().setSetting('theme', 'system')
			})
			expect(useSettingsStore.getState().theme).toBe('system')
		})

		it('setSetting works with boolean settings', () => {
			act(() => {
				useSettingsStore.getState().setSetting('liveThreadEnabled', true)
			})
			expect(useSettingsStore.getState().liveThreadEnabled).toBe(true)
		})
	})

	describe('batch operations', () => {
		it('updateSettings updates multiple settings at once', () => {
			act(() => {
				useSettingsStore.getState().updateSettings({
					theme: 'light',
					debugMode: true,
					infiniteScrollEnabled: true,
				})
			})

			const state = useSettingsStore.getState()
			expect(state.theme).toBe('light')
			expect(state.debugMode).toBe(true)
			expect(state.infiniteScrollEnabled).toBe(true)
		})

		it('updateSettings preserves other settings', () => {
			act(() => {
				useSettingsStore.getState().setBoldColor('#123456')
				useSettingsStore.getState().updateSettings({ theme: 'light' })
			})

			expect(useSettingsStore.getState().boldColor).toBe('#123456')
		})

		it('resetSettings restores all defaults', () => {
			act(() => {
				// Change several settings
				useSettingsStore.getState().setTheme('light')
				useSettingsStore.getState().setDebugMode(true)
				useSettingsStore.getState().setBoldColor('#000000')

				// Reset
				useSettingsStore.getState().resetSettings()
			})

			const state = useSettingsStore.getState()
			expect(state.theme).toBe(DEFAULT_SETTINGS.theme)
			expect(state.debugMode).toBe(DEFAULT_SETTINGS.debugMode)
			expect(state.boldColor).toBe(DEFAULT_SETTINGS.boldColor)
		})
	})

	describe('ultrawide mode', () => {
		it('setUltrawideMode updates mode', () => {
			act(() => {
				useSettingsStore.getState().setUltrawideMode('wide')
			})
			expect(useSettingsStore.getState().ultrawideMode).toBe('wide')
		})

		it('supports all ultrawide mode values', () => {
			const modes = ['off', 'wide', 'extra-wide', 'full'] as const
			for (const mode of modes) {
				act(() => {
					useSettingsStore.getState().setUltrawideMode(mode)
				})
				expect(useSettingsStore.getState().ultrawideMode).toBe(mode)
			}
		})
	})

	describe('AI settings', () => {
		it('setGeminiApiKey updates API key', () => {
			act(() => {
				useSettingsStore.getState().setGeminiApiKey('gemini-key-123')
			})
			expect(useSettingsStore.getState().geminiApiKey).toBe('gemini-key-123')
		})

		it('setAIModel updates AI model', () => {
			act(() => {
				useSettingsStore.getState().setAIModel('gemini-1.5-pro')
			})
			expect(useSettingsStore.getState().aiModel).toBe('gemini-1.5-pro')
		})
	})
})
