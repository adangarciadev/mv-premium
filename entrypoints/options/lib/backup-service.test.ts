import { beforeEach, describe, expect, it, vi } from 'vitest'
import LZString from 'lz-string'
import { STORAGE_KEYS } from '@/constants/storage-keys'

const storageMockState = vi.hoisted(() => ({
	store: new Map<string, unknown>(),
	loadFromStorage: vi.fn(() => Promise.resolve()),
	regenerateAndCacheCSS: vi.fn(),
}))

function normalizeKey(key: string): string {
	return key.startsWith('local:') ? key.slice('local:'.length) : key
}

vi.mock('#imports', () => ({
	storage: {
		defineItem: vi.fn((key: string, options?: { defaultValue?: unknown }) => ({
			getValue: vi.fn(() =>
				Promise.resolve(storageMockState.store.get(normalizeKey(key)) ?? options?.defaultValue ?? null)
			),
			setValue: vi.fn((value: unknown) => {
				storageMockState.store.set(normalizeKey(key), value)
				return Promise.resolve()
			}),
			removeValue: vi.fn(() => {
				storageMockState.store.delete(normalizeKey(key))
				return Promise.resolve()
			}),
			watch: vi.fn(() => vi.fn()),
		})),
		snapshot: vi.fn(() => Promise.resolve(Object.fromEntries(storageMockState.store.entries()))),
		getItem: vi.fn((key: string) => Promise.resolve(storageMockState.store.get(normalizeKey(key)) ?? null)),
		setItem: vi.fn((key: string, value: unknown) => {
			storageMockState.store.set(normalizeKey(key), value)
			return Promise.resolve()
		}),
		removeItem: vi.fn((key: string) => {
			storageMockState.store.delete(normalizeKey(key))
			return Promise.resolve()
		}),
	},
}))

