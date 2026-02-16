/**
 * Tests for Feature Flags System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FeatureFlag, isFeatureEnabled, getEnabledFeatures, getDisabledFeatures } from './feature-flags'

// Mock the settings store
const mockState = {
	infiniteScrollEnabled: false,
	liveThreadEnabled: true,
	mutedWordsEnabled: false,
	geminiApiKey: '',
	groqApiKey: '',
	tmdbApiKey: 'test-api-key',
	// Premium features default to true to match test expectations
	mediaHoverCardsEnabled: true,
	steamBundleInlineCardsEnabled: true,
	pinnedPostsEnabled: true,
	saveThreadEnabled: true,
	galleryButtonEnabled: true,
	postSummaryEnabled: true,
	threadSummarizerEnabled: true,
	cinemaButtonEnabled: true,
}

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: Object.assign(
		vi.fn(selector => {
			if (typeof selector === 'function') {
				return selector(mockState)
			}
			return mockState
		}),
		{
			getState: () => mockState,
		}
	),
}))

describe('feature-flags', () => {
	beforeEach(() => {
		// Reset mock state
		mockState.infiniteScrollEnabled = false
		mockState.liveThreadEnabled = true
		mockState.mutedWordsEnabled = false
		mockState.geminiApiKey = ''
		mockState.tmdbApiKey = 'test-api-key'
		// Reset premium defaults
		mockState.mediaHoverCardsEnabled = true
		mockState.steamBundleInlineCardsEnabled = true
		mockState.pinnedPostsEnabled = true
		mockState.saveThreadEnabled = true
		mockState.galleryButtonEnabled = true
		mockState.postSummaryEnabled = true
		mockState.threadSummarizerEnabled = true
		mockState.cinemaButtonEnabled = true
	})

	describe('isFeatureEnabled()', () => {
		describe('always-enabled features', () => {
			it('returns true for Editor feature', () => {
				expect(isFeatureEnabled(FeatureFlag.Editor)).toBe(true)
			})

			it('returns true for CommandMenu feature', () => {
				expect(isFeatureEnabled(FeatureFlag.CommandMenu)).toBe(true)
			})

			it('returns true for Bookmarks feature', () => {
				expect(isFeatureEnabled(FeatureFlag.Bookmarks)).toBe(true)
			})
		})

		describe('premium features (settings controlled)', () => {
			it('returns true for PinnedPosts feature when enabled', () => {
				expect(isFeatureEnabled(FeatureFlag.PinnedPosts)).toBe(true)
			})

			it('returns false for PinnedPosts feature when disabled', () => {
				mockState.pinnedPostsEnabled = false
				expect(isFeatureEnabled(FeatureFlag.PinnedPosts)).toBe(false)
			})

			it('returns true for SavedThreads feature when enabled', () => {
				expect(isFeatureEnabled(FeatureFlag.SavedThreads)).toBe(true)
			})

			it('returns true for Gallery feature when enabled', () => {
				expect(isFeatureEnabled(FeatureFlag.Gallery)).toBe(true)
			})

			it('returns true for SteamBundleInlineCards feature when enabled', () => {
				expect(isFeatureEnabled(FeatureFlag.SteamBundleInlineCards)).toBe(true)
			})
		})

		describe('settings-controlled features', () => {
			it('returns false when InfiniteScroll is disabled in settings', () => {
				expect(isFeatureEnabled(FeatureFlag.InfiniteScroll)).toBe(false)
			})

			it('returns true when LiveThread is enabled in settings', () => {
				expect(isFeatureEnabled(FeatureFlag.LiveThread)).toBe(true)
			})

			it('reflects settings changes', () => {
				mockState.infiniteScrollEnabled = true
				expect(isFeatureEnabled(FeatureFlag.InfiniteScroll)).toBe(true)
			})
		})

		describe('API key requirements', () => {
			it('returns false for ThreadSummarizer without geminiApiKey', () => {
				mockState.geminiApiKey = ''
				expect(isFeatureEnabled(FeatureFlag.ThreadSummarizer)).toBe(false)
			})

			it('returns true for ThreadSummarizer with geminiApiKey and enabled setting', () => {
				mockState.geminiApiKey = 'test-key'
				mockState.threadSummarizerEnabled = true
				expect(isFeatureEnabled(FeatureFlag.ThreadSummarizer)).toBe(true)
			})

			it('returns false for ThreadSummarizer with geminiApiKey but disabled setting', () => {
				mockState.geminiApiKey = 'test-key'
				mockState.threadSummarizerEnabled = false
				expect(isFeatureEnabled(FeatureFlag.ThreadSummarizer)).toBe(false)
			})

			it('returns true for CinemaCards with tmdbApiKey and enabled setting', () => {
				mockState.cinemaButtonEnabled = true
				expect(isFeatureEnabled(FeatureFlag.CinemaCards)).toBe(true)
			})

			it('returns false for CinemaCards without tmdbApiKey', () => {
				mockState.tmdbApiKey = ''
				expect(isFeatureEnabled(FeatureFlag.CinemaCards)).toBe(false)
			})
		})

		describe('unknown flags', () => {
			it('returns false for unknown feature flags', () => {
				expect(isFeatureEnabled('unknown-feature' as any)).toBe(false)
			})
		})
	})

	describe('getEnabledFeatures()', () => {
		it('returns array of enabled feature flags', () => {
			const enabled = getEnabledFeatures()
			expect(enabled).toContain(FeatureFlag.Editor)
			expect(enabled).toContain(FeatureFlag.CommandMenu)
			expect(enabled).toContain(FeatureFlag.LiveThread)
		})

		it('does not include disabled features', () => {
			const enabled = getEnabledFeatures()
			expect(enabled).not.toContain(FeatureFlag.InfiniteScroll)
			expect(enabled).not.toContain(FeatureFlag.MutedWords)
		})
	})

	describe('getDisabledFeatures()', () => {
		it('returns disabled features with reasons', () => {
			const disabled = getDisabledFeatures()

			const infiniteScroll = disabled.find(d => d.flag === FeatureFlag.InfiniteScroll)
			expect(infiniteScroll).toBeDefined()
			expect(infiniteScroll?.reason).toContain('infiniteScrollEnabled')
		})

		it('indicates missing API key as reason', () => {
			mockState.geminiApiKey = ''
			mockState.groqApiKey = ''
			mockState.threadSummarizerEnabled = true
			const disabled = getDisabledFeatures()

			const summarizer = disabled.find(d => d.flag === FeatureFlag.ThreadSummarizer)
			expect(summarizer).toBeDefined()
			expect(summarizer?.reason).toContain('Missing required API key')
		})

		it('does not include enabled features', () => {
			const disabled = getDisabledFeatures()
			const flags = disabled.map(d => d.flag)

			expect(flags).not.toContain(FeatureFlag.Editor)
			expect(flags).not.toContain(FeatureFlag.LiveThread)
		})
	})
})
