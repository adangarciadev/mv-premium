import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

const settingsState = vi.hoisted(() => ({
	contentRulesEnabled: true,
	mutedWordsEnabled: false,
	mutedWords: [] as string[],
	hideThreadEnabled: true,
	hideIgnoredUserThreadsEnabled: true,
	updateSettings: vi.fn(),
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: () => settingsState,
	},
}))

vi.mock('@/features/content-rules', () => ({
	getContentRules: vi.fn(() => Promise.resolve([])),
	saveContentRules: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/features/hidden-threads/logic/storage', () => ({
	getHiddenThreads: vi.fn(() => Promise.resolve([])),
	saveHiddenThreads: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/features/hidden-subforums/logic/storage', () => ({
	getHiddenSubforums: vi.fn(() => Promise.resolve([])),
	saveHiddenSubforums: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/features/user-customizations/storage', () => ({
	getUserCustomizations: vi.fn(() =>
		Promise.resolve({
			users: {},
			globalSettings: {
				adminColor: '#f00',
				subadminColor: '#0f0',
				modColor: '#00f',
				userColor: '#999',
			},
		})
	),
	saveUserCustomizations: vi.fn(() => Promise.resolve()),
}))

import { previewFiltersImportData } from './filters-import-export'

describe('filters import/export helpers', () => {
	it('previews a filters-only backup', () => {
		const result = previewFiltersImportData({
			version: 1,
			timestamp: Date.now(),
			scope: 'mv-premium-filters',
			data: {
				contentRules: [{ id: 'rule-1' }],
				hiddenThreads: [{ id: '/foro/test/1' }],
				hiddenSubforums: [{ id: 'cine' }, { id: 'juegos' }],
				userCustomizations: {
					users: {
						Adan: { isIgnored: true },
					},
					globalSettings: {
						adminColor: '#f00',
						subadminColor: '#0f0',
						modColor: '#00f',
						userColor: '#999',
					},
				},
				settings: {
					contentRulesEnabled: true,
					mutedWordsEnabled: true,
					mutedWords: ['spoiler', 'oferta'],
					hideThreadEnabled: true,
					hideIgnoredUserThreadsEnabled: true,
				},
			},
		})

		expect(result.success).toBe(true)
		expect(result.stats).toMatchObject({
			contentRules: 1,
			hiddenThreads: 1,
			hiddenSubforums: 2,
			users: 1,
			mutedWords: 2,
		})
	})

	it('previews filters from a global backup', () => {
		const result = previewFiltersImportData({
			version: 3,
			timestamp: Date.now(),
			data: {
				[STORAGE_KEYS.CONTENT_RULES]: [{ id: 'rule-1' }, { id: 'rule-2' }],
				[STORAGE_KEYS.HIDDEN_THREADS]: [{ id: '/foro/test/1' }],
				[STORAGE_KEYS.HIDDEN_SUBFORUMS]: [{ id: 'cine' }],
				[STORAGE_KEYS.USER_CUSTOMIZATIONS]: {
					users: {
						Adan: { isIgnored: true },
						Codex: { note: 'ok' },
					},
					globalSettings: {
						adminColor: '#f00',
						subadminColor: '#0f0',
						modColor: '#00f',
						userColor: '#999',
					},
				},
				[STORAGE_KEYS.SETTINGS]: JSON.stringify({
					state: {
						contentRulesEnabled: true,
						mutedWordsEnabled: true,
						mutedWords: ['temporada'],
						hideThreadEnabled: true,
						hideIgnoredUserThreadsEnabled: false,
					},
				}),
			},
		})

		expect(result.success).toBe(true)
		expect(result.stats).toMatchObject({
			contentRules: 2,
			hiddenThreads: 1,
			hiddenSubforums: 1,
			users: 2,
			mutedWords: 1,
		})
	})
})