vi.mock('@/features/mv-theme/mv-theme-store', () => ({
	useMvThemeStore: {
		getState: () => ({
			loadFromStorage: storageMockState.loadFromStorage,
			regenerateAndCacheCSS: storageMockState.regenerateAndCacheCSS,
		}),
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

import {
	BACKUP_SCHEMA_VERSION,
	backupContainsPersonalApiKeys,
	createBackupData,
	importBackupData,
	type BackupData,
} from './backup-service'

function setStoredValue(key: string, value: unknown): void {
	storageMockState.store.set(key, value)
}

function decompressStoredValue<T>(value: unknown): T {
	expect(typeof value).toBe('string')
	const raw = value as string
	expect(raw.startsWith('__LZB64__')).toBe(true)
	const json = LZString.decompressFromBase64(raw.slice('__LZB64__'.length))
	expect(json).toBeTruthy()
	return JSON.parse(json as string) as T
}

function createBaseBackup(overrides: Partial<BackupData['data']> = {}): BackupData {
	return {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		exportedAt: '2026-06-03T00:00:00.000Z',
		app: {
			name: 'mv-premium',
			extensionVersion: '2.0.0',
		},
		policy: {
			secrets: 'excluded',
			activity: 'time-stats-only',
			compressedValues: 'decompressed',
		},
		data: {
			settings: {},
			themes: {
				ui: {},
				mediavida: {},
			},
			content: {
				pinnedPosts: [],
			},
			preferences: {},
			stats: {},
			...overrides,
		},
		excluded: {
			secretFields: ['imgbbApiKey', 'geminiApiKey'],
			storageKeys: [],
			patterns: [],
		},
	}
}

describe('backup-service', () => {
	beforeEach(() => {
		storageMockState.store.clear()
		storageMockState.loadFromStorage.mockClear()
		storageMockState.regenerateAndCacheCSS.mockClear()
	})

	describe('createBackupData', () => {
		it('exports only safe allowlisted data and strips settings API keys', async () => {
			setStoredValue(
				STORAGE_KEYS.SETTINGS,
				JSON.stringify({
					state: {
						theme: 'light',
						mutedWords: ['spoiler'],
						imgbbApiKey: 'imgbb-secret',
						tmdbApiKey: 'tmdb-secret',
						giphyApiKey: 'giphy-secret',
						geminiApiKey: 'gemini-secret',
					},
					version: 0,
				})
			)
			setStoredValue(STORAGE_KEYS.ACTIVITY, {
				'03-06-2026': [{ title: 'Privado', url: 'https://www.mediavida.com/foro/cine/hilo-123' }],
			})
			setStoredValue(STORAGE_KEYS.TIME_STATS, { cine: 120000 })
			setStoredValue(STORAGE_KEYS.MV_THEME_CSS, 'generated-css')
			setStoredValue(STORAGE_KEYS.FID_ICONS_CACHE, { 1: { backgroundImage: 'url(...)' } })
			setStoredValue(STORAGE_KEYS.CURRENT_USER, { username: 'TestUser' })
			setStoredValue(STORAGE_KEYS.DRAFTS, {
				drafts: [{ id: 'draft-1', title: 'Draft', content: 'Text', type: 'draft' }],
				folders: [],
			})

			const backup = await createBackupData()
			const serialized = JSON.stringify(backup)

			expect(backup.schemaVersion).toBe(1)
			expect(backup.data.settings).toMatchObject({ theme: 'light', mutedWords: ['spoiler'] })
			expect(backup.data.settings).not.toHaveProperty('imgbbApiKey')
			expect(backup.data.settings).not.toHaveProperty('tmdbApiKey')
			expect(backup.data.settings).not.toHaveProperty('giphyApiKey')
			expect(backup.data.settings).not.toHaveProperty('geminiApiKey')
			expect(backup.data.stats.timeStats).toEqual({ cine: 120000 })
			expect(backup.data.content.drafts).toEqual({
				drafts: [{ id: 'draft-1', title: 'Draft', content: 'Text', type: 'draft' }],
				folders: [],
			})
			expect(serialized).not.toContain('imgbb-secret')
			expect(serialized).not.toContain('tmdb-secret')
			expect(serialized).not.toContain('giphy-secret')
			expect(serialized).not.toContain('gemini-secret')
			expect(serialized).not.toContain('tmdbApiKey')
			expect(serialized).not.toContain('giphyApiKey')
			expect(serialized).not.toContain('Privado')
			expect(serialized).not.toContain('generated-css')
			expect(serialized).not.toContain('TestUser')
		})

		it('can export user-owned API keys when explicitly requested', async () => {
			setStoredValue(
				STORAGE_KEYS.SETTINGS,
				JSON.stringify({
					state: {
						theme: 'light',
						imgbbApiKey: 'imgbb-secret',
						tmdbApiKey: 'tmdb-extension-key',
						giphyApiKey: 'giphy-extension-key',
						geminiApiKey: 'gemini-secret',
					},
					version: 0,
				})
			)

			const backup = await createBackupData({ includePersonalApiKeys: true })
			const serialized = JSON.stringify(backup)

			expect(backup.policy.secrets).toBe('user-selected')
			expect(backup.excluded.secretFields).toEqual([])
			expect(backup.data.settings.imgbbApiKey).toBe('imgbb-secret')
			expect(backup.data.settings.geminiApiKey).toBe('gemini-secret')
			expect(backup.data.settings).not.toHaveProperty('tmdbApiKey')
			expect(backup.data.settings).not.toHaveProperty('giphyApiKey')
			expect(serialized).not.toContain('tmdb-extension-key')
			expect(serialized).not.toContain('giphy-extension-key')
			expect(serialized).not.toContain('tmdbApiKey')
			expect(serialized).not.toContain('giphyApiKey')
		})

		it('normalizes dynamic pinned post keys into stable backup entries', async () => {
			setStoredValue(`${STORAGE_KEYS.PINNED_PREFIX}/foro/cine/hilo-123`, [
				{ num: 1, author: 'Ada', preview: 'Primer post', timestamp: 1, pageNum: 1 },
			])
			setStoredValue('mvp-pinned-meta-/foro/cine/hilo-123', {
				title: 'Hilo',
				subforumSlug: 'cine',
				subforumName: 'Cine',
			})

			const backup = await createBackupData()

			expect(backup.data.content.pinnedPosts).toEqual([
				{
					threadId: '/foro/cine/hilo-123',
					metadata: {
						title: 'Hilo',
						subforumSlug: 'cine',
						subforumName: 'Cine',
					},
					posts: [{ num: 1, author: 'Ada', preview: 'Primer post', timestamp: 1, pageNum: 1 }],
				},
			])
		})
	})

	describe('importBackupData', () => {
		it('rejects unsupported backup versions with a clear error', async () => {
			const result = await importBackupData({
				schemaVersion: 999,
				data: {},
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('Versión de backup no soportada')
		})

		it('rejects files without a backup schema', async () => {
			const result = await importBackupData({
				version: 3,
				timestamp: Date.now(),
				data: {},
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('schemaVersion')
		})

		it('does not delete existing data when a backup omits that section', async () => {
			setStoredValue(STORAGE_KEYS.SAVED_THREADS, [{ id: '/foro/cine/old-1', title: 'Old' }])
			setStoredValue(STORAGE_KEYS.CURRENT_USER, { username: 'LocalUser' })

			const result = await importBackupData(
				createBaseBackup({
					settings: { theme: 'light' },
				})
			)

			expect(result.success).toBe(true)
			expect(storageMockState.store.get(STORAGE_KEYS.SAVED_THREADS)).toEqual([{ id: '/foro/cine/old-1', title: 'Old' }])
			expect(storageMockState.store.get(STORAGE_KEYS.CURRENT_USER)).toEqual({ username: 'LocalUser' })
		})

		it('preserves local personal API keys unless import explicitly allows them', async () => {
			setStoredValue(
				STORAGE_KEYS.SETTINGS,
				JSON.stringify({
					state: {
						theme: 'dark',
						geminiApiKey: 'local-gemini-key',
						imgbbApiKey: 'local-imgbb-key',
						tmdbApiKey: 'local-tmdb-key',
						giphyApiKey: 'local-giphy-key',
					},
					version: 0,
				})
			)

			const result = await importBackupData(
				createBaseBackup({
					settings: {
						theme: 'light',
						boldColor: '#ff8800',
						boldColorEnabled: true,
						geminiApiKey: 'backup-gemini-key',
						imgbbApiKey: 'backup-imgbb-key',
						tmdbApiKey: 'backup-tmdb-key',
						giphyApiKey: 'backup-giphy-key',
					},
				})
			)

			expect(result.success).toBe(true)
			const storedSettings = JSON.parse(storageMockState.store.get(STORAGE_KEYS.SETTINGS) as string)
			expect(storedSettings.state.theme).toBe('light')
			expect(storedSettings.state.boldColor).toBe('#ff8800')
			expect(storedSettings.state.boldColorEnabled).toBe(true)
			expect(storedSettings.state.geminiApiKey).toBe('local-gemini-key')
			expect(storedSettings.state.imgbbApiKey).toBe('local-imgbb-key')
			expect(storedSettings.state.tmdbApiKey).toBe('local-tmdb-key')
			expect(storedSettings.state.giphyApiKey).toBe('local-giphy-key')
			expect(storageMockState.store.get(STORAGE_KEYS.BOLD_COLOR)).toBe('#ff8800')
			expect(storageMockState.store.get(STORAGE_KEYS.BOLD_COLOR_ENABLED)).toBe(true)
			expect(JSON.stringify(storedSettings)).not.toContain('backup-gemini-key')
			expect(JSON.stringify(storedSettings)).not.toContain('backup-imgbb-key')
			expect(JSON.stringify(storedSettings)).not.toContain('backup-tmdb-key')
			expect(JSON.stringify(storedSettings)).not.toContain('backup-giphy-key')
		})

		it('imports user-owned API keys only when explicitly requested', async () => {
			setStoredValue(
				STORAGE_KEYS.SETTINGS,
				JSON.stringify({
					state: {
						theme: 'dark',
						geminiApiKey: 'local-gemini-key',
						imgbbApiKey: 'local-imgbb-key',
						tmdbApiKey: 'local-tmdb-key',
						giphyApiKey: 'local-giphy-key',
					},
					version: 0,
				})
			)

			const result = await importBackupData(
				createBaseBackup({
					settings: {
						geminiApiKey: 'backup-gemini-key',
						imgbbApiKey: 'backup-imgbb-key',
						tmdbApiKey: 'backup-tmdb-key',
						giphyApiKey: 'backup-giphy-key',
					},
				}),
				{ includePersonalApiKeys: true }
			)

			expect(result.success).toBe(true)
			const storedSettings = JSON.parse(storageMockState.store.get(STORAGE_KEYS.SETTINGS) as string)
			expect(storedSettings.state.geminiApiKey).toBe('backup-gemini-key')
			expect(storedSettings.state.imgbbApiKey).toBe('backup-imgbb-key')
			expect(storedSettings.state.tmdbApiKey).toBe('local-tmdb-key')
			expect(storedSettings.state.giphyApiKey).toBe('local-giphy-key')
			expect(JSON.stringify(storedSettings)).not.toContain('backup-tmdb-key')
			expect(JSON.stringify(storedSettings)).not.toContain('backup-giphy-key')
		})

		it('detects backups that contain user-owned API keys', () => {
			expect(backupContainsPersonalApiKeys(createBaseBackup())).toBe(false)
			expect(
				backupContainsPersonalApiKeys(
					createBaseBackup({
						settings: {
							geminiApiKey: 'backup-gemini-key',
						},
					})
				)
			).toBe(true)
		})

		it('restores allowlisted data and regenerates MV theme CSS after importing MV themes', async () => {
			const result = await importBackupData(
				createBaseBackup({
					themes: {
						ui: {
							resolvedTheme: 'light',
							rawTheme: 'system',
						},
						mediavida: {
							state: {
								enabled: true,
								activePresetId: 'custom',
								colorOverrides: { header: '#123456' },
							},
							savedPresets: [{ id: 'preset-1', name: 'Preset', colors: { header: '#123456' } }],
						},
					},
					content: {
						drafts: {
							drafts: [
								{ id: 'draft-1', type: 'draft', title: 'Draft', content: 'Text' },
								{ id: 'template-1', type: 'template', title: 'Template', content: 'Text' },
							],
							folders: [],
						},
						savedThreads: [{ id: '/foro/cine/hilo-1', title: 'Hilo' }],
						hiddenThreads: [{ id: '/foro/juegos/hidden-1', title: 'Hidden' }],
						hiddenSubforums: [{ id: 'off-topic', name: 'OFF-Topic', url: '/foro/off-topic', hiddenAt: 1 }],
						contentRules: [{ id: 'rule-1', name: 'Rule', enabled: true }],
						userCustomizations: { users: { Ada: { note: 'Nota privada' } }, globalSettings: {} },
						favoriteSubforums: [{ id: 'cine', name: 'Cine', url: '/foro/cine', addedAt: 1 }],
						pinnedPosts: [
							{
								threadId: '/foro/cine/hilo-123',
								metadata: { title: 'Hilo', subforumSlug: 'cine', subforumName: 'Cine' },
								posts: [{ num: 1, author: 'Ada', preview: 'Post', timestamp: 1, pageNum: 1 }],
							},
						],
					},
					preferences: {
						nativeLiveDelay: 15000,
						liveThreadDelay: 30000,
					},
					stats: {
						timeStats: { cine: 120000 },
					},
				})
			)

			expect(result.success).toBe(true)
			expect(storageMockState.store.get(STORAGE_KEYS.THEME)).toBe('light')
			expect(storageMockState.store.get(STORAGE_KEYS.THEME_RAW)).toBe('system')
			expect(storageMockState.store.get(STORAGE_KEYS.MV_THEME)).toEqual({
				enabled: true,
				activePresetId: 'custom',
				colorOverrides: { header: '#123456' },
			})
			expect(decompressStoredValue(storageMockState.store.get(STORAGE_KEYS.DRAFTS))).toEqual({
				drafts: [
					{ id: 'draft-1', type: 'draft', title: 'Draft', content: 'Text' },
					{ id: 'template-1', type: 'template', title: 'Template', content: 'Text' },
				],
				folders: [],
			})
			expect(storageMockState.store.get(`${STORAGE_KEYS.PINNED_PREFIX}/foro/cine/hilo-123`)).toEqual([
				{ num: 1, author: 'Ada', preview: 'Post', timestamp: 1, pageNum: 1 },
			])
			expect(storageMockState.store.get('mvp-pinned-meta-/foro/cine/hilo-123')).toEqual({
				title: 'Hilo',
				subforumSlug: 'cine',
				subforumName: 'Cine',
			})
			expect(storageMockState.store.get(STORAGE_KEYS.NATIVE_LIVE_DELAY)).toBe(15000)
			expect(storageMockState.store.get(STORAGE_KEYS.LIVE_THREAD_DELAY)).toBe(30000)
			expect(storageMockState.store.get(STORAGE_KEYS.TIME_STATS)).toEqual({ cine: 120000 })
			expect(storageMockState.store.has(STORAGE_KEYS.MV_THEME_CSS)).toBe(false)
			expect(storageMockState.loadFromStorage).toHaveBeenCalledOnce()
			expect(storageMockState.regenerateAndCacheCSS).toHaveBeenCalledOnce()
			expect(result.stats).toMatchObject({
				pinnedPosts: 1,
				savedThreads: 1,
				drafts: 1,
				templates: 1,
				hiddenThreads: 1,
				hiddenSubforums: 1,
				contentRules: 1,
				userCustomizations: 1,
				favorites: 1,
				subforumStats: 1,
				themesUpdated: true,
			})
		})
	})
})
