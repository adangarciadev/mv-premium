import { beforeEach, describe, expect, it, vi } from 'vitest'
import LZString from 'lz-string'
import { STORAGE_KEYS } from '@/constants/storage-keys'

const storageMockState = vi.hoisted(() => ({
	store: new Map<string, unknown>(),
	loadFromStorage: vi.fn(() => Promise.resolve()),
	regenerateAndCacheCSS: vi.fn(),
	clearLocal: vi.fn(() => Promise.resolve()),
}))

function normalizeKey(key: string): string {
	return key.startsWith('local:') ? key.slice('local:'.length) : key
}

vi.mock('#imports', () => ({
	storage: {
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

vi.mock('wxt/browser', () => ({
	browser: {
		storage: {
			local: {
				clear: storageMockState.clearLocal,
			},
		},
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
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

import { exportAllData, importAllData } from './export-import'

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

describe('export-import', () => {
	beforeEach(() => {
		storageMockState.store.clear()
		storageMockState.loadFromStorage.mockClear()
		storageMockState.regenerateAndCacheCSS.mockClear()
		storageMockState.clearLocal.mockClear()
	})

	it('exports rhythm stats as restorable local data', async () => {
		const rhythmStats = {
			hours: Array(24).fill(0),
			weekdays: Array(7).fill(0),
			weeks: { '2026-06-01': 120000 },
			hourSubforums: { '12': { cine: 120000 } },
			weekdayHours: { '1': Array(24).fill(0) },
			weekdaySubforums: { '1': { cine: 120000 } },
			days: { '2026-06-03': 120000 },
		}
		setStoredValue(STORAGE_KEYS.RHYTHM_STATS, rhythmStats)
		setStoredValue(STORAGE_KEYS.MV_THEME_CSS, 'generated-css')

		const exported = await exportAllData()

		expect(exported.data[STORAGE_KEYS.RHYTHM_STATS]).toEqual(rhythmStats)
		expect(exported.data).not.toHaveProperty(STORAGE_KEYS.MV_THEME_CSS)
	})

	it('imports rhythm stats and reports that Tiempo en Mediavida was restored', async () => {
		const rhythmStats = {
			hours: Array(24).fill(0),
			weekdays: Array(7).fill(0),
			weeks: { '2026-06-01': 120000 },
			hourSubforums: { '12': { cine: 120000 } },
			weekdayHours: { '1': Array(24).fill(0) },
			weekdaySubforums: { '1': { cine: 120000 } },
			days: { '2026-06-03': 120000 },
		}

		const result = await importAllData({
			version: 3,
			timestamp: Date.now(),
			data: {
				[STORAGE_KEYS.RHYTHM_STATS]: rhythmStats,
			},
		})

		expect(result.success).toBe(true)
		expect(decompressStoredValue(storageMockState.store.get(STORAGE_KEYS.RHYTHM_STATS))).toEqual(rhythmStats)
		expect(result.stats).toMatchObject({ rhythmStatsUpdated: true })
		expect(storageMockState.loadFromStorage).toHaveBeenCalledOnce()
		expect(storageMockState.regenerateAndCacheCSS).toHaveBeenCalledOnce()
	})
})
